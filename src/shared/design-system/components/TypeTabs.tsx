import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../tokens/colors';
import { smallestLineHeight, touchSlop } from '../tokens/touchTarget';
import { Text } from './Text';

// Figma DesignSystem › Tab / Type (Select / Default). 알약 모양 필터 탭.
export type TypeTabsItem<K extends string = string> = {
  key: K;
  label: string;
};

export type TypeTabsProps<K extends string> = {
  items: readonly TypeTabsItem<K>[];
  selectedKey: K;
  onChange: (key: K) => void;
};

export function TypeTabs<K extends string>({
  items,
  selectedKey,
  onChange,
}: TypeTabsProps<K>) {
  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {items.map(item => {
        const selected = item.key === selectedKey;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={TAB_HIT_SLOP}
            onPress={() => onChange(item.key)}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text
              variant="Body/S/SemiBold"
              color={selected ? colors.primary : colors.gray[600]}
              style={styles.label}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TAB_PADDING_VERTICAL = 10;
// 탭 높이(가장 작은 글자 설정에서 iOS 40.7, Android 41.4)를 최소 터치 영역으로 보완한다
const TAB_SLOP = touchSlop(
  TAB_PADDING_VERTICAL * 2 + smallestLineHeight('Body/S/SemiBold'),
);
const TAB_HIT_SLOP = { top: TAB_SLOP, bottom: TAB_SLOP };

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: TAB_PADDING_VERTICAL,
    borderRadius: 999,
  },
  tabSelected: { backgroundColor: colors.gray[50] },
  label: { opacity: 0.8 },
});
