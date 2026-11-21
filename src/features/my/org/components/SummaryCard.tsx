import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  colors,
  Text,
  type TypographyVariant,
} from '../../../../shared/design-system';

/** 요약 한 줄. accessory 가 있으면 값 글자 대신 그것(상태 칩 등)을 오른쪽에 그리고, 스크린리더는 값으로 읽는다 */
export type SummaryRow = {
  label: string;
  value: string;
  accessory?: ReactElement;
};

// 회색 요약 카드: 왼쪽 이름, 오른쪽 값 (Figma 회사찾기-요청완료 3235:14886, 온보딩 승인 대기·참여 완료). 스크린리더는 한 줄씩 "회사, Orbit" 으로 읽는다.
// 값 글자 굵기는 Figma 자리마다 다르다 (마이 › 요청 완료는 Medium, 온보딩은 SemiBold)
export function SummaryCard({
  rows,
  valueVariant = 'Caption/M/SemiBold',
}: {
  rows: readonly SummaryRow[];
  valueVariant?: TypographyVariant;
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
          {row.accessory ?? (
            <Text
              variant={valueVariant}
              color={colors.gray[800]}
              style={styles.value}
            >
              {row.value}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    padding: 20,
    borderRadius: 14,
    backgroundColor: colors.background[2],
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  value: { flexShrink: 1, textAlign: 'right' },
});
