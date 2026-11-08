import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  colors,
  Skeleton,
  SKELETON_LABEL,
  SkeletonLine,
  Text,
} from '../../../shared/design-system';

// Figma 작업이력 (기본) 3753:4890 › 요약 카드 (18건 / 이번 달 완료, 132건 / 누적 완료).
// emphasis 는 이번 달 완료 카드의 Primary 강조 변형이다 (#145). 스크린리더는 카드 하나로 "누적 완료 132건" 처럼 읽는다.
// 달을 바꿔도 숫자가 같은 카드(누적)는 다시 그리지 않는다. 받는 동안은 숫자 자리가 스켈레톤이고 (#139),
// 수를 모르면(서버가 주지 않음·받지 못함) '-' 다 (기본안)
export const SummaryCard = memo(function SummaryCardView({
  label,
  count,
  emphasis = false,
  loading = false,
}: {
  label: string;
  count: number | null;
  emphasis?: boolean;
  /** 수를 받는 중이다. 숫자 대신 스켈레톤을 보이고 카드는 '…, 불러오는 중' 으로 읽는다 */
  loading?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={
        loading
          ? `${label}, ${SKELETON_LABEL}`
          : count === null
          ? `${label}, 알 수 없음`
          : `${label} ${count}건`
      }
      style={[styles.card, emphasis && styles.emphasis]}
    >
      {loading ? (
        <Skeleton accessible={false} testID="summary-count-skeleton">
          <SkeletonLine variant="Body/L/Bold" width={64} />
        </Skeleton>
      ) : (
        <Text
          variant="Body/L/Bold"
          color={emphasis ? colors.white[100] : colors.gray[700]}
        >
          {count === null ? '-' : `${count}건`}
        </Text>
      )}
      <Text
        variant="Body/XS/Medium"
        color={emphasis ? colors.white[60] : colors.gray[600]}
      >
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  // Figma 는 회색 화면 위 흰 카드지만 지금 작업 이력 화면은 흰 배경이라 기본 카드는 Background/3 로 둔다
  card: {
    flex: 1,
    gap: 4,
    paddingLeft: 20,
    paddingRight: 46,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: colors.background[3],
  },
  emphasis: { backgroundColor: colors.primary },
});
