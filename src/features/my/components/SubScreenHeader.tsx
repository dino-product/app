import type { Ref } from 'react';
import { Pressable, StyleSheet, View, type TextInstance } from 'react-native';
import {
  colors,
  Icon,
  ICON_HIT_SLOP,
  Text,
} from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';

// 마이 탭 하위 화면의 머리: 왼쪽 뒤로 가기, 가운데 제목 (Figma 마이페이지-* 프레임 공통).
// 온보딩 약관 동의처럼 제목 없이 뒤로 가기만 있는 머리도 있다
export function SubScreenHeader({
  title,
  onBack,
  titleRef,
}: {
  title?: string;
  onBack: () => void;
  /** 바깥에서 스크린리더 포커스를 제목으로 옮길 때 쓴다 */
  titleRef?: Ref<TextInstance>;
}) {
  return (
    <View style={[readableColumn, styles.header]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        hitSlop={ICON_HIT_SLOP}
        onPress={onBack}
        style={styles.back}
      >
        <Icon name="chevron-left" />
      </Pressable>
      {title !== undefined && (
        <Text
          ref={titleRef}
          accessibilityRole="header"
          variant="Body/M/SemiBold"
          color={colors.mainText}
        >
          {title}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: 20 },
});
