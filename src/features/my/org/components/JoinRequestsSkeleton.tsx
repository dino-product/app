import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  colors,
  Skeleton,
  SkeletonBlock,
  SkeletonLine,
} from '../../../../shared/design-system';

// 신청 현황을 받는 동안의 스켈레톤 (#139). Figma 에 없어 신청 카드(RequestCard, Figma 2880:15120)와 같은
// 여백·모서리·글자 줄 높이로 최소 구성한다: 이름·희망 유형 줄과 오른쪽 위 X(24), 아래 검토 안내 (#200)

function RequestCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.texts}>
          <SkeletonLine variant="Body/S/SemiBold" width="45%" />
          <SkeletonLine variant="Caption/M/Medium" width="60%" />
        </View>
        <SkeletonBlock width={24} height={24} radius={6} />
      </View>
      <SkeletonLine variant="Caption/M/Medium" width="40%" />
    </View>
  );
}

/** '승인 대기 n' 제목과 신청 카드 두 장. 리스트의 빈 자리에 그린다 */
export const JoinRequestsSkeleton = memo(function JoinRequestsSkeletonView() {
  return (
    <Skeleton style={styles.list} testID="join-requests-skeleton">
      <SkeletonLine variant="Body/S/SemiBold" width={96} style={styles.title} />
      <View style={styles.cards}>
        <RequestCardSkeleton />
        <RequestCardSkeleton />
      </View>
    </Skeleton>
  );
});

const styles = StyleSheet.create({
  // JoinRequestsScreen 목록과 같은 여백 (머리 아래 12, 제목 아래 12, 카드 사이 12)
  list: { paddingHorizontal: 24, paddingTop: 12 },
  title: { marginBottom: 12 },
  cards: { gap: 12 },
  card: {
    gap: 6,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  texts: { flex: 1, gap: 6 },
});
