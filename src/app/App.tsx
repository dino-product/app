import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../shared/design-system';
import { useFrameMonitor } from '../shared/perf/useFrameMonitor';
import { AppStateProvider } from './AppStateProvider';
import { RootNavigator } from './navigation/RootNavigator';

// 전환 중 화면 뒤가 기본 테마의 회색으로 비치지 않게 흰 배경을 쓴다
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.white[100] },
};

// API 를 붙이기 전까지 화면 상태는 AppStateProvider 가 목 데이터로 들고 있다.
export default function App() {
  useFrameMonitor();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppStateProvider>
        <NavigationContainer theme={navigationTheme}>
          <RootNavigator />
        </NavigationContainer>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
