import type { Ref } from 'react';
import { Pressable, StyleSheet, View, type TextInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  Icon,
  ICON_HIT_SLOP,
  Text,
} from '../../../shared/design-system';
import {
  LoadStateView,
  type LoadState,
} from '../../../shared/layout/LoadStateView';
import { readableColumn } from '../../../shared/layout/readableColumn';

// 작업 상세(작업 수행·응답 필요·완료 작업)를 아직 그릴 수 없을 때: 불러오는 중, 오류(다시 시도), 볼 수 없는 작업.
// 머리는 상세와 같다. Figma 에 없어 기존 컴포넌트로 최소 구성한 기본안이다 (Figma 미확인)
export type WorkDetailStatus =
  | Exclude<LoadState, { status: 'ready' }>
  | { status: 'unavailable' };

export function WorkDetailStatusScreen({
  state,
  onBack,
  titleRef,
}: {
  state: WorkDetailStatus;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={[readableColumn, styles.header]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={ICON_HIT_SLOP}
          onPress={onBack}
          style={styles.back}
        >
          <Icon name="chevron-left" />
        </Pressable>
        <Text
          ref={titleRef}
          accessibilityRole="header"
          variant="Body/M/SemiBold"
          color={colors.mainText}
        >
          작업 상세
        </Text>
      </View>
      {state.status === 'unavailable' ? (
        // 배정이 바뀌었거나(재배정·해제·거절) 소속이 비활성이면 서버가 404·403 으로 답한다. 다시 시도해도 같다
        <View style={[readableColumn, styles.unavailable]}>
          <Text variant="Body/M/SemiBold" style={styles.centered}>
            볼 수 없는 작업이에요
          </Text>
          <Text
            variant="Caption/M/Medium"
            color={colors.gray[600]}
            style={styles.centered}
          >
            배정이 바뀌었거나 더 이상 담당하지 않는 작업이에요
          </Text>
        </View>
      ) : (
        <LoadStateView state={state} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white[100] },
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 20 },
  unavailable: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 80,
  },
  centered: { textAlign: 'center' },
});
