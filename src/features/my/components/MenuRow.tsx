import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableStateCallbackType,
} from 'react-native';
import {
  colors,
  Icon,
  pressedBackground,
  Text,
} from '../../../shared/design-system';

// 회색 채움 카드 한 줄: 왼쪽 글자, 오른쪽 > (Figma 마이페이지-약관, 계정 관리)
export type MenuRowProps = {
  label: string;
  onPress: () => void;
  /** danger 는 계정 탈퇴처럼 되돌릴 수 없는 동작이다 */
  tone?: 'default' | 'muted' | 'danger';
  disabled?: boolean;
};

const labelColors = {
  default: colors.gray[900],
  muted: colors.gray[700],
  danger: colors.warning[1],
} as const;

export const MenuRow = memo(function MyMenuRow({
  label,
  onPress,
  tone = 'default',
  disabled = false,
}: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={rowStyle}
    >
      <Text
        variant="Body/XS/Medium"
        color={disabled ? colors.gray[400] : labelColors[tone]}
        style={styles.label}
      >
        {label}
      </Text>
      <Icon
        name="chevron-right-line"
        size={20}
        color={disabled ? colors.gray[300] : colors.gray[500]}
      />
    </Pressable>
  );
});

// 누르는 동안 회색 채움보다 한 단계 진한 회색이 된다 (#102)
const rowStyle = ({ pressed }: PressableStateCallbackType) => [
  styles.row,
  pressed && styles.pressed,
];

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.background[3],
  },
  pressed: { backgroundColor: pressedBackground.onGray },
  label: { flex: 1 },
});
