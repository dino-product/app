import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { colors, Text, type TypographyVariant } from '../design-system';

// 목록이 비었을 때 목록 자리에 보이는 안내 글 한 줄 (#196).
// Figma 내 스케줄(51019:15863·51019:15902)·메인화면 - 일정(무)(51028:17146)·작업이력 (기본)(51019:16207) 모두
// 아이콘·설명·굵은 글 없이 Gray600 가운데 정렬 글 한 줄이다. 글자 스타일과 위 섹션과의 간격은 자리마다 Figma 값을 준다
export function EmptyMessage({
  children,
  variant = 'Body/XS/Regular',
  style,
}: {
  children: ReactNode;
  variant?: TypographyVariant;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      variant={variant}
      color={colors.gray[600]}
      style={[styles.message, style]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  message: { textAlign: 'center' },
});
