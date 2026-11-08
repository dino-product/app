import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  colors,
  Skeleton,
  SkeletonBlock,
  SkeletonLine,
} from '../../../shared/design-system';

// 내 일정을 받는 동안의 스켈레톤 (#139). Figma 에 없어 실제 카드(ScheduleRows — 흰 카드, #143)와 같은
// 여백·모서리·글자 줄 높이로 최소 구성한다 (Figma 미확인)

// 상태 칩(S) 자리 (Figma 작업상태 컬러칩 61x28)
const CHIP_WIDTH = 61;
const CHIP_HEIGHT = 28;
// 응답 필요 카드의 Modal CTA (높이 42, 이 카드에서는 모서리 10)
const ACTION_HEIGHT = 42;
const ACTION_RADIUS = 10;
const CARD_PADDING = 20;
// 확정 일정 카드는 카드마다 가로 여백 24 를 둔다 (ScheduleScreen 의 cardInset)
const LIST_INSET = 24;

// 제목·시간 줄과 상태 칩, 그 아래 업체 | 고객 · 주소 (CardSummary)
function CardSummarySkeleton() {
  return (
    <>
      <View style={styles.titleRow}>
        <View style={styles.summary}>
          <SkeletonLine variant="Body/S/SemiBold" width="60%" />
          <SkeletonLine variant="Caption/M/Medium" width="45%" />
        </View>
        <SkeletonBlock width={CHIP_WIDTH} height={CHIP_HEIGHT} radius={999} />
      </View>
      <SkeletonLine variant="Caption/M/Medium" width="75%" />
    </>
  );
}

/** 확정 일정 카드 세 장. 리스트의 빈 자리(날짜 머리 아래)에 그린다 */
export const ConfirmedCardsSkeleton = memo(
  function ConfirmedCardsSkeletonView() {
    return (
      <Skeleton style={styles.list} testID="confirmed-cards-skeleton">
        {[0, 1, 2].map(key => (
          <View
            key={key}
            style={[styles.cardSurface, styles.card, styles.confirmedCard]}
            testID="confirmed-card-skeleton"
          >
            <CardSummarySkeleton />
          </View>
        ))}
      </Skeleton>
    );
  },
);

/** 응답 필요 요청 카드 두 장. 리스트의 빈 자리에 그린다 (가로 여백은 리스트가 둔다) */
export const PendingRequestsSkeleton = memo(
  function PendingRequestsSkeletonView() {
    return (
      <Skeleton style={styles.list} testID="pending-requests-skeleton">
        {[0, 1].map(key => (
          <View
            key={key}
            style={[styles.cardSurface, styles.pendingCard]}
            testID="pending-request-skeleton"
          >
            <View style={styles.pendingBody}>
              <CardSummarySkeleton />
            </View>
            <View style={styles.actions}>
              <SkeletonBlock
                height={ACTION_HEIGHT}
                radius={ACTION_RADIUS}
                style={styles.action}
              />
              <SkeletonBlock
                height={ACTION_HEIGHT}
                radius={ACTION_RADIUS}
                style={styles.action}
              />
            </View>
          </View>
        ))}
      </Skeleton>
    );
  },
);

const styles = StyleSheet.create({
  // 카드 사이는 CardGap 처럼 12
  list: { gap: 12 },
  // ScheduleRows 의 카드 바탕: 흰 카드, 모서리 16, 아래 테두리 Gray50 1
  cardSurface: {
    borderRadius: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[50],
    backgroundColor: colors.gray[0],
  },
  card: { gap: 6, padding: CARD_PADDING },
  confirmedCard: { marginHorizontal: LIST_INSET },
  pendingCard: { overflow: 'hidden' },
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
  summary: { flex: 1, gap: 6 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: CARD_PADDING,
  },
  action: { flex: 1 },
});
