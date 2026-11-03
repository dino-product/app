import { useScrollToTop, type ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { checkWithdrawalEligibilityMock } from '../../features/my/mockData';
import type { WithdrawalBlockReason } from '../../features/my/model';
import {
  useMyNotifications,
  useMyNotificationSettings,
  useMyProfile,
  useParticipation,
} from '../../features/my/MyStateProvider';
import { pendingRequests } from '../../features/my/org/model';
import { AccountScreen } from '../../features/my/screens/AccountScreen';
import { MyPageScreen } from '../../features/my/screens/MyPageScreen';
import { NotificationCenterScreen } from '../../features/my/screens/NotificationCenterScreen';
import { NotificationSettingsScreen } from '../../features/my/screens/NotificationSettingsScreen';
import { ProfileEditScreen } from '../../features/my/screens/ProfileEditScreen';
import { TermsScreen } from '../../features/my/screens/TermsScreen';
import { WithdrawalBlockedScreen } from '../../features/my/screens/WithdrawalBlockedScreen';
import { WithdrawalScreen } from '../../features/my/screens/WithdrawalScreen';
import { termsLinks } from '../../features/my/termsLinks';
import { useSchedule, useWorkSession } from '../AppStateProvider';
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
// 앱 상태로 계산해, 사유를 정리하고 돌아오면 탈퇴 불가 화면도 바로 바뀐다
function useWithdrawalEligibility() {
  const { started } = useWorkSession();
  const { pending } = useSchedule();
  return useMemo(
    () =>
      checkWithdrawalEligibilityMock({
        workInProgress: started ? 1 : 0,
        pendingAccept: pending.length,
      }),
    [started, pending.length],
  );
}

export function MyPageRoute({ navigation }: MyScreenProps<'MyPage'>) {
  const { profile, memberships } = useMyProfile();
  const { requests } = useParticipation();
  // '신청 현황' 배지는 승인 대기 건수다
  const pendingRequestCount = useMemo(
    () => pendingRequests(requests).length,
    [requests],
  );
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
  const { notificationSettings, setNotificationSetting } =
    useMyNotificationSettings();
  const titleRef = useFocusTitleOnOpen(navigation);

  return (
    <NotificationSettingsScreen
      settings={notificationSettings}
      titleRef={titleRef}
      onChange={setNotificationSetting}
      onBack={() => navigation.goBack()}
    />
  );
}

// 알림센터는 마이페이지의 종(마이 탭 스택)과 내 작업 홈의 종(홈 탭 스택, #96)에서 연다. 알림 목록은 같다
function NotificationCenterContent({
  navigation,
  openRejected,
}: {
  navigation: Pick<
    NativeStackNavigationProp<ParamListBase>,
    'addListener' | 'goBack'
  >;
  /** 참여 거절 알림을 눌렀을 때. 행이 memo 라 렌더마다 새로 만들지 않는 함수를 넘긴다 */
  openRejected: (requestId: string) => void;
}) {
  const { notifications, markNotificationRead } = useMyNotifications();
  const titleRef = useFocusTitleOnOpen(navigation);
  // 화면을 연 시각 기준의 상대 시간. 열어 둔 동안 시간이 흘러도 다시 그리지 않는다 (유휴 상태 = 0 작업)
  const [now] = useState(() => new Date());

  return (
    <NotificationCenterScreen
      notifications={notifications}
      now={now}
      titleRef={titleRef}
      onRead={markNotificationRead}
      onOpen={openRejected}
      onBack={() => navigation.goBack()}
    />
  );
}

export function NotificationCenterRoute({
  navigation,
}: MyScreenProps<'NotificationCenter'>) {
  // 참여 거절 알림은 거절 화면을 연다 (#73)
  const openRejected = useCallback(
    (requestId: string) =>
      navigation.navigate('OrgJoinRejected', { requestId }),
    [navigation],
  );

  return (
    <NotificationCenterContent
      navigation={navigation}
      openRejected={openRejected}
    />
  );
}

// 내 작업 홈의 종으로 연 알림센터 (#96). 홈 탭 스택에 쌓아 뒤로 가면(뒤로 가기·스와이프·Android 뒤로가기) 홈으로 돌아온다.
// 참여 거절 화면은 마이 탭 스택에 있어 마이 탭에서 연다 (그 아래는 마이페이지)
export function HomeNotificationCenterRoute({
  navigation,
}: HomeScreenProps<'NotificationCenter'>) {
  const openRejected = useCallback(
    (requestId: string) =>
      navigation.navigate('my', {
        screen: 'OrgJoinRejected',
        params: { requestId },
        initial: false,
      }),
    [navigation],
  );

  return (
    <NotificationCenterContent
      navigation={navigation}
      openRejected={openRejected}
    />
  );
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
  const eligibility = useWithdrawalEligibility();
  const titleRef = useFocusTitleOnOpen(navigation);
  const { signOut } = useAuth();

  return (
    <AccountScreen
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      // 로그아웃 상태가 되면 루트가 메인을 로그인 화면으로 바꾼다. 탭이 사라져 화면 상태도 처음으로 돌아간다
      onLogout={signOut}
      // API 연동 때 GET /api/v1/users/{accountId}/withdrawal-eligibility 로 묻는다
      checkWithdrawal={async () => eligibility}
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
      // 더미 계정이 사라지고 로그인 화면으로 간다. 다시 로그인하면 신규 사용자다
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
