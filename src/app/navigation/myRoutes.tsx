import {
  useIsFocused,
  useScrollToTop,
  type ParamListBase,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { checkWithdrawalEligibilityMock } from '../../features/my/mockData';
import type {
  NotificationTarget,
  WithdrawalBlockReason,
} from '../../features/my/model';
import { useMyProfile } from '../../features/my/MyStateProvider';
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
  myScheduleQuery,
  useMySchedule,
  useMySchedules,
  workDetailQuery,
} from '../../features/work/data/queries';
import type { WorkStatusCode } from '../../features/work/data/status';
import type { ScheduledWork } from '../../features/work/data/types';
import {
  pendingOf,
  pendingPeriods,
  weekPeriod,
} from '../../features/work/data/views';
import { useWorkRepository } from '../../features/work/data/WorkRepositoryProvider';
import { useToday } from '../../shared/time/useToday';
import { APP_VERSION } from '../appVersion';
import { useAuth } from '../AuthProvider';
import { openWebPage } from '../externalLinks';
import { useFocusTitleOnOpen } from './routes';
import {
  HOME_INITIAL_ROUTE,
  type HomeScreenProps,
  type MyScreenProps,
} from './types';

// 마이 탭 스택에 올리는 화면들 (#72). 마이 탭 상태(MyStateProvider)와 앱 상태를 화면 props 로 이어 준다.

// 탈퇴 가능 여부 (목). 서버는 기사 소속의 작업중·응답 전 작업을 센다.
// 작업 저장소의 이번 주 작업중과 응답 필요 요청으로 센다. 사유를 정리하고 돌아오면 탈퇴 불가 화면도 바로 바뀐다
// (API 연동 때 GET /api/v1/profiles/{accountId}/withdrawal-eligibility, #115)
const eligibilityOf = (
  week: readonly ScheduledWork[],
  pending: readonly ScheduledWork[],
) =>
  checkWithdrawalEligibilityMock({
    workInProgress: week.filter(work => work.status === 'IN_PROGRESS').length,
    pendingAccept: pendingOf(pending).length,
  });

// 홈·내 일정과 같은 구간이라 같은 캐시를 쓴다
function useWorkPeriods() {
  const today = useToday();
  return useMemo(
    () => ({ week: weekPeriod(today), pending: pendingPeriods(today) }),
    [today],
  );
}

function useWithdrawalEligibility() {
  const periods = useWorkPeriods();
  const subscribed = useIsFocused();
  const week = useMySchedule(periods.week, { subscribed }).data?.works;
  const pending = useMySchedules(periods.pending, { subscribed }).works;
  return useMemo(() => eligibilityOf(week ?? [], pending), [week, pending]);
}

// 탈퇴를 누른 때의 작업으로 묻는다 (화면이 열려 있는 동안 받아 둔 값이 아니라 새로 받는다)
function useCheckWithdrawal() {
  const periods = useWorkPeriods();
  const repository = useWorkRepository();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const [week, ...pending] = await Promise.all(
      [periods.week, ...periods.pending].map(period =>
        queryClient.fetchQuery(myScheduleQuery(repository, period)),
      ),
    );
    return eligibilityOf(
      week.works,
      pending.flatMap(schedule => schedule.works),
    );
  }, [periods, repository, queryClient]);
}

export function MyPageRoute({ navigation }: MyScreenProps<'MyPage'>) {
  const { profile, memberships } = useMyProfile();
  // '신청 현황' 배지는 서버 신청 현황의 승인 대기 건수다 (#116). 받기 전·받지 못했으면 배지를 두지 않는다
  const { data: pendingRequestCount = 0 } =
    useParticipationRequests(countPendingRequests);
  // 마이페이지에서 마이 탭을 다시 누르면 맨 위로 올린다 (iOS 관례)
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);

  return (
    <MyPageScreen
      profile={profile}
      memberships={memberships}
      pendingRequestCount={pendingRequestCount}
      onOpenNotifications={() => navigation.navigate('NotificationCenter')}
      onEditProfile={() => navigation.navigate('ProfileEdit')}
      onOpenRequestStatus={() => navigation.navigate('OrgJoinRequests')}
      onJoinOrganization={() => navigation.navigate('OrgJoin')}
      onOpenNotificationSettings={() =>
        navigation.navigate('NotificationSettings')
      }
      onOpenTerms={() => navigation.navigate('Terms')}
      onOpenAccount={() => navigation.navigate('Account')}
      scrollRef={scrollRef}
    />
  );
}

export function ProfileEditRoute({ navigation }: MyScreenProps<'ProfileEdit'>) {
  const { profile, updateProfile } = useMyProfile();
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <ProfileEditScreen
      profile={profile}
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      onSave={input => {
        // API 연동 때 PUT /api/v1/profiles 로 보낸다
        updateProfile(input);
        navigation.goBack();
      }}
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
 * 알림에는 작업 상태가 없어 상세를 먼저 받아 고른다. 받은 상세는 캐시(같은 키)에 남아 연 화면이 바로 그린다.
 * 받지 못하면(볼 수 없는 작업·네트워크) 작업 상세가 그 상태와 다시 시도를 보인다.
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
        const work = await queryClient.fetchQuery(
          workDetailQuery(
            repository,
            Number(target.workId),
            Number(target.organizationId),
          ),
        );
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
  const checkWithdrawal = useCheckWithdrawal();
  const titleRef = useFocusTitleOnOpen(navigation);
  const { signOut } = useAuth();

  return (
    <AccountScreen
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      // POST /api/v1/auth/logout 을 부르고(실패해도) 기기 세션·캐시를 지운다 (#113).
      // 로그아웃 상태가 되면 루트가 메인을 로그인 화면으로 바꾼다. 탭이 사라져 화면 상태도 처음으로 돌아간다
      onLogout={signOut}
      // API 연동 때 GET /api/v1/users/{accountId}/withdrawal-eligibility 로 묻는다
      checkWithdrawal={checkWithdrawal}
      // 확인하는 동안 다른 탭으로 옮겼으면 늦게 온 결과로 데려가지 않는다
      onOpenWithdrawal={() => {
        if (navigation.isFocused()) {
          navigation.navigate('Withdrawal');
        }
      }}
      // 탈퇴 불가 화면은 열려 있는 동안 바뀌는 사유를 직접 읽는다
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

  return (
    <WithdrawalScreen
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      // 탈퇴 API 는 #115 에서 붙인다. 지금은 로그아웃하고 최근 로그인 표시를 지운 뒤 로그인 화면으로 간다
      onWithdraw={withdraw}
    />
  );
}

export function WithdrawalBlockedRoute({
  navigation,
}: MyScreenProps<'WithdrawalBlocked'>) {
  const { blocks } = useWithdrawalEligibility();
  const titleRef = useFocusTitleOnOpen(navigation);
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
      blocks={blocks}
      titleRef={titleRef}
      onOpenBlock={openBlock}
      onBack={() => navigation.goBack()}
    />
  );
}
