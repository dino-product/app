import { memo } from 'react';
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
} from 'react-native';
import { colors } from '../tokens/colors';
import { typography, type TypographyVariant } from '../tokens/typography';

export type TextProps = RNTextProps & {
  /** Figma 텍스트 스타일 이름 */
  variant?: TypographyVariant;
  color?: string;
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
