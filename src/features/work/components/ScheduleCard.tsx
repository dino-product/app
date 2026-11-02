import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  StatusChip,
  Text,
  workStatusLabels,
} from '../../../shared/design-system';
import type { ScheduleItem } from '../model';

// 메인화면 주간 일정 카드. 칩은 제목·시간 묶음 오른쪽 위에 붙는다
export const ScheduleCard = memo(function ScheduleCardView({
  item,
  onPress,
}: {
  item: ScheduleItem;
  onPress: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${workStatusLabels[item.status]}, ${
        item.timeRange
      } ${item.dayLabel}, ${item.company} ${item.customerName} · ${
        item.address
      }`}
      onPress={() => onPress(item.id)}
      style={styles.card}
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

const styles = StyleSheet.create({
  card: {
    gap: 6,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.white[100],
  },
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
