import {
  CommonActions,
  StackActions,
  useFocusEffect,
  useIsFocused,
} from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, BackHandler, Platform } from 'react-native';
import type { ProfileInput } from '../../features/my/model';
import {
  latestRequestOf,
  type ParticipationStatus,
} from '../../features/my/org/model';
import { useFetchParticipationRequests } from '../../features/my/org/participationQueries';
import { JoinRejectedScreen } from '../../features/my/org/screens/JoinRejectedScreen';
import { JoinRequestedScreen } from '../../features/my/org/screens/JoinRequestedScreen';
import { OrgJoinScreen } from '../../features/my/org/screens/OrgJoinScreen';
import { QrScanScreen } from '../../features/my/org/screens/QrScanScreen';
import { RoleSelectScreen } from '../../features/my/org/screens/RoleSelectScreen';
import type { CompanyCheckHandlers } from '../../features/my/org/useCompanyCheck';
import {
  loginMethodsFor,
  type TermsAgreement,
} from '../../features/onboarding/model';
import {
  agreeToTerms,
  currentAccountId,
  fetchProfile,
  ProfileErrorCode,
  saveProfile,
  type NextStep,
} from '../../features/onboarding/profileApi';
import { JoinApprovedScreen } from '../../features/onboarding/screens/JoinApprovedScreen';
import { LoginScreen } from '../../features/onboarding/screens/LoginScreen';
import { ProfileRegisterScreen } from '../../features/onboarding/screens/ProfileRegisterScreen';
import { TermsAgreementScreen } from '../../features/onboarding/screens/TermsAgreementScreen';
import { isApiError, useApiClient } from '../../shared/api';
import { useLightStatusBar } from '../../shared/layout/useLightStatusBar';
import { useAccountProfile, useAuth } from '../AuthProvider';
import { ParticipationRequestGate } from './orgRoutes';
import { useFocusTitleOnOpen } from './routes';
import type { OnboardingScreenProps, OnboardingStackParamList } from './types';

// 로그인·가입 단계 화면들 (#85, #113). 로그인 상태(AuthProvider)를 화면 props 로 이어 준다.
// 프로필 등록·약관 동의는 서버에 저장하고, 그 응답(프로필)으로 가입 단계를 바꾼다.
// 회사 찾기~거절은 마이 › 조직 참여(#73) 화면을 flow="onboarding" 으로 다시 쓰고, 같은 회사 참여 API 로 동작한다 (#116).
// 참여 결과(참여 완료·거절) 화면은 서버 신청 현황의 상태로 정한다.
// 실패 안내 문구는 Figma 에 없어 기본안이다 (Figma 미확인)

