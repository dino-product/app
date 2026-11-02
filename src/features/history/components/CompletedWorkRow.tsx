import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, Icon, StatusChip, Text } from '../../../shared/design-system';
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={completedWorkA11yLabel(item)}
      onPress={() => onPress(item.id)}
      style={styles.row}
    >
      <View style={styles.titleRow}>
        <Text variant="Body/S/Bold" numberOfLines={1} style={styles.shrink}>
          {item.title}
        </Text>
        <StatusChip status="completed" size="S" style={styles.chip} />
      </View>
      <View style={styles.time}>
        <Icon name="calendar" size={20} color={colors.gray[600]} />
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
  row: {
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chip: { alignSelf: 'center' },
  shrink: { flexShrink: 1 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { width: 1, height: 12, backgroundColor: colors.gray[300] },
});
