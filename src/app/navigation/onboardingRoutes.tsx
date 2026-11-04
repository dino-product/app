import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { Alert, BackHandler, Platform, StatusBar } from 'react-native';
import type { ProfileInput } from '../../features/my/model';
import { decideParticipationMock } from '../../features/my/org/mockData';
import type {
  Organization,
  ParticipationRequest,
} from '../../features/my/org/model';
import { JoinRejectedScreen } from '../../features/my/org/screens/JoinRejectedScreen';
import { JoinRequestedScreen } from '../../features/my/org/screens/JoinRequestedScreen';
import { OrgJoinScreen } from '../../features/my/org/screens/OrgJoinScreen';
import { RoleSelectScreen } from '../../features/my/org/screens/RoleSelectScreen';
import {
  loginMethodsFor,
  type TermsAgreement,
} from '../../features/onboarding/model';
import { useOnboarding } from '../../features/onboarding/OnboardingProvider';
import {
  agreeToTerms,
  ProfileErrorCode,
  saveProfile,
} from '../../features/onboarding/profileApi';
import { JoinApprovedScreen } from '../../features/onboarding/screens/JoinApprovedScreen';
import { LoginScreen } from '../../features/onboarding/screens/LoginScreen';
import { ProfileRegisterScreen } from '../../features/onboarding/screens/ProfileRegisterScreen';
import { TermsAgreementScreen } from '../../features/onboarding/screens/TermsAgreementScreen';
import { isApiError, useApiClient } from '../../shared/api';
import { useAuth } from '../AuthProvider';
import { useFocusTitleOnOpen } from './routes';
import type { OnboardingScreenProps } from './types';

// 로그인·가입 단계 화면들 (#85, #113). 로그인 상태(AuthProvider)와 온보딩 상태(OnboardingProvider)를 화면 props 로 이어 준다.
// 프로필 등록·약관 동의는 서버에 저장하고, 그 응답(프로필)으로 가입 단계를 바꾼다.
// 회사 찾기~거절은 마이 › 조직 참여(#73) 화면을 flow="onboarding" 으로 다시 쓴다 (아직 목, #116).
// 실패 안내 문구는 Figma 에 없어 기본안이다 (Figma 미확인)

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

export function LoginRoute() {
  const { logIn, recentMethod } = useAuth();
  useLightStatusBar();

  return (
    <LoginScreen
      methods={loginMethodsFor(Platform.OS)}
      recentMethod={recentMethod}
      // 로그인하면 루트가 가입 단계(nextStep) 또는 메인으로 화면 묶음을 바꾼다. 진행 중에 다시 눌러도 겹치지 않는다
      onLogin={async method => {
        if ((await logIn(method)) === 'failed') {
          Alert.alert('로그인하지 못했어요', '잠시 후 다시 시도해 주세요.');
        }
      }}
    />
  );
}

// 가입 단계 첫 화면에서 Android 뒤로가기는 가입을 그만두고 로그아웃한다 (돌아갈 화면이 없어 앱을 나가지 않게)
function useBackToLogin(signOut: () => Promise<void>) {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          signOut();
          return true;
        },
      );
      return () => subscription.remove();
    }, [signOut]),
  );
}

const profileSaveFailure = (error: unknown): [string, string] =>
  // 서버는 어느 칸이 틀렸는지 알려 주지 않는다 (앱도 같은 규칙으로 미리 막는다)
  isApiError(error, ProfileErrorCode.invalidInput)
    ? [
        '입력한 정보를 확인해 주세요',
        '이름은 한글·영문 2~20자, 연락처는 010으로 시작하는 11자리로 입력해 주세요.',
      ]
    : ['프로필을 저장하지 못했어요', '잠시 후 다시 시도해 주세요.'];

