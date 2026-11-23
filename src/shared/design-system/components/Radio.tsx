import { memo, type Ref } from 'react';
import { Pressable, StyleSheet, type PressableInstance } from 'react-native';
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
  /** 스크린리더 이름. 같은 라벨의 라디오가 여럿이면 무엇의 라디오인지 넣는다 (없으면 label) */
  accessibilityLabel?: string;
  checked: boolean;
  onPress: () => void;
  testID?: string;
  /** 쓰는 쪽이 스크린리더 초점을 옮길 때 쓴다 (가입 약관 '약관 동의하기' 로 고른 뒤, #218) */
  ref?: Ref<PressableInstance>;
};

export const Radio = memo(function DesignSystemRadio({
  label,
  accessibilityLabel = label,
  checked,
  onPress,
  testID,
  ref,
}: RadioProps) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
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
