import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, StatusChip, Text } from '../../../shared/design-system';
import type { ScheduleItem } from '../model';

// 메인화면 주간 일정 카드
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
      accessibilityLabel={`${item.title}, ${item.timeRange} ${item.dayLabel}`}
      onPress={() => onPress(item.id)}
      style={styles.card}
    >
      <View style={styles.titleRow}>
        <Text variant="Body/S/Bold" style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <StatusChip status={item.status} size="S" />
      </View>
      <View style={styles.row}>
        <Text variant="Caption/M/SemiBold">{item.timeRange}</Text>
        <Text variant="Caption/M/Regular" color={colors.gray[600]}>
          {item.dayLabel}
        </Text>
      </View>
      <View style={styles.row}>
        <Text variant="Caption/M/Medium" color={colors.gray[800]}>
          {item.company}
        </Text>
        <View style={styles.divider} />
        <Text
          variant="Caption/M/Regular"
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { width: 1, height: 12, backgroundColor: colors.gray[300] },
  shrink: { flexShrink: 1 },
});
