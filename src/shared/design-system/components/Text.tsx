import { memo, type Ref } from 'react';
import {
  StyleSheet,
  Text as RNText,
  type TextInstance,
  type TextProps as RNTextProps,
} from 'react-native';
import { colors } from '../tokens/colors';
import { typography, type TypographyVariant } from '../tokens/typography';

export type TextProps = RNTextProps & {
  /** Figma 텍스트 스타일 이름 */
  variant?: TypographyVariant;
  color?: string;
  /** rest 로 RN Text 에 그대로 넘어간다 (React 19 는 ref 도 prop) */
  ref?: Ref<TextInstance>;
};

export const Text = memo(function DesignSystemText({
  variant = 'Body/XS/Medium',
  color = colors.gray[900],
  style,
  ...rest
}: TextProps) {
  return (
    <RNText style={[variantStyles[variant], { color }, style]} {...rest} />
  );
});

const variantStyles = StyleSheet.create(typography);
