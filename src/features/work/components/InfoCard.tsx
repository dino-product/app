import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, Text, typography } from '../../../shared/design-system';

// 작업 상세의 정보 카드 (흰 배경, Gray100 테두리, 모서리 16, 패딩 20).
// filled 는 회색 채움에 테두리 없는 카드다 (작업 내용)
export function InfoCard({
  children,
  filled = false,
  style,
  testID,
}: {
  children: ReactNode;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.card, filled && styles.filled, style]}>
      {children}
    </View>
  );
}

export function InfoField({
  label,
  value,
  style,
}: {
  label: string;
  value: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text variant="Caption/M/Medium" color={colors.gray[600]}>
        {label}
      </Text>
      <Text variant="Body/XS/Medium">{value}</Text>
    </View>
  );
}

// optional 이면 제목 뒤에 회색 "(선택)" 을 붙이고, 스크린리더는 "수행 메모, 선택" 으로 읽는다
export function Section({
  title,
  optional = false,
  children,
}: {
  title: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        accessibilityLabel={optional ? `${title}, 선택` : undefined}
        variant="Body/S/SemiBold"
      >
        {title}
        {optional && (
          <Text
            variant="Caption/M/Regular"
            color={colors.gray[500]}
            style={styles.optional}
          >
            {' (선택)'}
          </Text>
        )}
      </Text>
      {children}
    </View>
  );
}

export function SectionBand() {
  return <View style={styles.band} />;
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray[100],
    backgroundColor: colors.white[100],
  },
  filled: { borderWidth: 0, backgroundColor: colors.gray[50] },
  field: { gap: 2 },
  section: { gap: 12, paddingHorizontal: 24, paddingTop: 24 },
  // 작은 글씨지만 줄 높이는 제목에 맞춰, 행간이 다른 글자가 한 줄에 섞여 줄 높이가 바뀌지 않게 한다
  optional: { lineHeight: typography['Body/S/SemiBold'].lineHeight },
  band: { height: 12, marginTop: 24, backgroundColor: colors.background[3] },
});
