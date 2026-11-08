import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  colors,
  CTA,
  pressedBackground,
  StatusChip,
  Text,
  workStatusLabels,
} from '../../../shared/design-system';
import { useTabSwipeRegion } from '../../../shared/gesture/TabSwipeArea';
import type { ConfirmedSchedule, PendingRequest } from '../model';

// 내 일정 목록의 카드: 확정 일정 (Figma 3754:6312) 과 응답 필요 (3754:6846).
// 둘 다 흰 카드에 제목·시간 줄과 상태 칩, 업체 | 고객 · 주소 줄이 같고, 응답 필요는 아래에 거절·수락 버튼이 붙는다

/** 제목·시간 줄(왼쪽)과 상태 칩(오른쪽 위), 그 아래 업체 | 고객 · 주소 */
function CardSummary({
  item,
  dayLabel,
}: {
  item: ConfirmedSchedule;
  dayLabel: string;
}) {
  return (
    <>
      <View style={styles.titleRow}>
        <View style={styles.summary}>
          <Text variant="Body/S/SemiBold" numberOfLines={1}>
            {item.title}
          </Text>
          <Text variant="Caption/M/Medium">
            {item.timeRange}
            {'  '}
            <Text variant="Caption/M/Medium" color={colors.gray[600]}>
              {dayLabel}
            </Text>
          </Text>
        </View>
        <StatusChip status={item.status} size="S" />
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
    </>
  );
}

export const ConfirmedRow = memo(function ConfirmedRowView({
  item,
  dayLabel,
  onPress,
  style,
}: {
  item: ConfirmedSchedule;
  /** 시간 뒤의 날짜 (formatCardDay) */
  dayLabel: string;
  onPress?: (id: string) => void;
  /** 리스트가 주는 바깥 여백 */
  style?: StyleProp<ViewStyle>;
}) {
  // 카드 안쪽에서 시작한 가로 밀기로는 탭을 바꾸지 않는다 (#140). 카드끼리 12 떨어져 있어 위·아래 변에도 여유를 둔다
  const tabSwipe = useTabSwipeRegion();
  const label = `${item.title}, ${workStatusLabels[item.status]}, ${
    item.timeRange
  } ${dayLabel}, ${item.company} ${item.customerName} · ${item.address}`;
  const content = <CardSummary item={item} dayLabel={dayLabel} />;

  // 누를 동작이 없으면 버튼이 아니라 한 덩어리 정보로 읽히게 한다
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={[styles.card, style]}>
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
      style={state => [confirmedCardStyle(state), style]}
    >
      {content}
    </Pressable>
  );
});

export const PendingRequestCard = memo(function PendingRequestCardView({
  item,
  dayLabel,
  onAccept,
  onReject,
  onOpen,
  disabled = false,
}: {
  item: PendingRequest;
  /** 시간 뒤의 날짜 (formatCardDay) */
  dayLabel: string;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onOpen: (id: string) => void;
  /** 이 요청의 수락을 보내는 동안 거절·수락을 잠근다 */
  disabled?: boolean;
}) {
  // 카드 안쪽에서 시작한 가로 밀기로는 탭을 바꾸지 않는다 (#140)
  const tabSwipe = useTabSwipeRegion();
  return (
    <View style={styles.pendingCard} onTouchStart={tabSwipe.onTouchStart}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title} 상세, ${item.timeRange} ${dayLabel}, ${item.company} ${item.customerName} · ${item.address}`}
        onPress={() => onOpen(item.id)}
        style={pendingBodyStyle}
      >
        <CardSummary item={item} dayLabel={dayLabel} />
      </Pressable>
      <View style={styles.actions}>
        <CTA
          type="modal"
          variant="outline"
          label="거절"
          onPress={() => onReject(item.id)}
          disabled={disabled}
          style={styles.action}
          accessibilityLabel={`${item.title} 거절`}
        />
        <CTA
          type="modal"
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

// 누르는 동안 둥근 모서리 안을 회색으로 칠한다 (#102). 응답 필요 카드는 상세를 여는 본문만 칠하고 버튼 줄은 그대로다
const confirmedCardStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.card,
  pressed && styles.pressed,
];
const pendingBodyStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.pendingBody,
  pressed && styles.pressed,
];

// Figma 카드 fill Gray0, 아래 테두리 Gray50 1 (위·옆은 없다)
const cardSurface = {
  borderRadius: 16,
  borderBottomWidth: 1,
  borderBottomColor: colors.gray[50],
  backgroundColor: colors.gray[0],
} as const;
const CARD_PADDING = 20;

const styles = StyleSheet.create({
  card: { ...cardSurface, gap: 6, padding: CARD_PADDING },
  pressed: { backgroundColor: pressedBackground.onWhite },
  // 눌림 배경이 카드 위·옆 끝까지 칠해지도록 카드 여백을 본문·버튼 줄이 나눠 갖고, 둥근 모서리 밖은 자른다.
  // 윗부분 → 12 → 버튼 줄
  pendingCard: { ...cardSurface, overflow: 'hidden' },
  pendingBody: {
    gap: 6,
    paddingTop: CARD_PADDING,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  summary: { flexShrink: 1, gap: 6 },
  shrink: { flexShrink: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { width: 1, height: 12, backgroundColor: colors.gray[400] },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: CARD_PADDING,
  },
  // Figma 이 카드의 Modal CTA 인스턴스는 모서리 10 이다 (DesignSystem 기본 8)
  action: { flex: 1, borderRadius: 10 },
});
