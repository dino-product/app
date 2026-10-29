import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  CTA,
  Icon,
  StatusChip,
  Text,
  workStatusLabels,
} from '../../../shared/design-system';
import type { ConfirmedSchedule, PendingRequest } from '../model';

// 내 일정 목록의 행 (확정 일정) 과 카드 (응답 필요)

function Meta({ item }: { item: ConfirmedSchedule }) {
  return (
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
  );
}

export const ConfirmedRow = memo(function ConfirmedRowView({
  item,
  onPress,
}: {
  item: ConfirmedSchedule;
  onPress?: (id: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${workStatusLabels[item.status]}, ${
        item.timeRange
      }, ${item.company} ${item.customerName} · ${item.address}`}
      disabled={!onPress}
      onPress={() => onPress?.(item.id)}
      style={styles.row}
    >
      <View style={styles.titleRow}>
        <Text variant="Body/S/Bold" numberOfLines={1} style={styles.shrink}>
          {item.title}
        </Text>
        <StatusChip status={item.status} size="S" style={styles.chip} />
      </View>
      <View style={styles.time}>
        <Icon name="calendar" size={20} color={colors.gray[600]} />
        <Text variant="Body/XS/Medium" color={colors.gray[600]}>
          {item.timeRange}
        </Text>
      </View>
      <Meta item={item} />
    </Pressable>
  );
});

export const PendingRequestCard = memo(function PendingRequestCardView({
  item,
  onAccept,
  onReject,
  onOpen,
}: {
  item: PendingRequest;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title} 상세, ${item.dateLabel} ${item.timeRange}, ${item.company} ${item.customerName} · ${item.address}`}
        onPress={() => onOpen(item.id)}
        style={styles.cardBody}
      >
        <View style={styles.titleRow}>
          <StatusChip status={item.status} size="S" style={styles.chip} />
          <Text variant="Body/XS/Medium" color={colors.gray[600]}>
            {`${item.dateLabel} · ${item.timeRange}`}
          </Text>
        </View>
        <Text variant="Body/S/Bold" numberOfLines={1}>
          {item.title}
        </Text>
        <Meta item={item} />
      </Pressable>
      <View style={styles.actions}>
        <CTA
          type="modal"
          variant="outline"
          label="거절"
          onPress={() => onReject(item.id)}
          style={styles.action}
          accessibilityLabel={`${item.title} 거절`}
        />
        <CTA
          type="modal"
          label="수락"
          onPress={() => onAccept(item.id)}
          style={styles.action}
          accessibilityLabel={`${item.title} 수락`}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    backgroundColor: colors.white[100],
  },
  cardBody: { gap: 8 },
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
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: { flex: 1 },
});
