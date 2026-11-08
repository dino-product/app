import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
} from 'react-native';
import {
  colors,
  pressedBackground,
  StatusChip,
  Text,
  workStatusLabels,
} from '../../../shared/design-system';
import { useTabSwipeRegion } from '../../../shared/gestures/TabSwipeArea';
import type { ScheduleItem } from '../model';

// 메인화면 주간 일정 카드. 칩은 제목·시간 묶음 오른쪽 위에 붙는다
export const ScheduleCard = memo(function ScheduleCardView({
  item,
  onPress,
}: {
  item: ScheduleItem;
  onPress: (id: string) => void;
}) {
  // 카드 안쪽에서 시작한 가로 밀기로는 탭을 바꾸지 않는다 (#140)
  const tabSwipe = useTabSwipeRegion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${workStatusLabels[item.status]}, ${
        item.timeRange
      } ${item.dayLabel}, ${item.company} ${item.customerName} · ${
        item.address
      }`}
      onPress={() => onPress(item.id)}
      onTouchStart={tabSwipe.onTouchStart}
      style={cardStyle}
    >
      <View style={styles.titleRow}>
        <View style={styles.summary}>
          <Text variant="Body/S/SemiBold" numberOfLines={1}>
            {item.title}
          </Text>
          <Text variant="Caption/M/Medium">
            {item.timeRange}{' '}
            <Text variant="Caption/M/Medium" color={colors.gray[600]}>
              {item.dayLabel}
            </Text>
          </Text>
        </View>
        <StatusChip status={item.status} size="S" />
      </View>
      <View style={styles.row}>
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

// 누르는 동안 둥근 모서리 안을 회색으로 칠한다 (#102)
const cardStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.card,
  pressed && styles.pressed,
];

const styles = StyleSheet.create({
  card: {
    gap: 6,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.white[100],
  },
  pressed: { backgroundColor: pressedBackground.onWhite },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  summary: { flexShrink: 1, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { width: 1, height: 12, backgroundColor: colors.gray[400] },
  shrink: { flexShrink: 1 },
});
