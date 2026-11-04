import {
  useIsFocused,
  usePreventRemove,
  useScrollToTop,
  type ParamListBase,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import type { ScrollViewInstance } from 'react-native';
import type {
  NotificationTarget,
  WithdrawalBlockReason,
} from '../../features/my/model';
import { useMyMemberships, useMyProfile } from '../../features/my/myQueries';
import { countPendingRequests } from '../../features/my/org/model';
import { useParticipationRequests } from '../../features/my/org/participationQueries';
import { AccountScreen } from '../../features/my/screens/AccountScreen';
import { MyPageScreen } from '../../features/my/screens/MyPageScreen';
import { NotificationCenterScreen } from '../../features/my/screens/NotificationCenterScreen';
import { NotificationSettingsScreen } from '../../features/my/screens/NotificationSettingsScreen';
import { ProfileEditScreen } from '../../features/my/screens/ProfileEditScreen';
import { TermsScreen } from '../../features/my/screens/TermsScreen';
import { WithdrawalBlockedScreen } from '../../features/my/screens/WithdrawalBlockedScreen';
import { WithdrawalScreen } from '../../features/my/screens/WithdrawalScreen';
import { termsLinks } from '../../features/my/termsLinks';
import {
  withdrawalEligibilityQuery,
  withdrawalMutationKey,
} from '../../features/my/withdrawalApi';
import { workDetailQuery } from '../../features/work/data/queries';
import type { WorkStatusCode } from '../../features/work/data/status';
import { useWorkRepository } from '../../features/work/data/WorkRepositoryProvider';
import { useApiClient } from '../../shared/api';
import { APP_VERSION } from '../appVersion';
import { useAuth } from '../AuthProvider';
import { openWebPage } from '../externalLinks';
import { useFocusTitleOnOpen } from './routes';
import {
  HOME_INITIAL_ROUTE,
  type HomeScreenProps,
  type MyScreenProps,
} from './types';

// 마이 탭 스택에 올리는 화면들 (#72). 앱 상태를 화면 props 로 이어 준다.
// 프로필·소속 발주사·탈퇴는 서버 API 다 (#115). 마이페이지는 경로가 조회해 넘기고, 하위 화면은 화면이 직접 받는다

export function MyPageRoute({ navigation }: MyScreenProps<'MyPage'>) {
  // '신청 현황' 배지는 서버 신청 현황의 승인 대기 건수다 (#116). 받기 전·받지 못했으면 배지를 두지 않는다
  const { data: pendingRequestCount = 0 } =
    useParticipationRequests(countPendingRequests);
  // 마이페이지에서 마이 탭을 다시 누르면 맨 위로 올린다 (iOS 관례)
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  // 하위 화면·다른 탭에 가 있는 동안은 프로필·소속을 구독하지 않는다 (돌아오면 오래된 값만 다시 받는다).
  // 경로는 포커스가 바뀔 때 다시 그려지지만, 화면(memo)에 주는 값이 같으면 화면은 다시 그리지 않는다
  const subscribed = useIsFocused();
  const profile = useMyProfile({ subscribed });
  const memberships = useMyMemberships({ subscribed });
  const open = useMemo(
    () => ({
      onOpenNotifications: () => navigation.navigate('NotificationCenter'),
      onEditProfile: () => navigation.navigate('ProfileEdit'),
      onOpenRequestStatus: () => navigation.navigate('OrgJoinRequests'),
      onJoinOrganization: () => navigation.navigate('OrgJoin'),
      onOpenNotificationSettings: () =>
        navigation.navigate('NotificationSettings'),
      onOpenTerms: () => navigation.navigate('Terms'),
      onOpenAccount: () => navigation.navigate('Account'),
    }),
    [navigation],
  );

  return (
    <MyPageScreen
      profile={profile}
      memberships={memberships}
      pendingRequestCount={pendingRequestCount}
      {...open}
      scrollRef={scrollRef}
    />
  );
}

export function ProfileEditRoute({ navigation }: MyScreenProps<'ProfileEdit'>) {
  const { updateProfile } = useAuth();
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <ProfileEditScreen
      titleRef={titleRef}
      // 저장에 성공하면 화면이 이것으로 돌아온다
      onBack={() => navigation.goBack()}
      // 서버가 돌려준 프로필로 로그인 상태의 프로필과 프로필 캐시(마이페이지)를 바꾼다. 저장 중에 화면을 떠났어도 부른다
      onSaved={updateProfile}
    />
  );
}

export function NotificationSettingsRoute({
  navigation,
}: MyScreenProps<'NotificationSettings'>) {
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <NotificationSettingsScreen
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
    />
  );
}

