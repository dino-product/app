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
import { MainTabBar } from './MainTabBar';
import {
  RejectReasonRoute,
  RequestDetailRoute,
  ScheduleRoute,
  WorkDetailRoute,
  WorkHomeRoute,
} from './routes';
import {
  HOME_INITIAL_ROUTE,
  type HomeStackParamList,
  type MainTabParamList,
  type RootStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

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
    </HomeStack.Navigator>
  );
}

function MainTabs() {
  return (
    // Android 뒤로가기: 다른 탭 첫 화면에서는 홈 탭으로, 홈 첫 화면에서는 앱을 나간다 (Android 기본 흐름)
    <Tab.Navigator
      backBehavior="firstRoute"
      tabBar={renderTabBar}
      screenOptions={tabOptions}
    >
      <Tab.Screen name="home" component={HomeTab} />
      <Tab.Screen name="schedule" component={ScheduleRoute} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const stackOptions = useStackOptions();
  return (
    <RootStack.Navigator
      screenOptions={stackOptions}
      screenLayout={stackScreenLayout}
    >
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
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
