import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
} from 'react-native';
import {
  colors,
  CTA,
  Icon,
  pressedBackground,
  StatusChip,
  Text,
  workStatusLabels,
} from '../../../shared/design-system';
import { useTabSwipeRegion } from '../../../shared/gesture/TabSwipeArea';
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
  // 상세로 들어가는 행은 안쪽에서 시작한 가로 밀기로 탭을 바꾸지 않는다. 화면 폭을 꽉 채운 행이라 화면 가장자리 띠에서는 바꾼다 (#140)
  const tabSwipe = useTabSwipeRegion({ stacked: true });
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
      onTouchStart={tabSwipe.onTouchStart}
      style={confirmedRowStyle}
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
  disabled = false,
}: {
  item: PendingRequest;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onOpen: (id: string) => void;
  /** 이 요청의 수락을 보내는 동안 거절·수락을 잠근다 */
  disabled?: boolean;
}) {
  const tabSwipe = useTabSwipeRegion({ stacked: true });
  return (
    <View
      style={[styles.row, styles.card]}
      onTouchStart={tabSwipe.onTouchStart}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title} 상세, ${item.dateLabel} ${item.timeRange}, ${item.company} ${item.customerName} · ${item.address}`}
        onPress={() => onOpen(item.id)}
        style={cardBodyStyle}
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
          disabled={disabled}
          style={styles.action}
          accessibilityLabel={`${item.title} 거절`}
        />
        <CTA
          size="M"
          label="수락"
          onPress={() => onAccept(item.id)}
          disabled={disabled}
          style={styles.action}
          accessibilityLabel={`${item.title} 수락`}
        />
      </View>
    </View>
  );
});

// 누르는 동안 회색 배경 (#102). 응답 필요 카드는 상세를 여는 본문만 칠하고 거절·수락 줄은 그대로다
const confirmedRowStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.row,
  pressed && styles.pressed,
];
const cardBodyStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.cardBody,
  pressed && styles.pressed,
];

const styles = StyleSheet.create({
  row: {
    gap: 10,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    backgroundColor: colors.white[100],
  },
  pressed: { backgroundColor: pressedBackground.onWhite },
  // 칩 줄 → 14 → 제목·업체 줄 → 16 → 버튼 줄. 눌림 배경이 카드 위·옆 끝까지 칠해지도록
  // 카드 여백(24)과 버튼 줄 위 간격(16)을 본문·버튼 줄 안으로 옮겼다
  card: { gap: 0, padding: 0 },
  cardBody: {
    gap: 14,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  action: { flex: 1 },
});