// 알림센터는 마이페이지의 종(마이 탭 스택)과 내 작업 홈의 종(홈 탭 스택, #96)에서 연다. 알림 목록(서버, #117)은 같다
function NotificationCenterContent({
  navigation,
  open,
}: {
  navigation: Pick<
    NativeStackNavigationProp<ParamListBase>,
    'addListener' | 'goBack'
  >;
  /** 작업·참여 거절 알림을 눌렀을 때. 행이 memo 라 렌더마다 새로 만들지 않는 함수를 넘긴다 */
  open: (target: NotificationTarget) => void;
}) {
  const titleRef = useFocusTitleOnOpen(navigation);
  // 위에 연 화면(작업 상세 등)을 닫고 돌아오면 목록을 다시 받는다
  const focused = useIsFocused();

  return (
    <NotificationCenterScreen
      focused={focused}
      titleRef={titleRef}
      onOpen={open}
      onBack={() => navigation.goBack()}
    />
  );
}

type WorkTarget = Extract<NotificationTarget, { kind: 'work' }>;

// 작업 상세는 홈 탭 스택에 있다. id 는 작업 id, 알림이 생긴 발주사도 같이 넘긴다
const workDetailParams = ({ organizationId, workId }: WorkTarget) => ({
  id: workId,
  organizationId,
});

/**
 * 작업 알림을 연다. 수락 대기(배정됨) 작업은 수락·거절하는 요청 상세로, 나머지는 작업 상세로 간다 (홈의 작업 열기와 같은 규칙).
 * 알림에는 작업 상태가 없어 상세를 먼저 받아 고른다. 작업 상세는 같은 캐시 키(작업·발주사)라 받은 상세로 바로 그린다
 * (요청 상세는 발주사 없는 키라 다시 받는다).
 * 미리 받기는 다시 시도하지 않는다. 받지 못하면(볼 수 없는 작업·네트워크) 작업 상세가 그 상태와 다시 시도를 보인다.
 * 받는 동안 다시 누르면 무시하고, 그사이 다른 화면으로 갔으면 열지 않는다
 */
function useOpenNotificationWork({
  isFocused,
  openRequest,
  openDetail,
}: {
  isFocused: () => boolean;
  openRequest: (id: string) => void;
  openDetail: (target: WorkTarget) => void;
}) {
  const repository = useWorkRepository();
  const queryClient = useQueryClient();
  const opening = useRef(false);
  return useCallback(
    async (target: WorkTarget) => {
      if (opening.current) {
        return;
      }
      opening.current = true;
      let status: WorkStatusCode | undefined;
      try {
        const work = await queryClient.fetchQuery({
          ...workDetailQuery(
            repository,
            Number(target.workId),
            Number(target.organizationId),
          ),
          retry: false,
        });
        status = work.workStatus;
      } catch {
        // 실패 이유는 작업 상세가 보인다
      } finally {
        opening.current = false;
      }
      if (!isFocused()) {
        return;
      }
      if (status === 'PENDING_ACCEPT') {
        openRequest(target.workId);
      } else {
        openDetail(target);
      }
    },
    [isFocused, openDetail, openRequest, queryClient, repository],
  );
}

export function NotificationCenterRoute({
  navigation,
}: MyScreenProps<'NotificationCenter'>) {
  // 작업 알림은 홈 탭의 작업 상세(그 아래는 내 작업 홈) 또는 요청 상세를 연다. 참여 거절 알림은 거절 화면을 연다 (#73)
  const openWork = useOpenNotificationWork({
    isFocused: navigation.isFocused,
    openRequest: useCallback(
      (id: string) => navigation.navigate('RequestDetail', { id }),
      [navigation],
    ),
    openDetail: useCallback(
      (target: WorkTarget) =>
        navigation.navigate('home', {
          screen: 'WorkDetail',
          params: workDetailParams(target),
          initial: false,
        }),
      [navigation],
    ),
  });
  const open = useCallback(
    (target: NotificationTarget) => {
      if (target.kind === 'work') {
        openWork(target);
      } else {
        navigation.navigate('OrgJoinRejected', {
          requestId: target.requestId,
        });
      }
    },
    [navigation, openWork],
  );

  return <NotificationCenterContent navigation={navigation} open={open} />;
}

// 내 작업 홈의 종으로 연 알림센터 (#96). 홈 탭 스택에 쌓아 뒤로 가면(뒤로 가기·스와이프·Android 뒤로가기) 홈으로 돌아온다.
// 작업 알림은 같은 스택에 작업 상세를 쌓는다(수락 대기면 요청 상세). 참여 거절 화면은 마이 탭 스택에 있어 마이 탭에서 연다 (그 아래는 마이페이지)
export function HomeNotificationCenterRoute({
  navigation,
}: HomeScreenProps<'NotificationCenter'>) {
  const openWork = useOpenNotificationWork({
    isFocused: navigation.isFocused,
    openRequest: useCallback(
      (id: string) => navigation.navigate('RequestDetail', { id }),
      [navigation],
    ),
    openDetail: useCallback(
      (target: WorkTarget) =>
        navigation.navigate('WorkDetail', workDetailParams(target)),
      [navigation],
    ),
  });
  const open = useCallback(
    (target: NotificationTarget) => {
      if (target.kind === 'work') {
        openWork(target);
      } else {
        navigation.navigate('my', {
          screen: 'OrgJoinRejected',
          params: { requestId: target.requestId },
          initial: false,
        });
      }
    },
    [navigation, openWork],
  );

  return <NotificationCenterContent navigation={navigation} open={open} />;
}

