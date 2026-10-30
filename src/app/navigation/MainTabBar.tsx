import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { BottomNavigationBar, colors } from '../../shared/design-system';
import { mainTabs, type MainTabKey } from '../../shared/navigation/mainTabs';
import { HOME_INITIAL_ROUTE, type MainTabParamList } from './types';

// 하단 탭 바를 디자인 시스템 BottomNavigationBar 로 그린다.
// 기본 탭 바와 달리 화면별 tabBar* 옵션(tabBarStyle 로 숨기기, tabBarRepeatedPressBehavior 등)·tabLongPress·
// 높이 보고(useBottomTabBarHeight)는 지원하지 않는다. 탭 바가 없어야 하는 화면은 루트 스택에 둔다.
export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const focused = state.routes[state.index];
  // 이 탭 바는 MainTabParamList 탭 내비게이터에만 붙는다.
  // 탭 이름이 MainTabKey 에 없으면(탭만 더하고 하단 탭 키를 빠뜨림) 여기서 컴파일 오류가 난다
  const activeKey: MainTabKey = focused.name as keyof MainTabParamList;
  // 홈 스택이 아직 상태를 만들기 전이면 첫 화면이다
  const screen =
    getFocusedRouteNameFromRoute(focused) ??
    (focused.name === 'home' ? HOME_INITIAL_ROUTE : focused.name);

  const onChange = (key: MainTabKey) => {
    const route = state.routes.find(item => item.name === key);
    // 작업 이력·마이는 아직 화면이 없다
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
      navigation.navigate(route.name, route.params);
    }
  };

  return (
    // 탭 바는 화면 밖에 그려지므로 둥근 모서리 뒤에 지금 화면의 배경색을 깐다 (Figma: 홈 메인만 회색)
    <View
      style={
        screen === HOME_INITIAL_ROUTE ? styles.homeBackdrop : styles.backdrop
      }
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
  homeBackdrop: { backgroundColor: colors.background[3] },
});
