import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import { decideParticipationMock } from '../../features/my/org/mockData';
import type { ParticipationRequest } from '../../features/my/org/model';
import { JoinRejectedScreen } from '../../features/my/org/screens/JoinRejectedScreen';
import { JoinRequestedScreen } from '../../features/my/org/screens/JoinRequestedScreen';
import { OrgJoinScreen } from '../../features/my/org/screens/OrgJoinScreen';
import { RoleSelectScreen } from '../../features/my/org/screens/RoleSelectScreen';
import { isRegistered, loginMethodsFor } from '../../features/onboarding/model';
import { useOnboarding } from '../../features/onboarding/OnboardingProvider';
import { JoinApprovedScreen } from '../../features/onboarding/screens/JoinApprovedScreen';
import { LoginScreen } from '../../features/onboarding/screens/LoginScreen';
import { ProfileRegisterScreen } from '../../features/onboarding/screens/ProfileRegisterScreen';
import { TermsAgreementScreen } from '../../features/onboarding/screens/TermsAgreementScreen';
import { useAuth } from '../AuthProvider';
import { useFocusTitleOnOpen } from './routes';
import type { OnboardingScreenProps, RootScreenProps } from './types';

// 로그인·온보딩 화면들 (#85). 더미 로그인 상태(AuthProvider)와 온보딩 상태(OnboardingProvider)를 화면 props 로 이어 준다.
// 회사 찾기~거절은 마이 › 조직 참여(#73) 화면을 flow="onboarding" 으로 다시 쓴다.

// 보라 배경이라 로그인 화면이 보이는 동안만 상태 표시줄 글자를 흰색으로 둔다.
// 온보딩을 위에 쌓아도 로그인 화면은 아래에 남아 있으므로, 마운트가 아니라 포커스로 켜고 끈다
function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      const entry = StatusBar.pushStackEntry({ barStyle: 'light-content' });
      return () => StatusBar.popStackEntry(entry);
    }, []),
  );
}

export function LoginRoute({ navigation }: RootScreenProps<'Login'>) {
  const auth = useAuth();
  useLightStatusBar();

  return (
    <LoginScreen
      methods={loginMethodsFor(Platform.OS)}
      recentMethod={auth.lastMethod}
      onLogin={method => {
        // 가입한 계정이면 바로 메인으로 (루트가 화면 묶음을 바꾼다), 신규 사용자는 프로필 등록부터
        if (isRegistered(auth, method)) {
          auth.signIn(method);
        } else {
          navigation.navigate('Onboarding', { method });
        }
      }}
    />
  );
}

export function ProfileRegisterRoute({
  navigation,
}: OnboardingScreenProps<'ProfileRegister'>) {
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <ProfileRegisterScreen
      titleRef={titleRef}
      // 온보딩 첫 화면이라 뒤로 가면 루트의 로그인으로 돌아가 더미 로그인이 취소된다 (온보딩 상태도 사라진다)
      onBack={() => navigation.goBack()}
      // API 연동 때 PUT /api/v1/profiles/{accountId} 로 보낸다
      onSubmit={() => navigation.navigate('TermsAgreement')}
    />
  );
}

export function TermsAgreementRoute({
  navigation,
}: OnboardingScreenProps<'TermsAgreement'>) {
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <TermsAgreementScreen
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      // API 연동 때 POST /api/v1/profiles/{accountId}/terms-agreements, /marketing-consents 로 보낸다.
      // 소속이 없는 새 사용자라 회사 코드 입력으로 간다 (Spec_프로필 입력 화면)
      onSignUp={() => navigation.navigate('CompanyFind')}
    />
  );
}

