import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, Text } from '../../../shared/design-system';

// Figma 작업이력 › 요약 카드 (132건 / 누적 완료). 스크린리더는 카드 하나로 "누적 완료 132건" 처럼 읽는다.
// 달을 바꿔도 숫자가 같은 카드(누적)는 다시 그리지 않는다
export const SummaryCard = memo(function SummaryCardView({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${count}건`}
      style={styles.card}
    >
      <Text variant="Body/XL/Bold" color={colors.gray[900]}>
        {`${count}건`}
      </Text>
      <Text variant="Body/XS/Medium" color={colors.gray[600]}>
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 12,
    backgroundColor: colors.background[3],
  },
});
