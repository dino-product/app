import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, Text } from '../../../shared/design-system';

// 작업 상세의 정보 카드 (흰 배경, Gray100 테두리, 모서리 16, 패딩 20).
// filled 는 Background/3 채움에 테두리 없는 카드다 (작업 내용: 모서리 14, 좌우 20·위아래 21, 줄 사이 20)
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

// optional 이면 제목 옆 4 에 회색 "(선택)" 을 붙이고, 스크린리더는 "수행 메모, 선택" 으로 읽는다.
// Figma 3235:16653: 가로, 세로 가운데, 사이 4. "(선택)" 은 Body/XS/Medium Gray500 (#180)
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
      {optional ? (
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${title}, 선택`}
          style={styles.optionalTitle}
        >
          <Text variant="Body/S/SemiBold">{title}</Text>
          <Text variant="Body/XS/Medium" color={colors.gray[500]}>
            (선택)
          </Text>
        </View>
      ) : (
        <Text accessibilityRole="header" variant="Body/S/SemiBold">
          {title}
        </Text>
      )}
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
  filled: {
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 21,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: colors.background[3],
  },
  field: { gap: 2 },
  section: { gap: 12, paddingHorizontal: 24, paddingTop: 24 },
  optionalTitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  band: { height: 12, marginTop: 24, backgroundColor: colors.background[3] },
});