export function CompanyFindRoute({
  navigation,
}: OnboardingScreenProps<'CompanyFind'>) {
  const { lookupCompany, requests } = useOnboarding();
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <OrgJoinScreen
      flow="onboarding"
      titleRef={titleRef}
      lookup={lookupCompany}
      onFound={organization => {
        // 찾는 동안 화면을 옮겼으면 늦게 온 결과로 데려가지 않는다
        if (navigation.isFocused()) {
          navigation.navigate('JoinRoleSelect', organization);
        }
      }}
      // 승인 대기에서 뒤로 왔다가 같은 회사를 다시 찾으면 그 요청의 승인 대기로 돌아간다
      onPending={organization => {
        const pending = requests.find(
          item =>
            item.organizationId === organization.organizationId &&
            item.status === 'PENDING',
        );
        if (pending && navigation.isFocused()) {
          navigation.navigate('JoinPending', { requestId: pending.requestId });
        }
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

export function JoinRoleSelectRoute({
  navigation,
  route,
}: OnboardingScreenProps<'JoinRoleSelect'>) {
  const { requestParticipation } = useOnboarding();
  const titleRef = useFocusTitleOnOpen(navigation);
  const organization = route.params;

  return (
    <RoleSelectScreen
      flow="onboarding"
      organizationName={organization.organizationName}
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onSubmit={desiredType => {
        const request = requestParticipation(organization, desiredType);
        // 역할 선택을 스택에서 빼고 승인 대기를 올린다. 뒤로 가면 같은 요청을 다시 보내는 화면 대신 회사 찾기로 간다
        navigation.dispatch(state => {
          const routes = state.routes.filter(
            item => item.name !== 'JoinRoleSelect',
          );
          return CommonActions.reset({
            ...state,
            routes: [
              ...routes,
              {
                key: `JoinPending-${request.requestId}`,
                name: 'JoinPending',
                params: { requestId: request.requestId },
              },
            ],
            index: routes.length,
          });
        });
      }}
    />
  );
}

// 없는 요청(잘못된 params)으로 열렸으면 빈 화면 대신 회사 찾기로 돌아간다
function useOnboardingRequest(
  requestId: string,
  navigation: OnboardingScreenProps<
    'JoinPending' | 'JoinApproved' | 'JoinRejected'
  >['navigation'],
): ParticipationRequest | undefined {
  const { requests } = useOnboarding();
  const request = requests.find(item => item.requestId === requestId);
  const missing = request === undefined;
  useEffect(() => {
    if (missing) {
      navigation.popTo('CompanyFind');
    }
  }, [missing, navigation]);
  return request;
}

export function JoinPendingRoute({
  navigation,
  route,
}: OnboardingScreenProps<'JoinPending'>) {
  const { cancelRequest, decideRequest } = useOnboarding();
  const request = useOnboardingRequest(route.params.requestId, navigation);
  const titleRef = useFocusTitleOnOpen(navigation);
  if (!request) {
    return null;
  }

  return (
    <JoinRequestedScreen
      flow="onboarding"
      request={request}
      titleRef={titleRef}
      // 더미: '확인' 을 누르면 사무실이 결정한 것으로 친다. 결과는 회사 코드로 정해 둔다 (decideParticipationMock).
      // 결과 화면이 승인 대기를 대신해, 뒤로 가면 회사 찾기로 간다
      onConfirm={() => {
        const decision = decideParticipationMock(request);
        decideRequest(request.requestId, decision);
        navigation.replace(
          decision.status === 'APPROVED' ? 'JoinApproved' : 'JoinRejected',
          { requestId: request.requestId },
        );
      }}
      onCancel={requestId => {
        cancelRequest(requestId);
        navigation.popTo('CompanyFind');
      }}
      onBack={() => navigation.goBack()}
    />
  );
}

export function JoinApprovedRoute({
  navigation,
  route,
}: OnboardingScreenProps<'JoinApproved'>) {
  const { method } = useOnboarding();
  const { completeOnboarding } = useAuth();
  const request = useOnboardingRequest(route.params.requestId, navigation);
  const titleRef = useFocusTitleOnOpen(navigation);
  if (!request) {
    return null;
  }

  return (
    <JoinApprovedScreen
      request={request}
      titleRef={titleRef}
      // 로그인 상태가 되면 루트가 로그인·온보딩을 메인으로 바꾼다. 뒤로 가기로 온보딩에 돌아갈 수 없다
      onStart={() => completeOnboarding(method)}
      onBack={() => navigation.goBack()}
    />
  );
}

export function JoinRejectedRoute({
  navigation,
  route,
}: OnboardingScreenProps<'JoinRejected'>) {
  const request = useOnboardingRequest(route.params.requestId, navigation);
  const titleRef = useFocusTitleOnOpen(navigation);
  if (!request) {
    return null;
  }

  return (
    <JoinRejectedScreen
      flow="onboarding"
      request={request}
      titleRef={titleRef}
      // 같은 회사 코드로 다시 요청할 수 있게 회사 찾기로 돌아간다
      onConfirm={() => navigation.popTo('CompanyFind')}
      onBack={() => navigation.goBack()}
    />
  );
}
