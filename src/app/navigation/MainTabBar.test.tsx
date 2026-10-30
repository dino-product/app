import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { render, screen, userEvent } from '@testing-library/react-native';
import { View } from 'react-native';
import { MainTabBar } from './MainTabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const renderTabBar = (props: BottomTabBarProps) => <MainTabBar {...props} />;
const Blank = () => <View />;

// 탭 화면(스택·useScrollToTop)이 tabPress 로 받는 data 를 모은다
async function renderTabs() {
  const tabPressData = jest.fn();
  await render(
    <NavigationContainer>
      <Tab.Navigator
        tabBar={renderTabBar}
        screenOptions={{ headerShown: false }}
        screenListeners={{ tabPress: e => tabPressData(e.data) }}
      >
        <Tab.Screen name="home" component={Blank} />
        <Tab.Screen name="schedule" component={Blank} />
      </Tab.Navigator>
    </NavigationContainer>,
  );
  return tabPressData;
}

// 기본 탭 바와 같게: 지금 탭을 다시 누를 때만 첫 화면으로(popToTop)·맨 위로(scrollToTop)
describe('MainTabBar — tabPress data', () => {
  it('지금 탭을 다시 누르면 popToTop·scrollToTop 을 켠다', async () => {
    const tabPressData = await renderTabs();

    await userEvent.press(screen.getByRole('tab', { name: '홈' }));

    expect(tabPressData).toHaveBeenLastCalledWith({
      behavior: { popToTop: true, scrollToTop: true },
    });
  });

  it('다른 탭으로 옮길 때는 둘 다 끈다', async () => {
    const tabPressData = await renderTabs();

    await userEvent.press(screen.getByRole('tab', { name: '내 일정' }));

    expect(tabPressData).toHaveBeenLastCalledWith({
      behavior: { popToTop: false, scrollToTop: false },
    });
  });
});
