import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SessionRestoreFailedScreen } from '../features/onboarding/screens/SessionRestoreFailedScreen';
import { colors } from '../shared/design-system';
import { useAuth } from './AuthProvider';

// 앱을 켤 때 저장된 세션을 복원하는 동안 내비게이터 대신 그린다 (#113).
// 복원 중에는 첫 화면(LaunchScreen) 과 같은 흰 배경만 둬 로그인 화면이 잠깐 보이지 않게 하고,
// 서버에 닿지 못했으면 다시 시도를 보인다. 내비게이터는 복원이 끝난 뒤 처음 그려 저장한 화면(#34)을 그때 연다
export function SessionGate({ children }: { children: ReactNode }) {
  const { phase, retryRestore } = useAuth();
  if (phase === 'restoring') {
    return <View testID="session-restoring" style={styles.splash} />;
  }
  if (phase === 'restoreFailed') {
    return <SessionRestoreFailedScreen onRetry={retryRestore} />;
  }
  return children;
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.white[100] },
});
