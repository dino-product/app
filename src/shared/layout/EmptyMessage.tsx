import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { colors, Text, type TypographyVariant } from '../design-system';

// 목록이 비었을 때 목록 자리에 보이는 안내 글 한 줄 (#196).
// Figma 내 스케줄(51019:15863·51019:15902)·메인화면 - 일정(무)(51028:17146)·작업이력 (기본)(51019:16207) 모두
// 아이콘·설명·굵은 글 없이 Gray600 가운데 정렬 글 한 줄이다. 글자 스타일과 위 섹션과의 간격은 자리마다 Figma 값을 준다

/** 위 섹션(날짜 블록·'일정' 줄·요약 카드)과 안내 글 사이. 위 Figma 프레임 모두 gap 60 이다 */
export const EMPTY_GAP = 60;

/** 굵지 않은(Regular·Medium) 글자 스타일만 받는다. 빈 상태 안내에는 굵은 글을 쓰지 않는다 */
export type EmptyMessageVariant = Extract<
  TypographyVariant,
  `${string}/Regular` | `${string}/Medium`
>;

export function EmptyMessage({
  children,
  variant = 'Body/XS/Regular',
  style,
}: {
  children: ReactNode;
  variant?: EmptyMessageVariant;
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
