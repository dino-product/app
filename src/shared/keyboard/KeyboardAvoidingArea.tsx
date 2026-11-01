import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useKeyboardOverlap } from './useKeyboardOverlap';

/**
 * Android 에서 키보드에 가린 만큼 아래를 줄여, 안의 ScrollView 가 키보드 윗변에서 끝나게 한다.
 * 화면 루트(SafeAreaView) 바로 아래에서 ScrollView 를 감싸고 남은 높이를 채운다.
 * 키보드가 열리고 닫힐 때 이 View 만 다시 그린다 (children 은 그대로 쓴다). 전제는 useKeyboardOverlap 참고.
 * 높이·paddingBottom 을 바깥에서 정하면 frame 이 padding 과 엮여 전제가 깨지므로 style 을 받지 않는다
 */
export function KeyboardAvoidingArea({
  testID,
  children,
}: {
  testID?: string;
  children: ReactNode;
}) {
  const { overlap, onLayout } = useKeyboardOverlap();
  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={[styles.area, { paddingBottom: overlap }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1 },
});
