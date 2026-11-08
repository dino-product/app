import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
} from 'react-native';
import {
  colors,
  Icon,
  pressedBackground,
  StatusChip,
  Text,
} from '../../../shared/design-system';
import { useTabSwipeRegion } from '../../../shared/gestures/TabSwipeArea';
import {
  completedWorkA11yLabel,
  formatWorkTime,
  type CompletedWork,
} from '../model';

// Figma 작업이력 › 완료 작업 행. 행 전체가 버튼 하나이고 누르면 그 작업 상세를 연다
export const CompletedWorkRow = memo(function CompletedWorkRowView({
  item,
  onPress,
}: {
  item: CompletedWork;
  onPress: (id: string) => void;
}) {
  // 안쪽에서 시작한 가로 밀기로는 탭을 바꾸지 않는다. 화면 폭을 꽉 채운 행이라 화면 가장자리 띠에서는 바꾼다 (#140)
  const tabSwipe = useTabSwipeRegion({ stacked: true });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={completedWorkA11yLabel(item)}
      onPress={() => onPress(item.id)}
      onTouchStart={tabSwipe.onTouchStart}
      style={rowStyle}
    >
      <View style={styles.titleRow}>
        <Text variant="Body/M/SemiBold" numberOfLines={1} style={styles.shrink}>
          {item.title}
        </Text>
        <StatusChip status="completed" size="S" style={styles.chip} />
      </View>
      <View style={styles.time}>
        <Icon name="calendar" color={colors.gray[600]} />
        <Text variant="Body/XS/Medium" color={colors.gray[600]}>
          {formatWorkTime(item)}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text variant="Caption/M/Medium" color={colors.gray[800]}>
          {item.company}
        </Text>
        <View style={styles.divider} />
        <Text
          variant="Caption/M/Medium"
          color={colors.gray[600]}
          numberOfLines={1}
          style={styles.shrink}
        >
          {`${item.customerName} · ${item.address}`}
        </Text>
      </View>
    </Pressable>
  );
});

// 누르는 동안 회색 배경 (#102)
const rowStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.row,
  pressed && styles.pressed,
];

const styles = StyleSheet.create({
  row: {
    gap: 10,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  pressed: { backgroundColor: pressedBackground.onWhite },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chip: { alignSelf: 'center' },
  shrink: { flexShrink: 1 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { width: 1, height: 12, backgroundColor: colors.gray[400] },
});