export function LoginRoute() {
  const { logIn, recentMethod } = useAuth();
  // 보라 배경이라 로그인 화면이 보이는 동안만 상태 표시줄 글자를 흰색으로 둔다 (위에 온보딩을 쌓아도 아래에 남는다)
  useLightStatusBar(useIsFocused());

  return (
    <LoginScreen
      methods={loginMethodsFor(Platform.OS)}
      recentMethod={recentMethod}
      // 로그인하면 루트가 가입 단계(nextStep) 또는 메인으로 화면 묶음을 바꾼다. 진행 중에 다시 눌러도 겹치지 않는다
      onLogin={method => {
        logIn(method).then(outcome => {
          if (outcome === 'failed') {
            Alert.alert('로그인하지 못했어요', '잠시 후 다시 시도해 주세요.');
          }
        });
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

// 켠 뒤 뒤에서 확인한 가입 단계가 마지막 값과 달라지면(다른 기기에서 진행 등) 가입 단계 안에서 그 화면으로 옮긴다.
// 처음 그릴 때는 부르지 않는다 (그때는 루트가 마지막 단계로 연다)
function useStepChanged(
  onChange: (previous: NextStep | null, next: NextStep | null) => void,
) {
  const { nextStep } = useAuth();
  const shown = useRef(nextStep);
  useEffect(() => {
    const previous = shown.current;
    shown.current = nextStep;
    if (previous !== nextStep) {
      onChange(previous, nextStep);
    }
  }, [nextStep, onChange]);
}

export function ProfileRegisterRoute({
  navigation,
}: OnboardingScreenProps<'ProfileRegister'>) {
  const api = useApiClient();
  const { updateProfile, signOut } = useAuth();
  const profile = useAccountProfile();
  const titleRef = useFocusTitleOnOpen(navigation);
  useBackToLogin(signOut);
  useStepChanged(
    useCallback(
      (previous, next) => {
        if (
          previous === 'PROFILE' &&
          next === 'TERMS' &&
          navigation.isFocused()
        ) {
          navigation.navigate('TermsAgreement');
        }
      },
      [navigation],
    ),
  );
  // 본인 accountId 는 기기 세션에서 읽는다 (켠 직후 서버 확인 전에도 저장할 수 있다)
  const save = useMutation({
    mutationFn: async (input: ProfileInput) =>
      saveProfile(api, await currentAccountId(api), input),
  });
  // 가입을 마치지 않고 다시 로그인했으면 서버에 입력해 둔 값으로 채운다. 켠 직후 늦게 오면 화면이 고치지 않았을 때만 채운다
  const name = profile?.name;
  const phoneNumber = profile?.phoneNumber;
  const entered = useMemo(
    () => (name && phoneNumber ? { name, phoneNumber } : undefined),
    [name, phoneNumber],
  );

  return (
    <ProfileRegisterScreen
      titleRef={titleRef}
      initialProfile={entered}
      submitting={save.isPending}
      // 가입 단계 첫 화면이라 뒤로 가면 가입을 그만두고 로그아웃한다 (로그인 화면)
      onBack={() => {
        signOut();
      }}
      onSubmit={input =>
        save.mutate(input, {
          onSuccess: saved => {
            updateProfile(saved);
            navigation.navigate('TermsAgreement');
          },
          onError: error => Alert.alert(...profileSaveFailure(error)),
        })
      }
    />
  );
}

export function TermsAgreementRoute({
  navigation,
}: OnboardingScreenProps<'TermsAgreement'>) {
  const api = useApiClient();
  const { agreedToTerms } = useAuth();
  const profile = useAccountProfile();
  const titleRef = useFocusTitleOnOpen(navigation);
  useStepChanged(
    useCallback(
      (previous, next) => {
        if (
          previous === 'TERMS' &&
          next === 'PROFILE' &&
          navigation.isFocused()
        ) {
          navigation.popTo('ProfileRegister');
        }
      },
      [navigation],
    ),
  );
  // 가입을 마친 계정이 약관 개정으로 다시 동의하는 경우(PROFILE-005)는 회사 참여 없이 메인으로 돌아간다.
  // 첫 가입인지는 서버 프로필의 가입 시각(signedUpAt)으로 본다. 켠 직후 확인에 실패해 모르면 보내기 전에 받는다
  const agree = useMutation({
    mutationFn: async (agreement: TermsAgreement) => {
      const accountId = await currentAccountId(api);
      const before = profile ?? (await fetchProfile(api, accountId));
      const saved = await agreeToTerms(api, accountId, agreement);
      return { saved, firstSignUp: before.signedUpAt === null };
    },
  });

  return (
    <TermsAgreementScreen
      titleRef={titleRef}
      // 재동의면 서버에 남은 마케팅 동의로 미리 켜 둔다. 건드리지 않으면 그 값을 보낸다
      initialMarketing={profile?.marketingAgreed ?? undefined}
      submitting={agree.isPending}
      onBack={() => navigation.goBack()}
      onSignUp={agreement =>
        agree.mutate(agreement, {
          onSuccess: ({ saved, firstSignUp }) => {
            agreedToTerms(saved, firstSignUp);
            // 소속이 없는 새 사용자라 회사 코드 입력으로 간다 (Spec_프로필 입력 화면)
            if (firstSignUp) {
              navigation.navigate('CompanyFind');
            }
          },
          onError: () =>
            Alert.alert('가입하지 못했어요', '잠시 후 다시 시도해 주세요.'),
        })
      }
    />
  );
}

type FoundScreen = 'JoinRoleSelect' | 'JoinPending' | 'JoinApproved';

/**
 * 회사 찾기(코드 입력·QR 인식, #108)의 회사 확인 결과로 갈 곳. 찾음 → 역할 선택,
 * 승인 대기·참여 완료에서 뒤로 왔다가 같은 회사를 다시 찾음 → 그 요청의 화면 (알림만 띄우면 '시작하기' 로 갈 길이 없어진다).
 * replace: QR 인식은 카메라로 돌아오지 않게 자기 자리를 결과 화면으로 바꾼다. 뒤로 가면 회사 찾기로 간다
 */
function useCompanyFound(
  navigation: OnboardingScreenProps<
    'CompanyFind' | 'CompanyQrScan'
  >['navigation'],
  { replace }: { replace: boolean },
): CompanyCheckHandlers {
  const fetchRequests = useFetchParticipationRequests();
  // 찾는 동안 화면을 옮겼으면 늦게 온 결과로 데려가지 않는다
  const open = <Name extends FoundScreen>(
    name: Name,
    params: OnboardingStackParamList[Name],
  ) => {
    if (navigation.isFocused()) {
      navigation.dispatch(
        replace
          ? StackActions.replace(name, params)
          : CommonActions.navigate(name, params),
      );
    }
  };

  return {
    onFound: target => open('JoinRoleSelect', target),
    onPending: (_, requestId) => open('JoinPending', { requestId }),
    // 서버는 이미 참여 중이라고만 알려 준다. 신청 현황에서 그 회사의 승인 요청을 찾아 참여 완료로 간다.
    // 없거나 신청 현황을 받지 못하면 화면이 '이미 참여 중인 회사예요' 를 알린다 (회사 확인 자체는 성공했다)
    onAlreadyMember: async organization => {
      const approved = await fetchRequests().then(
        requests =>
          latestRequestOf(requests, organization.organizationId, 'APPROVED'),
        () => undefined,
      );
      if (approved) {
        open('JoinApproved', { requestId: approved.requestId });
      }
      return approved !== undefined;
    },
  };
}

export function CompanyFindRoute({
  navigation,
}: OnboardingScreenProps<'CompanyFind'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const screenFocused = useIsFocused();
  const found = useCompanyFound(navigation, { replace: false });

  return (
    <OrgJoinScreen
      flow="onboarding"
      titleRef={titleRef}
      screenFocused={screenFocused}
      {...found}
      onScanQr={() => navigation.navigate('CompanyQrScan')}
      onBack={() => navigation.goBack()}
    />
  );
}

export function CompanyQrScanRoute({
  navigation,
}: OnboardingScreenProps<'CompanyQrScan'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const focused = useIsFocused();
  const found = useCompanyFound(navigation, { replace: true });

  return (
    <QrScanScreen
      focused={focused}
      titleRef={titleRef}
      {...found}
      onClose={() => navigation.goBack()}
    />
  );
}

type JoinResultScreen = 'JoinPending' | 'JoinApproved';

// 역할 선택을 스택에서 빼고 그 요청의 화면을 올린다. 뒤로 가면 같은 요청을 다시 보내는 화면 대신 회사 찾기로 간다
function replaceRoleSelect(
  navigation: OnboardingScreenProps<'JoinRoleSelect'>['navigation'],
  name: JoinResultScreen,
  params: OnboardingStackParamList[JoinResultScreen],
) {
  navigation.dispatch(state => {
    const routes = state.routes.filter(item => item.name !== 'JoinRoleSelect');
    return CommonActions.reset({
      ...state,
      routes: [...routes, { key: `${name}-${params.requestId}`, name, params }],
      index: routes.length,
    });
  });
}

export function JoinRoleSelectRoute({
  navigation,
  route,
}: OnboardingScreenProps<'JoinRoleSelect'>) {
  const fetchRequests = useFetchParticipationRequests();
  const titleRef = useFocusTitleOnOpen(navigation);
  const screenFocused = useIsFocused();
  const target = route.params;
  // 서버가 이미 참여 중·승인 대기 요청이 있다고 거절했다(안내는 화면이 띄웠다). 신청 현황에서 그 회사의 요청을 찾아 그 화면으로 간다.
  // 찾지 못하면(신청 현황을 받지 못함 포함) 회사 찾기로 돌아가 다시 확인하게 한다. 받는 동안 화면은 버튼을 잠근다.
  // 받는 사이 다른 화면으로 옮겼으면(뒤로 가기 등) 늦게 온 결과로 데려가지 않는다
  const showLatest = async (
    status: ParticipationStatus,
    name: JoinResultScreen,
  ) => {
    const found = await fetchRequests().then(
      requests => latestRequestOf(requests, target.organizationId, status),
      () => undefined,
    );
    if (!navigation.isFocused()) {
      return;
    }
    if (found) {
      replaceRoleSelect(navigation, name, { requestId: found.requestId });
    } else {
      navigation.popTo('CompanyFind');
    }
  };

  return (
    <RoleSelectScreen
      flow="onboarding"
      target={target}
      titleRef={titleRef}
      screenFocused={screenFocused}
      onBack={() => navigation.goBack()}
      onRequested={request =>
        replaceRoleSelect(navigation, 'JoinPending', {
          requestId: request.requestId,
          requestChannel: request.requestChannel,
        })
      }
      onAlreadyMember={() => showLatest('APPROVED', 'JoinApproved')}
      onPendingExists={() => showLatest('PENDING', 'JoinPending')}
    />
  );
}

// 없는 요청(잘못된 params·서버에서 사라짐)으로 열렸으면 빈 화면 대신 회사 찾기로 돌아간다
function useBackToCompanyFind(
  navigation: OnboardingScreenProps<
    'JoinPending' | 'JoinApproved' | 'JoinRejected'
  >['navigation'],
) {
  return useCallback(() => navigation.popTo('CompanyFind'), [navigation]);
}

export function JoinPendingRoute({
  navigation,
  route,
}: OnboardingScreenProps<'JoinPending'>) {
  const { completeOnboarding } = useAuth();
  const fetchRequests = useFetchParticipationRequests();
  const titleRef = useFocusTitleOnOpen(navigation);
  const backToCompanyFind = useBackToCompanyFind(navigation);
  const { requestId, requestChannel } = route.params;
  // '확인' 은 서버 신청 현황에서 사무실의 결정을 확인해 그 결과 화면으로 간다. 결과 화면이 승인 대기를 대신해, 뒤로 가면 회사 찾기로 간다.
  // 아직 검토 중이면 가입을 마치고 메인으로 간다. 결과는 알림으로 온다 ('사무실에서 요청을 확인하면 알려드릴게요')
  const showDecision = async () => {
    const request = (await fetchRequests()).find(
      item => item.requestId === requestId,
    );
    if (!navigation.isFocused()) {
      return;
    }
    switch (request?.status) {
      case 'APPROVED':
        navigation.replace('JoinApproved', { requestId });
        break;
      case 'REJECTED':
        navigation.replace('JoinRejected', { requestId });
        break;
      case 'PENDING':
        completeOnboarding();
        break;
      default:
        // 취소됐거나 사라진 요청
        backToCompanyFind();
    }
  };

  return (
    <ParticipationRequestGate
      requestId={requestId}
      flow="onboarding"
      title="승인 대기"
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onMissing={backToCompanyFind}
    >
      {request => (
        <JoinRequestedScreen
          flow="onboarding"
          // 서버는 요청 경로를 돌려주지 않아 보낸 화면이 넘긴 값을 쓴다
          request={{ ...request, requestChannel }}
          titleRef={titleRef}
          onConfirm={showDecision}
          onCanceled={backToCompanyFind}
          // 취소하려던 사이 사무실이 결정했다. 그 결과 화면으로 간다 (확인하지 못하면 회사 찾기에서 다시 확인한다)
          onAlreadyDecided={() => {
            showDecision().catch(backToCompanyFind);
          }}
          onBack={() => navigation.goBack()}
        />
      )}
    </ParticipationRequestGate>
  );
}

export function JoinApprovedRoute({
  navigation,
  route,
}: OnboardingScreenProps<'JoinApproved'>) {
  const { completeOnboarding } = useAuth();
  const titleRef = useFocusTitleOnOpen(navigation);
  const backToCompanyFind = useBackToCompanyFind(navigation);

  return (
    <ParticipationRequestGate
      requestId={route.params.requestId}
      status="APPROVED"
      flow="onboarding"
      title="참여 완료"
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onMissing={backToCompanyFind}
    >
      {request => (
        <JoinApprovedScreen
          request={request}
          titleRef={titleRef}
          // 가입 단계를 마치면 루트가 온보딩을 메인으로 바꾼다. 뒤로 가기로 온보딩에 돌아갈 수 없다
          onStart={completeOnboarding}
          onBack={() => navigation.goBack()}
        />
      )}
    </ParticipationRequestGate>
  );
}

export function JoinRejectedRoute({
  navigation,
  route,
}: OnboardingScreenProps<'JoinRejected'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const backToCompanyFind = useBackToCompanyFind(navigation);

  return (
    <ParticipationRequestGate
      requestId={route.params.requestId}
      status="REJECTED"
      flow="onboarding"
      title="참여 요청 결과"
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onMissing={backToCompanyFind}
    >
      {request => (
        <JoinRejectedScreen
          flow="onboarding"
          request={request}
          titleRef={titleRef}
          // 같은 회사 코드로 다시 요청할 수 있게 회사 찾기로 돌아간다
          onConfirm={backToCompanyFind}
          onBack={() => navigation.goBack()}
        />
      )}
    </ParticipationRequestGate>
  );
}
