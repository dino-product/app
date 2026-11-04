import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import type { QueryClient } from '@tanstack/react-query';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiProvider, type ApiClient } from '../shared/api';
import { colors } from '../shared/design-system';
import { useFrameMonitor } from '../shared/perf/useFrameMonitor';
import { AppStateProvider } from './AppStateProvider';
import { AuthProvider } from './AuthProvider';
import { useNavigationPersistence } from './navigation/persistence';
import { RootNavigator } from './navigation/RootNavigator';
import { SessionGate } from './SessionGate';

// 전환 중 화면 뒤가 기본 테마의 회색으로 비치지 않게 흰 배경을 쓴다
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.white[100] },
};

// 화면 상태는 API 를 붙이기 전까지 AppStateProvider 가 목 데이터로 들고 있다.
// ApiProvider 는 서버 API 클라이언트와 서버 상태 캐시(React Query)를 준다 (#110).
// 로그인 상태는 AuthProvider 가 서버 세션으로 정하고(#113), 켤 때 세션을 복원하는 동안은 SessionGate 가 첫 화면 배경을 그린다
export default function App({
  api,
}: {
  /** 테스트가 가짜 서버에 붙인 클라이언트와 캐시를 준다 (src/app/testing). 없으면 실제 서버와 Keychain 세션 */
  api?: { client: ApiClient; queryClient: QueryClient };
}) {
  useFrameMonitor();
  // 앱이 백그라운드에서 종료돼도 보던 화면으로 다시 연다 (#34)
  const persistence = useNavigationPersistence();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <ApiProvider client={api?.client} queryClient={api?.queryClient}>
        <AuthProvider>
          <AppStateProvider>
            <SessionGate>
              <NavigationContainer
                ref={persistence.ref}
                theme={navigationTheme}
                initialState={persistence.initialState}
                onReady={persistence.onReady}
                onStateChange={persistence.onStateChange}
              >
                <RootNavigator />
              </NavigationContainer>
            </SessionGate>
          </AppStateProvider>
        </AuthProvider>
      </ApiProvider>
    </SafeAreaProvider>
  );
}
