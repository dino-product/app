import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  colors,
  Skeleton,
  SkeletonBlock,
  SkeletonLine,
} from '../../../../shared/design-system';

// 신청 현황을 받는 동안의 스켈레톤 (#139). Figma 에 없어 신청 카드(RequestCard)와 같은
// 여백·모서리·글자 줄 높이로 최소 구성한다 (Figma 미확인)

function RequestCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.spread}>
        <SkeletonLine variant="Body/S/Bold" width="45%" />
        <SkeletonBlock width={64} height={25} radius={999} />
      </View>
      <SkeletonLine variant="Caption/M/Medium" width="60%" />
      <View style={styles.spread}>
        <SkeletonLine variant="Caption/M/Medium" width="40%" />
        <SkeletonLine variant="Caption/M/SemiBold" width={52} />
      </View>
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
  // JoinRequestsScreen 목록과 같은 여백
  list: { paddingHorizontal: 24, paddingTop: 16 },
  title: { marginBottom: 16 },
  cards: { gap: 12 },
  card: {
    gap: 8,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
