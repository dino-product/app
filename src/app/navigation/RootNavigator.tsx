import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

// 화면마다 뒤로 가기가 있는 자체 헤더를 그리므로 내비게이터 헤더는 끈다.
// 네이티브 스택이라 iOS 는 왼쪽 가장자리 스와이프로, Android 는 뒤로가기 버튼·제스처로 이전 화면에 간다.
const screenOptions = { headerShown: false } as const;

const renderTabBar = (props: BottomTabBarProps) => <MainTabBar {...props} />;

// 같은 항목은 한 번만 쌓고(연달아 누름), 다른 항목은 새 화면으로 쌓아 입력 상태가 섞이지 않게 한다
const byId = ({ params }: { params: { id: string } }) => params.id;

function HomeTab() {
  return (
    <HomeStack.Navigator
      initialRouteName={HOME_INITIAL_ROUTE}
      screenOptions={screenOptions}
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
      screenOptions={screenOptions}
    >
      <Tab.Screen name="home" component={HomeTab} />
      <Tab.Screen name="schedule" component={ScheduleRoute} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <RootStack.Navigator screenOptions={screenOptions}>
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen
        name="RequestDetail"
        component={RequestDetailRoute}
        getId={byId}
      />
      <RootStack.Screen name="RejectReason" component={RejectReasonRoute} />
    </RootStack.Navigator>
  );
}
