import {
  useScrollToTop,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { checkWithdrawalEligibilityMock } from '../../features/my/mockData';
import type { WithdrawalBlockReason } from '../../features/my/model';
import { useMyState } from '../../features/my/MyStateProvider';
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
import { openWebPage } from '../externalLinks';
import { useFocusTitleOnOpen } from './routes';
import type { MyScreenProps } from './types';

// 마이 탭 스택에 올리는 화면들 (#72). 마이 탭 상태(MyStateProvider)와 앱 상태를 화면 props 로 이어 준다.

// 로그인 흐름이 아직 없어, 로그아웃·탈퇴하면 앱 첫 화면(홈)으로 돌아간다. 탭을 새로 만들어 화면 상태도 처음으로 돌린다
// 마이 스택 → 탭 → 루트 스택 순서로 올라가 루트를 바꾼다
function useResetToFirstScreen(
  navigation: Pick<NavigationProp<ParamListBase>, 'getParent'>,
) {
  return useCallback(
    () =>
      navigation
        .getParent()
        ?.getParent()
        ?.reset({ index: 0, routes: [{ name: 'Main' }] }),
    [navigation],
  );
}

export function MyPageRoute({ navigation }: MyScreenProps<'MyPage'>) {
  const { profile, memberships, pendingRequestCount } = useMyState();
  // 마이페이지에서 마이 탭을 다시 누르면 맨 위로 올린다 (iOS 관례)
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  // 조직 참여·참여 신청 현황 화면은 #73 에서 잇는다
  const openOrganization = useCallback(() => {}, []);

  return (
    <MyPageScreen
      profile={profile}
      memberships={memberships}
      pendingRequestCount={pendingRequestCount}
      onOpenNotifications={() => navigation.navigate('NotificationCenter')}
      onEditProfile={() => navigation.navigate('ProfileEdit')}
      onOpenRequestStatus={openOrganization}
      onJoinOrganization={openOrganization}
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
  const { profile, updateProfile } = useMyState();
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
  const { notificationSettings, setNotificationSetting } = useMyState();
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

export function NotificationCenterRoute({
  navigation,
}: MyScreenProps<'NotificationCenter'>) {
  const { notifications, markNotificationRead } = useMyState();
  const titleRef = useFocusTitleOnOpen(navigation);
  // 화면을 연 시각 기준의 상대 시간. 열어 둔 동안 시간이 흘러도 다시 그리지 않는다 (유휴 상태 = 0 작업)
  const [now] = useState(() => new Date());

  return (
    <NotificationCenterScreen
      notifications={notifications}
      now={now}
      titleRef={titleRef}
      onRead={markNotificationRead}
      onBack={() => navigation.goBack()}
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
  const { started } = useWorkSession();
  const { pending } = useSchedule();
  const titleRef = useFocusTitleOnOpen(navigation);
  const resetToFirstScreen = useResetToFirstScreen(navigation);

  return (
    <AccountScreen
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      // API 연동 때 POST /api/v1/auth/logout 을 부른다
      onLogout={resetToFirstScreen}
      checkWithdrawal={async () =>
        checkWithdrawalEligibilityMock({
          workInProgress: started ? 1 : 0,
          pendingAccept: pending.length,
        })
      }
      onOpenWithdrawal={() => navigation.navigate('Withdrawal')}
      onOpenWithdrawalBlocked={blocks =>
        navigation.navigate('WithdrawalBlocked', { blocks })
      }
    />
  );
}

export function WithdrawalRoute({ navigation }: MyScreenProps<'Withdrawal'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  const resetToFirstScreen = useResetToFirstScreen(navigation);

  return (
    <WithdrawalScreen
      titleRef={titleRef}
      onBack={() => navigation.goBack()}
      // API 연동 때 사유와 함께 POST /api/v1/users/{accountId}/withdrawals 로 보내고 로그아웃 상태가 된다
      onWithdraw={resetToFirstScreen}
    />
  );
}

export function WithdrawalBlockedRoute({
  navigation,
  route,
}: MyScreenProps<'WithdrawalBlocked'>) {
  const titleRef = useFocusTitleOnOpen(navigation);
  // 진행 중인 작업은 홈, 미완료 작업 배정은 내 일정의 응답 필요로 간다 (기본안, 디자인 확인 항목)
  const openBlock = (reason: WithdrawalBlockReason) => {
    if (reason === 'WORK_IN_PROGRESS') {
      navigation.navigate('home', { screen: 'WorkHome' });
    } else if (reason === 'WORK_PENDING_ACCEPT') {
      navigation.navigate('schedule', { tab: 'pending' });
    }
  };

  return (
    <WithdrawalBlockedScreen
      blocks={route.params.blocks}
      titleRef={titleRef}
      onOpenBlock={openBlock}
      onBack={() => navigation.goBack()}
    />
  );
}
