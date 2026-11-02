import { StyleSheet, View } from 'react-native';
import { colors, Text } from '../../../../shared/design-system';

// 회색 요약 카드: 왼쪽 이름, 오른쪽 값 (Figma 회사찾기-요청완료·거절). 스크린리더는 한 줄씩 "회사, Orbit" 으로 읽는다
export function SummaryCard({
  rows,
}: {
  rows: readonly { label: string; value: string }[];
}) {
  return (
    <View style={styles.card}>
      {rows.map(row => (
        <View
          key={row.label}
          accessible
          accessibilityLabel={`${row.label}, ${row.value}`}
          style={styles.row}
        >
          <Text variant="Caption/M/Medium" color={colors.gray[600]}>
            {row.label}
          </Text>
          <Text variant="Caption/M/SemiBold" style={styles.value}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.background[2],
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  value: { flexShrink: 1, textAlign: 'right' },
});
