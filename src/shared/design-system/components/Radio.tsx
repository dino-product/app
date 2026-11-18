import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '../tokens/colors';
import { touchSlop } from '../tokens/touchTarget';
import { Icon } from './Icon';
import { Text } from './Text';

// 라디오 하나: 원 + 라벨 (DesignSystem 추가, #193). Figma DesignSystem 페이지에는 라디오 컴포넌트가 없어
// 앱UI 온보딩 역할 선택(3255:19286)의 eva:radio-button-on-fill(Secondary) / off-outline(Gray200) 을 쓴다.
// 라벨 글자(Caption/M/Medium · Gray800)와 원·라벨 사이(8)는 Figma 에 없는 기본안이다.
// 묶음은 쓰는 쪽이 accessibilityRole="radiogroup" 으로 감싼다
export type RadioProps = {
  label: string;
  checked: boolean;
  onPress: () => void;
  testID?: string;
};

export const Radio = memo(function DesignSystemRadio({
  label,
  checked,
  onPress,
  testID,
}: RadioProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      style={styles.row}
      testID={testID}
    >
      <Icon
        name={checked ? 'radio-on' : 'radio-off'}
        color={checked ? colors.secondary : colors.gray[200]}
      />
      <Text variant="Caption/M/Medium" color={colors.gray[800]}>
        {label}
      </Text>
    </Pressable>
  );
});

// 원(24)은 Figma 크기 그대로 두고 위아래를 최소 터치 영역까지 넓힌다. 폭은 원 + 라벨이라 넉넉하다
const RADIO_SIZE = 24;
const HIT_SLOP = { top: touchSlop(RADIO_SIZE), bottom: touchSlop(RADIO_SIZE) };

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
