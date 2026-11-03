import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../shared/design-system';
import type { AuthState } from '../features/onboarding/model';
import { useFrameMonitor } from '../shared/perf/useFrameMonitor';
import { AppStateProvider } from './AppStateProvider';
import { AuthProvider } from './AuthProvider';
import { RootNavigator } from './navigation/RootNavigator';

// 전환 중 화면 뒤가 기본 테마의 회색으로 비치지 않게 흰 배경을 쓴다
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.white[100] },
};

// API 를 붙이기 전까지 화면 상태는 AppStateProvider 가 목 데이터로, 로그인 상태는 AuthProvider 가 더미 계정으로 들고 있다.
// 앱은 로그아웃 상태(로그인 화면)로 시작한다
export default function App({
  initialAuth,
}: {
  /** 테스트가 로그인한 상태(signedInAuth)에서 시작할 때 준다 */
  initialAuth?: AuthState;
}) {
  useFrameMonitor();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AuthProvider initialState={initialAuth}>
        <AppStateProvider>
          <NavigationContainer theme={navigationTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AppStateProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
