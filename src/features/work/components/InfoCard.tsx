import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, Text } from '../../../shared/design-system';

// 작업 상세의 정보 카드 (흰 배경, Gray100 테두리, 모서리 16, 패딩 20)
export function InfoCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
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

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" variant="Body/S/SemiBold">
        {title}
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
  field: { gap: 2 },
  section: { gap: 12, paddingHorizontal: 24, paddingTop: 24 },
  band: { height: 12, marginTop: 24, backgroundColor: colors.background[3] },
});
