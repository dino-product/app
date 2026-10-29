import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../tokens/colors';

// Figma DesignSystem › Toggle (Off / On)
export type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

export const Toggle = memo(function DesignSystemToggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: ToggleProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      onPress={() => onValueChange(!value)}
      style={[styles.track, value ? styles.trackOn : styles.trackOff]}
      testID={testID}
    >
      <View
        style={[styles.knob, value ? styles.knobOn : styles.knobOff]}
        testID={testID && `${testID}-knob`}
      />
    </Pressable>
  );
});

const TRACK_WIDTH = 46;
const KNOB_SIZE = 22;
const INSET = 2;
// 트랙 높이 26 을 터치 최소 44pt 로 보완한다
const HIT_SLOP = { top: 9, bottom: 9, left: 0, right: 0 };

const styles = StyleSheet.create({
  track: { width: TRACK_WIDTH, height: 26, borderRadius: 999 },
  trackOff: { backgroundColor: colors.gray[200] },
  trackOn: { backgroundColor: colors.secondary },
  knob: {
    position: 'absolute',
    top: INSET,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
  },
  knobOff: { left: INSET, backgroundColor: colors.toggleKnob },
  knobOn: {
    left: TRACK_WIDTH - INSET - KNOB_SIZE,
    backgroundColor: colors.white[100],
  },
});
