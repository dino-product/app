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
import { useTabSwipeRegion } from '../../../shared/gesture/TabSwipeArea';
import type { ScheduleItem } from '../model';

// 메인화면 주간 일정 카드. 칩은 제목·시간 묶음 오른쪽 위에 붙는다.
// Figma 메인화면(2428:13005·3463:17452): 흰 채움(Gray0)에 아래쪽만 Gray50 1 테두리, 여백 20, 줄 사이 6, 모서리 16
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
          {/* Figma 는 시간과 날짜 사이에 공백 두 칸이다 (3463:17452) */}
          <Text variant="Caption/M/Medium">
            {item.timeRange}
            {'  '}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[50],
    backgroundColor: colors.gray[0],
  },
  pressed: { backgroundColor: pressedBackground.onWhite },
  // Figma Frame 2147238735: 양 끝 정렬, 사이 21
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 21,
  },
  summary: { flexShrink: 1, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { width: 1, height: 12, backgroundColor: colors.gray[400] },
  shrink: { flexShrink: 1 },
});
