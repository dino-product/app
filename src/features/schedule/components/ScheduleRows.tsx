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

// 내 일정 목록의 행 (확정 일정) 과 카드 (응답 필요). Figma 2714:12918, 2367:12834

/** 업체 | 고객 · 주소. 업체명은 확정 일정 행에서 Medium, 응답 필요 카드에서 SemiBold 다 (Figma) */
function Meta({
  item,
  companyVariant = 'Caption/M/Medium',
}: {
  item: ConfirmedSchedule;
  companyVariant?: 'Caption/M/Medium' | 'Caption/M/SemiBold';
}) {
  return (
    <View style={styles.meta}>
      <Text variant={companyVariant} color={colors.gray[800]}>
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
  );
}

export const ConfirmedRow = memo(function ConfirmedRowView({
  item,
  onPress,
}: {
  item: ConfirmedSchedule;
  onPress?: (id: string) => void;
}) {
  const label = `${item.title}, ${workStatusLabels[item.status]}, ${
    item.timeRange
  }, ${item.company} ${item.customerName} · ${item.address}`;
  const content = (
    <>
      <View style={styles.titleRow}>
        <Text variant="Body/M/SemiBold" numberOfLines={1} style={styles.shrink}>
          {item.title}
        </Text>
        <StatusChip status={item.status} size="S" style={styles.chip} />
      </View>
      <View style={styles.time}>
        <Icon name="calendar" color={colors.gray[600]} />
        <Text variant="Body/XS/Medium" color={colors.gray[600]}>
          {item.timeRange}
        </Text>
      </View>
      <Meta item={item} />
    </>
  );

  // 누를 동작이 없으면 버튼이 아니라 한 덩어리 정보로 읽히게 한다
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onPress(item.id)}
      style={styles.row}
    >
      {content}
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
    <View style={[styles.row, styles.card]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title} 상세, ${item.dateLabel} ${item.timeRange}, ${item.company} ${item.customerName} · ${item.address}`}
        onPress={() => onOpen(item.id)}
        style={styles.cardBody}
      >
        <View style={styles.titleRow}>
          <StatusChip status={item.status} size="S" style={styles.chip} />
          <Text variant="Body/XS/SemiBold" color={colors.gray[700]}>
            {`${item.dateLabel} · ${item.timeRange}`}
          </Text>
        </View>
        <View style={styles.cardTitle}>
          <Text variant="Body/M/SemiBold" color={colors.pt01} numberOfLines={1}>
            {item.title}
          </Text>
          <Meta item={item} companyVariant="Caption/M/SemiBold" />
        </View>
      </Pressable>
      <View style={styles.actions}>
        <CTA
          size="M"
          variant="outline"
          label="거절"
          onPress={() => onReject(item.id)}
          style={styles.action}
          accessibilityLabel={`${item.title} 거절`}
        />
        <CTA
          size="M"
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
    gap: 10,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    backgroundColor: colors.white[100],
  },
  // 칩 줄 → 14 → 제목·업체 줄 → 16 → 버튼 줄
  card: { gap: 16 },
  cardBody: { gap: 14 },
  cardTitle: { gap: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chip: { alignSelf: 'center' },
  shrink: { flexShrink: 1 },
  time: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { width: 1, height: 12, backgroundColor: colors.gray[400] },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
