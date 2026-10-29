import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../tokens/colors';
import { Text } from './Text';

// Figma DesignSystem › Bottom Navigation Bar (Home / 내 일정 / 작업 이력 / 마이).
// 아이콘은 Figma App Icon 세트(Active·Default)를 쓰는 쪽에서 renderIcon 으로 넣는다.
export type BottomNavigationItem<K extends string = string> = {
  key: K;
  label: string;
  renderIcon: (state: { active: boolean; color: string }) => ReactNode;
};

export type BottomNavigationBarProps<K extends string> = {
  items: readonly BottomNavigationItem<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  testID?: string;
};

// Figma 프레임(홈 인디케이터 있는 iPhone)에서 아래 여백이 33 이다. 인셋이 없는 기기도 최소 여백은 둔다.
const MIN_BOTTOM_PADDING = 16;

export function BottomNavigationBar<K extends string>({
  items,
  activeKey,
  onChange,
  testID,
}: BottomNavigationBarProps<K>) {
  const { bottom } = useSafeAreaInsets();
  const paddingBottom = Math.max(bottom, MIN_BOTTOM_PADDING);

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.container, { paddingBottom }]}
      testID={testID}
    >
      {items.map(item => {
        const active = item.key === activeKey;
        const color = active ? colors.primary : colors.gray[500];
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={styles.item}
          >
            <View style={styles.icon}>
              {item.renderIcon({ active, color })}
            </View>
            <Text variant="Caption/M/Medium" color={color}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingTop: 16,
    backgroundColor: colors.white[100],
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: colors.inactive,
    boxShadow: '0px -4px 4px rgba(0, 0, 0, 0.03)',
  },
  item: { flex: 1, alignItems: 'center', gap: 6 },
  icon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
