import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, CTA, Text } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import {
  STANDALONE_SCREEN_EDGES,
  standaloneScreen,
} from '../../../shared/layout/standaloneScreen';

// 앱을 다시 켤 때 저장된 세션으로 프로필(가입 단계)을 받지 못한 경우 (#113). 서버에 닿지 못했거나 서버가 잠시 답하지 못했다.
// Figma 에 없는 화면이라 기존 글자·CTA 로 최소 구성했다 (Figma 미확인)
export function SessionRestoreFailedScreen({
  onRetry,
}: {
  /** 다시 시도. 세션과 프로필을 다시 읽는다 */
  onRetry: () => void;
}) {
  return (
    <SafeAreaView
      edges={STANDALONE_SCREEN_EDGES}
      style={standaloneScreen.screen}
    >
      <View style={[readableColumn, styles.message]}>
        <Text accessibilityRole="header" variant="Body/L/Bold">
          연결할 수 없어요
        </Text>
        <Text
          variant="Body/XS/Medium"
          color={colors.gray[600]}
          style={styles.center}
        >
          인터넷 연결을 확인한 뒤 다시 시도해 주세요.
        </Text>
      </View>
      <View style={[readableColumn, standaloneScreen.actions]}>
        <CTA label="다시 시도" onPress={onRetry} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  message: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  center: { textAlign: 'center' },
});
