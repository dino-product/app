import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import type { ParamListBase, ScreenLayoutArgs } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { NextStep } from '../../features/onboarding/profileApi';
import { MyStateProvider } from '../../features/my/MyStateProvider';
import { OnboardingProvider } from '../../features/onboarding/OnboardingProvider';
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
const tabOptions = { headerShown: false } as const;

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

// 마이 탭 (#72). 하위 화면 상태(MyStateProvider)는 홈의 알림센터(#96)도 쓰므로 탭 내비게이터를 감싼다
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

// 가입 단계 (#85, #113). 상태는 이 가입 안에서만 쓰므로 스택을 감싼다.
// 첫 화면(프로필 등록)에서 뒤로 가면 가입을 그만두고 로그아웃한다(로그인 화면). 두 손가락 Z 는 첫 화면에서 여기까지 올라온다.
// 뒤로 가기 버튼·Android 뒤로가기는 프로필 등록이 직접 받는다
function OnboardingFlow() {
  const stackOptions = useStackOptions();
  const { signOut } = useAuth();
  return (
    <OnboardingProvider>
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
    </OnboardingProvider>
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

// 마이 탭 상태는 로그아웃·탈퇴로 메인이 빠지면 함께 사라져 처음 값으로 돌아간다
function MainTabs() {
  return (
    <MyStateProvider>
      {/* Android 뒤로가기: 다른 탭 첫 화면에서는 홈 탭으로, 홈 첫 화면에서는 앱을 나간다 (Android 기본 흐름) */}
      <Tab.Navigator
        backBehavior="firstRoute"
        tabBar={renderTabBar}
        screenOptions={tabOptions}
      >
        <Tab.Screen name="home" component={HomeTab} />
        <Tab.Screen name="schedule" component={ScheduleRoute} />
        <Tab.Screen name="history" component={HistoryTab} />
        <Tab.Screen name="my" component={MyTab} />
      </Tab.Navigator>
    </MyStateProvider>
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
        </>
      )}
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
