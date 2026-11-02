import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  Icon,
  MIN_TOUCH_TARGET,
  Text,
  touchSlop,
} from '../../../shared/design-system';

// Figma 작업이력 › 월 선택 (◀ 2026년 9월 ▶). 화살표는 #70 의 내 일정 달력 화살표와 같은 채운 삼각형이다.
// 다음 달로 갈 수 없을 때(이번 달)는 ▶ 를 비활성으로 흐리게 둔다
export function MonthSwitcher({
  title,
  canGoNext,
  onPrev,
  onNext,
}: {
  title: string;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 달"
        hitSlop={PREV_HIT_SLOP}
        onPress={onPrev}
      >
        <Icon name="triangle-left" size={ARROW_SIZE} color={colors.gray[300]} />
      </Pressable>
      <Text variant="Body/M/SemiBold" color={colors.gray[800]}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다음 달"
        disabled={!canGoNext}
        hitSlop={NEXT_HIT_SLOP}
        onPress={onNext}
      >
        <Icon
          name="triangle-right"
          size={ARROW_SIZE}
          color={canGoNext ? colors.gray[300] : colors.gray[100]}
        />
      </Pressable>
    </View>
  );
}

const ARROW_SIZE = 24;
const TITLE_GAP = 8;

// 24 화살표를 최소 터치 영역으로 보완한다. 제목 쪽은 간격까지만 넓히고(제목이 먼저 받는다) 나머지는 바깥쪽으로
const ARROW_SLOP = touchSlop(ARROW_SIZE);
const ARROW_OUTER_SLOP = MIN_TOUCH_TARGET - ARROW_SIZE - TITLE_GAP;
const PREV_HIT_SLOP = {
  top: ARROW_SLOP,
  bottom: ARROW_SLOP,
  left: ARROW_OUTER_SLOP,
  right: TITLE_GAP,
};
const NEXT_HIT_SLOP = {
  top: ARROW_SLOP,
  bottom: ARROW_SLOP,
  left: TITLE_GAP,
  right: ARROW_OUTER_SLOP,
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: TITLE_GAP,
  },
});
