import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { BottomNavigationBar, colors } from '../../shared/design-system';
import { mainTabs, type MainTabKey } from '../../shared/navigation/mainTabs';
import { useTabSwitchFeedback } from './coverTabs/CoverTabView';
import { useTabSwitchLock } from './tabSwitchLock';
import {
  HISTORY_INITIAL_ROUTE,
  HOME_INITIAL_ROUTE,
  MY_INITIAL_ROUTE,
  SCHEDULE_INITIAL_ROUTE,
  type MainTabParamList,
} from './types';

// 탭 스택이 아직 상태를 만들기 전이면 그 탭의 첫 화면이다
const initialRoutes: Record<keyof MainTabParamList, string> = {
  home: HOME_INITIAL_ROUTE,
  schedule: SCHEDULE_INITIAL_ROUTE,
  history: HISTORY_INITIAL_ROUTE,
  my: MY_INITIAL_ROUTE,
};
// 배경이 회색(Background/3)인 화면. Figma: 홈 메인, 내 일정(3754:6269), 작업이력(3753:4890), 마이페이지.
// 작업 상세 등 탭 안 하위 화면은 흰색이다
const grayScreens: ReadonlySet<string> = new Set([
  HOME_INITIAL_ROUTE,
  SCHEDULE_INITIAL_ROUTE,
  HISTORY_INITIAL_ROUTE,
  MY_INITIAL_ROUTE,
]);

// 하단 탭 바를 디자인 시스템 BottomNavigationBar 로 그린다.
// 기본 탭 바와 달리 화면별 tabBar* 옵션(tabBarStyle 로 숨기기, tabBarRepeatedPressBehavior 등)·tabLongPress·
// 높이 보고(useBottomTabBarHeight)는 지원하지 않는다. 탭 바가 없어야 하는 화면은 루트 스택에 둔다.
export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const focused = state.routes[state.index];
  // 이 탭 바는 MainTabParamList 탭 내비게이터에만 붙는다.
  // 탭 이름이 MainTabKey 에 없으면(탭만 더하고 하단 탭 키를 빠뜨림) 여기서 컴파일 오류가 난다
  const activeKey: MainTabKey = focused.name as keyof MainTabParamList;
  const screen =
    getFocusedRouteNameFromRoute(focused) ??
    initialRoutes[activeKey] ??
    focused.name;

  const lock = useTabSwitchLock();
  const feedback = useTabSwitchFeedback();
  const onChange = (key: MainTabKey) => {
    // 새로고침 중에는 어느 탭을 눌러도 아무 일도 없다 (#177). 지금 탭을 다시 눌러 맨 위로 올리는 것도 하지 않는다
    if (lock !== null && !lock.canSwitch()) {
      return;
    }
    const route = state.routes.find(item => item.name === key);
    if (!route) {
      return;
    }
    // 기본 탭 바와 같게: 지금 탭을 다시 누르면 그 탭의 스택이 첫 화면으로 돌아가고(popToTop),
    // 이미 첫 화면이면 리스트가 맨 위로 간다(scrollToTop, routes.tsx 의 useScrollToTop)
    const isFocused = route.key === focused.key;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
      data: { behavior: { popToTop: isFocused, scrollToTop: isFocused } },
    });
    if (!isFocused && !event.defaultPrevented) {
      // 사용자가 눌러 옮긴 탭이다. 그리로 바뀌면 햅틱이 울린다 (#230)
      feedback?.markUserSwitch(route.key);
      navigation.navigate(route.name, route.params);
    }
  };

  return (
    // 탭 바는 화면 밖에 그려지므로 둥근 모서리 뒤에 지금 화면의 배경색을 깐다
    <View
      style={grayScreens.has(screen) ? styles.grayBackdrop : styles.backdrop}
      testID="main-tab-bar"
    >
      <BottomNavigationBar
        items={mainTabs}
        activeKey={activeKey}
        onChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.white[100] },
  grayBackdrop: { backgroundColor: colors.background[3] },
});
