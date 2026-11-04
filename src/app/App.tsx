import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import type { QueryClient } from '@tanstack/react-query';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { WorkRepository } from '../features/work/data/types';
import { WorkRepositoryProvider } from '../features/work/data/WorkRepositoryProvider';
import { ApiProvider, type ApiClient } from '../shared/api';
import { colors } from '../shared/design-system';
import { useFrameMonitor } from '../shared/perf/useFrameMonitor';
import { AuthProvider } from './AuthProvider';
import { useNavigationPersistence } from './navigation/persistence';
import { RootNavigator } from './navigation/RootNavigator';
import { PushNotifications } from './PushNotifications';

// 전환 중 화면 뒤가 기본 테마의 회색으로 비치지 않게 흰 배경을 쓴다
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.white[100] },
};

// ApiProvider 는 서버 API 클라이언트와 서버 상태 캐시(React Query)를 준다 (#110).
// 작업·일정·이력 화면은 WorkRepositoryProvider 의 작업 저장소를 React Query 훅으로 쓴다 (#114).
// 로그인 상태는 AuthProvider 가 서버 세션으로 정한다(#113). 켤 때는 기기에 남긴 가입 단계로 바로 그리고 뒤에서 세션을 확인한다.
// AuthProvider 는 로그아웃 상태로 돌릴 때 작업 저장소도 처음으로 돌리므로 그 안에 둔다.
// 앱 푸시(#118)는 로그인 상태와 내비게이션에 잇는다 (그리지 않는다)
export default function App({
  api,
}: {
  /**
   * 테스트가 가짜 서버에 붙인 클라이언트와 캐시, 작업 저장소를 준다 (src/app/testing).
   * 없으면 실제 서버와 Keychain 세션, 저장소는 config 의 것
   */
  api?: {
    client: ApiClient;
    queryClient: QueryClient;
    workRepository?: WorkRepository;
  };
}) {
  useFrameMonitor();
  // 앱이 백그라운드에서 종료돼도 보던 화면으로 다시 연다 (#34)
  const persistence = useNavigationPersistence();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <ApiProvider client={api?.client} queryClient={api?.queryClient}>
        <WorkRepositoryProvider repository={api?.workRepository}>
          <AuthProvider>
            <NavigationContainer
              ref={persistence.ref}
              theme={navigationTheme}
              initialState={persistence.initialState}
              onReady={persistence.onReady}
              onStateChange={persistence.onStateChange}
            >
              <RootNavigator />
            </NavigationContainer>
            <PushNotifications navigation={persistence.ref} />
          </AuthProvider>
        </WorkRepositoryProvider>
      </ApiProvider>
    </SafeAreaProvider>
  );
}
