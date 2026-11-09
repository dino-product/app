import {
  createBottomTabNavigator,
  type BottomTabBarProps,
  type BottomTabNavigationOptions,
  type BottomTabNavigationProp,
} from '@react-navigation/bottom-tabs';
import {
  TabActions,
  type ParamListBase,
  type RouteProp,
  type ScreenLayoutArgs,
  type TabNavigationState,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { useCallback, useMemo, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { NextStep } from '../../features/onboarding/profileApi';
import {
  neighborIndex,
  type SwipeDirection,
} from '../../shared/gesture/tabSwipe';
import { TabSwipeArea } from '../../shared/gesture/TabSwipeArea';
import { useAuth } from '../AuthProvider';
import { MainTabBar } from './MainTabBar';
import {
  AccountRoute,
  HomeNotificationCenterRoute,
  MyPageRoute,
  NotificationCenterRoute,
  NotificationSettingsRoute,
  ProfileEditRoute,
  TermsRoute,
  WithdrawalBlockedRoute,
  WithdrawalRoute,
} from './myRoutes';
import {
  CompanyFindRoute,
  CompanyQrScanRoute,
  JoinApprovedRoute,
  JoinPendingRoute,
  JoinRejectedRoute as OnboardingJoinRejectedRoute,
  JoinRoleSelectRoute,
  LoginRoute,
  ProfileRegisterRoute,
  TermsAgreementRoute,
} from './onboardingRoutes';
import {
  JoinRejectedRoute,
  JoinRequestedRoute,
  JoinRequestsRoute,
  OrgJoinRoute,
  OrgQrScanRoute,
  RoleSelectRoute,
} from './orgRoutes';
import {
  CompletedWorkDetailRoute,
  RejectReasonRoute,
  RequestDetailRoute,
  ScheduleRoute,
  WorkDetailRoute,
  WorkHistoryRoute,
  WorkHomeRoute,
} from './routes';
import { TabEnterLayout, TabEnterScope } from './TabEnterLayout';
import { TabSwitchLockLayout, useTabSwitchLock } from './tabSwitchLock';
import {
  HOME_INITIAL_ROUTE,
  MY_INITIAL_ROUTE,
  ONBOARDING_INITIAL_ROUTE,
  type HistoryStackParamList,
  type HomeStackParamList,
  type MainTabParamList,
  type MyStackParamList,
  type OnboardingStackParamList,
  type RootStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();
const MyStack = createNativeStackNavigator<MyStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

// iOS 26 은 화면 어디서든 오른쪽으로 밀면 뒤로 간다. 화면 안 가로 제스처(달력 넘기기 등)와 겹치지 않게
// 창 폭의 이 비율까지인 왼쪽 영역에서만 받는다. iOS 전용 옵션이다. 지금은 iPhone 세로 전용(#23)이라 폭이 바뀌지 않지만,
// 모듈 로드 때 읽은 값에 묶이지 않게 창 폭으로 계산한다.
// 판정은 start ≤ x ≤ end 라서 왼쪽 영역은 end 로 정한다. x 는 손가락이 처음 닿은 곳이 아니라 제스처를
// 인식하는 순간의 위치라, 경계 근처에서 빠르게 밀면 거절될 수 있다.
// 가장자리 스와이프(iOS 26 미만은 이것만 있음)는 이 판정을 거치지 않아 늘 받는다
const BACK_SWIPE_WIDTH_RATIO = 1 / 3;

// 화면마다 뒤로 가기가 있는 자체 헤더를 그리므로 내비게이터 헤더는 끈다.
// 네이티브 스택이라 iOS 는 스와이프로, Android 는 뒤로가기 버튼·제스처로 이전 화면에 간다.
// 메모·사유를 입력하다 스와이프로 나가면 키보드도 함께 내린다.
function useStackOptions() {
  const { width } = useWindowDimensions();
  return useMemo(
    () =>
      ({
        headerShown: false,
        keyboardHandlingEnabled: true,
        gestureResponseDistance: { end: width * BACK_SWIPE_WIDTH_RATIO },
      } as const),
    [width],
  );
}

// 탭 화면(배경)은 장면 애니메이션 없이 바로 바뀐다. 그 안의 내용만 오른쪽 탭은 오른쪽에서, 왼쪽 탭은 왼쪽에서 찰나에 들어온다
// (#176, TabEnterLayout·tabTransition.ts). 동작 줄이기면 내용도 옮기지 않는다
const tabOptions: BottomTabNavigationOptions = { headerShown: false };

// 탭 내비게이터 layout: 새로고침 중 탭 전환 잠금(#177)과 탭 내용이 들어오는 전환(#176)
const renderTabLayout = ({
  state,
  navigation,
  children,
}: {
  state: TabNavigationState<MainTabParamList>;
  navigation: { isFocused: () => boolean };
  children: ReactNode;
}) => (
  <TabSwitchLockLayout state={state} navigation={navigation}>
    <TabEnterLayout state={state}>{children}</TabEnterLayout>
  </TabSwitchLockLayout>
);

// VoiceOver 두 손가락 Z(escape)로 뒤로 간다. 네이티브 헤더를 껐으니 스택 화면을 감싸 직접 받는다.
// 스택 첫 화면은 돌아갈 곳이 없어 받지 않는다 (탭을 바꾸는 Android 뒤로가기와 달리 iOS 관례).
// 첫 화면이 바뀌어도(reset 등) 화면이 다시 마운트되지 않게 View 는 늘 두고 핸들러만 켜고 끈다.
// escape 핸들러만 있는 View 는 Fabric 이 평탄화해 버리므로 collapsable={false} 로 남긴다
function stackScreenLayout({
  route,
  navigation,
  children,
}: ScreenLayoutArgs<
  ParamListBase,
  string,
  NativeStackNavigationOptions,
  NativeStackNavigationProp<ParamListBase>
>) {
  const isFirst = navigation.getState().routes[0]?.key === route.key;
  return (
    <View
      collapsable={false}
      onAccessibilityEscape={isFirst ? undefined : () => navigation.goBack()}
      style={styles.screen}
    >
      {children}
    </View>
  );
}

const renderTabBar = (props: BottomTabBarProps) => <MainTabBar {...props} />;

// 탭 화면을 좌우로 밀면 이웃 탭으로 옮긴다 (#140, TabSwipeArea). 탭 바를 누를 때와 같은 전환으로 내용이 들어온다 (TabEnterScope).
// 탭 안 스택이 첫 화면일 때만, 새로고침 중이 아닐 때만(#177) 받는다. 안쪽 화면은 iOS 26 화면 전체 뒤로 가기 밀기와 겹치고, 탭 메인 화면이 아니다
function TabSwipeLayout({
  route,
  navigation,
  children,
}: {
  route: RouteProp<MainTabParamList>;
  navigation: BottomTabNavigationProp<MainTabParamList>;
  children: ReactNode;
}) {
  // 밀 때마다 지금 상태로 본다. 안쪽 스택 상태가 아직 없으면 첫 화면이다. 새로고침 중에는 밀지 않는다 (#177)
  const lock = useTabSwitchLock();
  const canSwipe = useCallback(() => {
    if (lock !== null && !lock.canSwitch()) {
      return false;
    }
    const nested = navigation
      .getState()
      .routes.find(item => item.key === route.key)?.state;
    return (
      nested === undefined || (nested.index ?? nested.routes.length - 1) === 0
    );
  }, [lock, navigation, route.key]);
  const onSwipe = useCallback(
    (direction: SwipeDirection) => {
      const { index, routes } = navigation.getState();
      const next = neighborIndex(index, routes.length, direction);
      if (next !== null) {
        navigation.dispatch(
          TabActions.jumpTo(routes[next].name, routes[next].params),
        );
      }
    },
    [navigation],
  );
  return (
    <TabSwipeArea
      canSwipe={canSwipe}
      onSwipe={onSwipe}
      testID={`tab-swipe-${route.name}`}
    >
      <TabEnterScope routeKey={route.key}>{children}</TabEnterScope>
    </TabSwipeArea>
  );
}

function tabScreenLayout({
  route,
  navigation,
  children,
}: ScreenLayoutArgs<
  MainTabParamList,
  keyof MainTabParamList,
  BottomTabNavigationOptions,
  BottomTabNavigationProp<MainTabParamList>
>) {
  return (
    <TabSwipeLayout route={route} navigation={navigation}>
      {children}
    </TabSwipeLayout>
  );
}

// 같은 항목은 한 번만 쌓고(연달아 누름), 다른 항목은 새 화면으로 쌓아 입력 상태가 섞이지 않게 한다
const byId = ({ params }: { params: { id: string } }) => params.id;
// 항목이 없는 화면은 하나만 쌓는다 (전환 중에 연달아 눌러도)
const once = () => 'once';
const byOrganization = ({ params }: { params: { organizationId: string } }) =>
  params.organizationId;
const byRequest = ({ params }: { params: { requestId: string } }) =>
  params.requestId;

function HomeTab() {
  const stackOptions = useStackOptions();
  return (
    <HomeStack.Navigator
      initialRouteName={HOME_INITIAL_ROUTE}
      screenOptions={stackOptions}
      screenLayout={stackScreenLayout}
    >
      <HomeStack.Screen name="WorkHome" component={WorkHomeRoute} />
      <HomeStack.Screen
        name="WorkDetail"
        component={WorkDetailRoute}
        getId={byId}
      />
      <HomeStack.Screen
        name="NotificationCenter"
        component={HomeNotificationCenterRoute}
        getId={once}
      />
    </HomeStack.Navigator>
  );
}

function HistoryTab() {
  const stackOptions = useStackOptions();
  return (
    <HistoryStack.Navigator
      screenOptions={stackOptions}
      screenLayout={stackScreenLayout}
    >
      <HistoryStack.Screen name="WorkHistory" component={WorkHistoryRoute} />
      <HistoryStack.Screen
        name="CompletedWorkDetail"
        component={CompletedWorkDetailRoute}
        getId={byId}
      />
    </HistoryStack.Navigator>
  );
}

// 마이 탭 (#72). 화면 상태는 서버 상태 캐시(React Query)에 있다 (프로필·소속 #115, 조직 참여 #116, 알림 #117)
function MyTab() {
  const stackOptions = useStackOptions();
  return (
    <MyStack.Navigator
      initialRouteName={MY_INITIAL_ROUTE}
      screenOptions={stackOptions}
      screenLayout={stackScreenLayout}
    >
      <MyStack.Screen name="MyPage" component={MyPageRoute} />
      <MyStack.Screen
        name="ProfileEdit"
        component={ProfileEditRoute}
        getId={once}
      />
      <MyStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsRoute}
        getId={once}
      />
      <MyStack.Screen
        name="NotificationCenter"
        component={NotificationCenterRoute}
        getId={once}
      />
      <MyStack.Screen name="Terms" component={TermsRoute} getId={once} />
      <MyStack.Screen name="Account" component={AccountRoute} getId={once} />
      <MyStack.Screen
        name="Withdrawal"
        component={WithdrawalRoute}
        getId={once}
      />
      <MyStack.Screen
        name="WithdrawalBlocked"
        component={WithdrawalBlockedRoute}
        getId={once}
      />
      {/* 조직 참여 (#73) */}
      <MyStack.Screen name="OrgJoin" component={OrgJoinRoute} getId={once} />
      <MyStack.Screen
        name="OrgRoleSelect"
        component={RoleSelectRoute}
        getId={byOrganization}
      />
      <MyStack.Screen
        name="OrgJoinRequested"
        component={JoinRequestedRoute}
        getId={byRequest}
      />
      <MyStack.Screen
        name="OrgJoinRejected"
        component={JoinRejectedRoute}
        getId={byRequest}
      />
      <MyStack.Screen
        name="OrgJoinRequests"
        component={JoinRequestsRoute}
        getId={once}
      />
    </MyStack.Navigator>
  );
}

// 가입 단계 (#85, #113). 회사 참여 상태는 서버 신청 현황이다 (#116).
// 첫 화면(프로필 등록)에서 뒤로 가면 가입을 그만두고 로그아웃한다(로그인 화면). 두 손가락 Z 는 첫 화면에서 여기까지 올라온다.
// 뒤로 가기 버튼·Android 뒤로가기는 프로필 등록이 직접 받는다
function OnboardingFlow() {
  const stackOptions = useStackOptions();
  const { signOut } = useAuth();
  return (
    <View
      collapsable={false}
      onAccessibilityEscape={() => {
        signOut();
      }}
      style={styles.screen}
    >
      <OnboardingStack.Navigator
        initialRouteName={ONBOARDING_INITIAL_ROUTE}
        screenOptions={stackOptions}
        screenLayout={stackScreenLayout}
      >
        <OnboardingStack.Screen
          name="ProfileRegister"
          component={ProfileRegisterRoute}
        />
        <OnboardingStack.Screen
          name="TermsAgreement"
          component={TermsAgreementRoute}
          getId={once}
        />
        <OnboardingStack.Screen
          name="CompanyFind"
          component={CompanyFindRoute}
          getId={once}
        />
        <OnboardingStack.Screen
          name="CompanyQrScan"
          component={CompanyQrScanRoute}
          getId={once}
        />
        <OnboardingStack.Screen
          name="JoinRoleSelect"
          component={JoinRoleSelectRoute}
          getId={byOrganization}
        />
        <OnboardingStack.Screen
          name="JoinPending"
          component={JoinPendingRoute}
          getId={byRequest}
        />
        <OnboardingStack.Screen
          name="JoinApproved"
          component={JoinApprovedRoute}
          getId={byRequest}
        />
        <OnboardingStack.Screen
          name="JoinRejected"
          component={OnboardingJoinRejectedRoute}
          getId={byRequest}
        />
      </OnboardingStack.Navigator>
    </View>
  );
}

// 약관 동의부터면 그 아래에 프로필 등록을 두어(initial: false), 뒤로 가면 입력해 둔 값을 고칠 수 있다
function onboardingStart(
  nextStep: NextStep | null,
): RootStackParamList['Onboarding'] {
  return nextStep === 'TERMS'
    ? { screen: 'TermsAgreement', initial: false }
    : undefined;
}

// 로그아웃하면 로그인이 메인을 대신한다. 뒤로 가는 모양으로 바꾼다
const loginOptions = { animationTypeForReplace: 'pop' } as const;

// Android 뒤로가기: 다른 탭 첫 화면에서는 홈 탭으로, 홈 첫 화면에서는 앱을 나간다 (Android 기본 흐름)
function MainTabs() {
  return (
    <Tab.Navigator
      backBehavior="firstRoute"
      tabBar={renderTabBar}
      screenOptions={tabOptions}
      screenLayout={tabScreenLayout}
      layout={renderTabLayout}
    >
      <Tab.Screen name="home" component={HomeTab} />
      <Tab.Screen name="schedule" component={ScheduleRoute} />
      <Tab.Screen name="history" component={HistoryTab} />
      <Tab.Screen name="my" component={MyTab} />
    </Tab.Navigator>
  );
}

// 로그인 상태에 따라 화면 묶음을 바꾼다 (React Navigation 인증 흐름). 묶음이 바뀌면 이전 묶음의 화면이 스택에서 모두 빠져,
// 메인에 들어간 뒤에는 뒤로 가기로 온보딩·로그인에, 로그아웃한 뒤에는 메인에 돌아가지 않는다.
// 켤 때는 기기에 남긴 가입 단계로 첫 렌더부터 묶음을 고르고, 뒤에서 확인한 단계가 다르면 그 묶음으로 바꾼다 (#113)
export function RootNavigator() {
  const stackOptions = useStackOptions();
  const { phase, nextStep } = useAuth();
  return (
    <RootStack.Navigator
      screenOptions={stackOptions}
      screenLayout={stackScreenLayout}
    >
      {phase === 'signUp' ? (
        <RootStack.Screen
          name="Onboarding"
          component={OnboardingFlow}
          initialParams={onboardingStart(nextStep)}
        />
      ) : phase === 'signedOut' ? (
        <RootStack.Screen
          name="Login"
          component={LoginRoute}
          options={loginOptions}
        />
      ) : (
        <>
          <RootStack.Screen name="Main" component={MainTabs} />
          <RootStack.Screen
            name="RequestDetail"
            component={RequestDetailRoute}
            getId={byId}
          />
          <RootStack.Screen
            name="RejectReason"
            component={RejectReasonRoute}
            getId={byId}
          />
          {/* 마이 › 조직 참여의 QR 코드 인식 (#108). 전체 화면 카메라라 하단 탭이 없는 루트에 둔다 */}
          <RootStack.Screen
            name="OrgQrScan"
            component={OrgQrScanRoute}
            getId={once}
          />
        </>
      )}
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
