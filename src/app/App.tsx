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
import { useNavigationPersistence } from './navigation/persistence';
import { RootNavigator } from './navigation/RootNavigator';

// 전환 중 화면 뒤가 기본 테마의 회색으로 비치지 않게 흰 배경을 쓴다
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.white[100] },
};

// API 를 붙이기 전까지 화면 상태는 AppStateProvider 가 목 데이터로 들고 있다.
export default function App() {
  useFrameMonitor();
  // 앱이 백그라운드에서 종료돼도 보던 화면으로 다시 연다 (#34)
  const persistence = useNavigationPersistence();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppStateProvider>
        <NavigationContainer
          ref={persistence.ref}
          theme={navigationTheme}
          initialState={persistence.initialState}
          onReady={persistence.onReady}
          onStateChange={persistence.onStateChange}
        >
          <RootNavigator />
        </NavigationContainer>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
