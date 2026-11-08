import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  colors,
  Skeleton,
  SkeletonBlock,
  SkeletonLine,
} from '../../../shared/design-system';

// 내 일정 › 응답 필요를 받는 동안의 스켈레톤 (#139). Figma 에 없어 요청 카드(PendingRequestCard)와 같은
// 여백·모서리·글자 줄 높이로 최소 구성한다 (Figma 미확인). 확정 일정은 작업 행 스켈레톤(WorkRowsSkeleton)을 쓴다

// 상태 칩(S)과 카드 안 CTA(M) 자리 (Figma 작업상태 컬러칩 61x28, Bottom CTA M 46·모서리 12)
const CHIP_WIDTH = 61;
const CHIP_HEIGHT = 28;
const CTA_HEIGHT = 46;
const CTA_RADIUS = 12;

function PendingRequestCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.body} testID="pending-request-skeleton-body">
        <View style={styles.titleRow}>
          <SkeletonBlock width={CHIP_WIDTH} height={CHIP_HEIGHT} radius={999} />
          <SkeletonLine variant="Body/XS/SemiBold" width="40%" />
        </View>
        <View style={styles.cardTitle}>
          <SkeletonLine variant="Body/M/SemiBold" width="55%" />
          <SkeletonLine variant="Caption/M/Medium" width="70%" />
        </View>
      </View>
      <View style={styles.actions}>
        <SkeletonBlock
          height={CTA_HEIGHT}
          radius={CTA_RADIUS}
          style={styles.action}
        />
        <SkeletonBlock
          height={CTA_HEIGHT}
          radius={CTA_RADIUS}
          style={styles.action}
        />
      </View>
    </View>
  );
}

/** 응답 필요 요청 카드 두 장. 리스트의 빈 자리에 그린다 */
export const PendingRequestsSkeleton = memo(
  function PendingRequestsSkeletonView() {
    return (
      <Skeleton testID="pending-requests-skeleton">
        <PendingRequestCardSkeleton />
        <PendingRequestCardSkeleton />
      </Skeleton>
    );
  },
);

const styles = StyleSheet.create({
  // PendingRequestCard 와 같은 카드 (행 + 카드)
  card: { borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
  body: { gap: 14, paddingTop: 24, paddingHorizontal: 24, paddingBottom: 16 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { gap: 8 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  action: { flex: 1 },
});
