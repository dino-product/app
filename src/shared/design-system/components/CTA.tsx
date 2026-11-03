import { memo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../tokens/colors';
import { touchSlop } from '../tokens/touchTarget';
import { Text } from './Text';

// Figma DesignSystem › CTA. state 이름 대응: Primary → primary, Secondery → secondary,
// Default → outline, Reject → reject, Hover → 눌림(opacity 0.8).
// brand(Secondary) 는 컴포넌트 세트에는 없지만 화면 CTA(작업 시작, 완료 보고 작성하기)가 쓰는 색이다.
// disabled 는 State Disabled 의 Disabled 변수(Primary 50%) 채움에 흰 글자다 (L 3101:5510, M 3101:5522).
// 너비는 Figma 에서 고정값이지만 실제로는 부모 폭을 채운다 (Modal S 는 두 개를 flex: 1 로 나란히 둔다).
// 높이는 글꼴 확대 시 라벨이 잘리지 않도록 최소값으로만 건다.
export type CTAVariant =
  | 'primary'
  | 'secondary'
  | 'brand'
  | 'outline'
  | 'reject';

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
  /** 같은 라벨의 버튼이 여러 개일 때 구분용 (예: "에어컨 필터 교체 수락") */
  accessibilityLabel?: string;
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
  accessibilityLabel,
  testID,
}: CTAProps) {
  const layout = type === 'modal' ? styles.modal : sizeStyles[size];
  const pressableStyle = ({ pressed }: PressableStateCallbackType) => [
    styles.base,
    layout,
    disabled ? styles.disabled : variantStyles[variant],
    pressed && styles.pressed,
    style,
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={type === 'modal' ? MODAL_HIT_SLOP : sizeHitSlops[size]}
      onPress={onPress}
      style={pressableStyle}
      testID={testID}
    >
      {icon}
      <Text
        variant={type === 'modal' ? 'Button/S' : 'Body/XS/Medium'}
        color={disabled ? colors.white[100] : labelColors[variant]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const MODAL_MIN_HEIGHT = 42;
const minHeights = { L: 56, M: 46 } as const;

// 최소 높이가 최소 터치 영역보다 낮으면 위아래로 보완한다 (Modal 42, Android 의 M 46)
const verticalSlop = (height: number) => {
  const slop = touchSlop(height);
  return { top: slop, bottom: slop };
};
const MODAL_HIT_SLOP = verticalSlop(MODAL_MIN_HEIGHT);
const sizeHitSlops = {
  L: verticalSlop(minHeights.L),
  M: verticalSlop(minHeights.M),
};

const labelColors: Record<CTAVariant, string> = {
  primary: colors.white[100],
  secondary: colors.white[100],
  brand: colors.white[100],
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
    minHeight: MODAL_MIN_HEIGHT,
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pressed: { opacity: 0.8 },
  disabled: { backgroundColor: colors.disabled },
});

const bottom = {
  gap: 12,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 12,
} as const;

const sizeStyles = StyleSheet.create({
  L: { ...bottom, minHeight: minHeights.L },
  M: { ...bottom, minHeight: minHeights.M },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.accepted[1] },
  brand: { backgroundColor: colors.secondary },
  outline: { borderWidth: 1, borderColor: colors.gray[500] },
  reject: { backgroundColor: colors.warning[2] },
});
