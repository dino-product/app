import { memo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../tokens/colors';
import { Text } from './Text';

// Figma DesignSystem › CTA. state 이름 대응: Primary → primary, Secondery → secondary,
// Default → outline, Reject → reject, Hover → 눌림(opacity 0.8).
// 너비는 Figma 에서 고정값이지만 실제로는 부모 폭을 채운다 (Modal S 는 두 개를 flex: 1 로 나란히 둔다).
export type CTAVariant = 'primary' | 'secondary' | 'outline' | 'reject';

type CTALayout =
  | { type?: 'bottom'; size?: 'L' | 'M' }
  | { type: 'modal'; size?: never };

export type CTAProps = CTALayout & {
  label: string;
  onPress: () => void;
  variant?: CTAVariant;
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export const CTA = memo(function DesignSystemCTA({
  label,
  onPress,
  variant = 'primary',
  type = 'bottom',
  size = 'L',
  icon,
  disabled = false,
  style,
  testID,
}: CTAProps) {
  const layout = type === 'modal' ? styles.modal : sizeStyles[size];
  const pressableStyle = ({ pressed }: PressableStateCallbackType) => [
    styles.base,
    layout,
    variantStyles[variant],
    pressed && styles.pressed,
    style,
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={pressableStyle}
      testID={testID}
    >
      {icon}
      <Text
        variant={type === 'modal' ? 'Button/S' : 'Body/XS/Medium'}
        color={labelColors[variant]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const labelColors: Record<CTAVariant, string> = {
  primary: colors.white[100],
  secondary: colors.white[100],
  outline: colors.gray[700],
  reject: colors.warning[1],
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modal: {
    height: 42,
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pressed: { opacity: 0.8 },
});

const bottom = {
  gap: 12,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 12,
} as const;

const sizeStyles = StyleSheet.create({
  L: { ...bottom, height: 56 },
  M: { ...bottom, height: 46 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.accepted[1] },
  outline: { borderWidth: 1, borderColor: colors.gray[500] },
  reject: { backgroundColor: colors.warning[2] },
});