export function TermsRoute({ navigation }: MyScreenProps<'Terms'>) {
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <TermsScreen
      links={termsLinks}
      appVersion={APP_VERSION}
      titleRef={titleRef}
      onOpenLink={openWebPage}
      onBack={() => navigation.goBack()}
    />
  );
}

export function AccountRoute({ navigation }: MyScreenProps<'Account'>) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const titleRef = useFocusTitleOnOpen(navigation);
  const { signOut } = useAuth();
  // 탈퇴를 누른 때마다 서버에 새로 묻는다. 받은 결과는 탈퇴 불가 화면이 그대로 쓴다
  const checkWithdrawal = useCallback(
    () =>
      queryClient.fetchQuery({
        ...withdrawalEligibilityQuery(api),
        staleTime: 0,
      }),
    [api, queryClient],
  );

  return (
    <AccountScreen
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      // POST /api/v1/auth/logout 을 부르고(실패해도) 기기 세션·캐시를 지운다 (#113).
      // 로그아웃 상태가 되면 루트가 메인을 로그인 화면으로 바꾼다. 탭이 사라져 화면 상태도 처음으로 돌아간다
      onLogout={signOut}
      // GET /api/v1/profiles/{accountId}/withdrawal-eligibility
      checkWithdrawal={checkWithdrawal}
      // 확인하는 동안 다른 탭으로 옮겼으면 늦게 온 결과로 데려가지 않는다
      onOpenWithdrawal={() => {
        if (navigation.isFocused()) {
          navigation.navigate('Withdrawal');
        }
      }}
      // 탈퇴 불가 화면은 방금 받은 사유를 캐시에서 읽고, 다시 보일 때마다 새로 묻는다
      onOpenWithdrawalBlocked={() => {
        if (navigation.isFocused()) {
          navigation.navigate('WithdrawalBlocked');
        }
      }}
    />
  );
}

export function WithdrawalRoute({ navigation }: MyScreenProps<'Withdrawal'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const { withdraw } = useAuth();
  // 탈퇴 요청을 보내는 동안에는 화면을 닫지 않는다 (머리 뒤로 가기·Android 뒤로가기·iOS 스와이프·마이 탭 다시 누르기).
  // 결과(로그인 화면 또는 탈퇴 불가·실패 안내)는 이 화면에서 받는다
  const sending = useIsMutating({ mutationKey: withdrawalMutationKey }) > 0;
  usePreventRemove(sending, () => {});

  return (
    <WithdrawalScreen
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      // 탈퇴(204) 뒤 기기 세션·캐시·표식·초안과 최근 로그인 표시를 지운다. 로그아웃 상태가 되면 루트가 로그인 화면으로 바꾼다
      onWithdrawn={withdraw}
      // 탈퇴 직전에 막는 사유가 생겼다(PROFILE-006). 뒤로 가면 계정 관리로 가도록 이 화면을 탈퇴 불가로 바꾼다.
      // 보내는 동안 다른 탭으로 옮겼으면 늦게 온 결과로 데려가지 않는다
      onBlocked={() => {
        if (navigation.isFocused()) {
          navigation.replace('WithdrawalBlocked');
        }
      }}
    />
  );
}

export function WithdrawalBlockedRoute({
  navigation,
}: MyScreenProps<'WithdrawalBlocked'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  // 사유를 정리하러 다른 탭에 갔다가 돌아오면 가능 여부를 다시 묻는다
  const focused = useIsFocused();
  // 진행 중인 작업은 홈, 미완료 작업 배정은 내 일정의 응답 필요로 간다 (기본안, 디자인 확인 항목)
  const openBlock = (reason: WithdrawalBlockReason) => {
    if (reason === 'WORK_IN_PROGRESS') {
      navigation.navigate('home', { screen: HOME_INITIAL_ROUTE });
    } else if (reason === 'WORK_PENDING_ACCEPT') {
      navigation.navigate('schedule', { tab: 'pending' });
    }
  };

  return (
    <WithdrawalBlockedScreen
      focused={focused}
      titleRef={titleRef}
      onOpenBlock={openBlock}
      onBack={() => navigation.goBack()}
    />
  );
}