export function ProfileRegisterRoute({
  navigation,
}: OnboardingScreenProps<'ProfileRegister'>) {
  const api = useApiClient();
  const { profile, updateProfile, signOut } = useAuth();
  const titleRef = useFocusTitleOnOpen(navigation);
  useBackToLogin(signOut);
  const save = useMutation({
    mutationFn: ({
      accountId,
      input,
    }: {
      accountId: number;
      input: ProfileInput;
    }) => saveProfile(api, accountId, input),
  });
  if (!profile) {
    return null;
  }

  return (
    <ProfileRegisterScreen
      titleRef={titleRef}
      // 가입을 마치지 않고 다시 로그인했으면 입력해 둔 값으로 채운다
      initialProfile={
        profile.name !== null && profile.phoneNumber !== null
          ? { name: profile.name, phoneNumber: profile.phoneNumber }
          : undefined
      }
      submitting={save.isPending}
      // 가입 단계 첫 화면이라 뒤로 가면 가입을 그만두고 로그아웃한다 (로그인 화면)
      onBack={() => {
        signOut();
      }}
      onSubmit={input =>
        save.mutate(
          { accountId: profile.accountId, input },
          {
            onSuccess: saved => {
              updateProfile(saved);
              navigation.navigate('TermsAgreement');
            },
            onError: error => Alert.alert(...profileSaveFailure(error)),
          },
        )
      }
    />
  );
}

export function TermsAgreementRoute({
  navigation,
}: OnboardingScreenProps<'TermsAgreement'>) {
  const api = useApiClient();
  const { profile, agreedToTerms } = useAuth();
  const titleRef = useFocusTitleOnOpen(navigation);
  const agree = useMutation({
    mutationFn: ({
      accountId,
      agreement,
    }: {
      accountId: number;
      agreement: TermsAgreement;
    }) => agreeToTerms(api, accountId, agreement),
  });
  if (!profile) {
    return null;
  }
  // 가입을 마친 계정이 약관 개정으로 다시 동의하는 경우(PROFILE-005)는 회사 참여 없이 메인으로 돌아간다
  const firstSignUp = profile.status !== 'ACTIVE';

  return (
    <TermsAgreementScreen
      titleRef={titleRef}
      submitting={agree.isPending}
      onBack={() => navigation.goBack()}
      onSignUp={agreement =>
        agree.mutate(
          { accountId: profile.accountId, agreement },
          {
            onSuccess: saved => {
              agreedToTerms(saved, firstSignUp);
              // 소속이 없는 새 사용자라 회사 코드 입력으로 간다 (Spec_프로필 입력 화면)
              if (firstSignUp) {
                navigation.navigate('CompanyFind');
              }
            },
            onError: () =>
              Alert.alert('가입하지 못했어요', '잠시 후 다시 시도해 주세요.'),
          },
        )
      }
    />
  );
}

export function CompanyFindRoute({
  navigation,
}: OnboardingScreenProps<'CompanyFind'>) {
  const { lookupCompany, requests } = useOnboarding();
  const titleRef = useFocusTitleOnOpen(navigation);
  const requestOf = (
    organization: Organization,
    status: ParticipationRequest['status'],
  ) =>
    requests.find(
      item =>
        item.organizationId === organization.organizationId &&
        item.status === status,
    );

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
      // 승인 대기·참여 완료에서 뒤로 왔다가 같은 회사를 다시 찾으면 그 요청의 화면으로 돌아간다.
      // 알림만 띄우면 '시작하기' 로 갈 길이 없어진다
      onPending={organization => {
        const request = requestOf(organization, 'PENDING');
        if (request && navigation.isFocused()) {
          navigation.navigate('JoinPending', { requestId: request.requestId });
        }
      }}
      onAlreadyMember={organization => {
        const request = requestOf(organization, 'APPROVED');
        if (request && navigation.isFocused()) {
          navigation.navigate('JoinApproved', {
            requestId: request.requestId,
          });
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
      // 가입 단계를 마치면 루트가 온보딩을 메인으로 바꾼다. 뒤로 가기로 온보딩에 돌아갈 수 없다
      onStart={completeOnboarding}
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
