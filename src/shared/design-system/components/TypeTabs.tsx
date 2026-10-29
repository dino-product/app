import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../tokens/colors';
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

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  tabSelected: { backgroundColor: colors.gray[50] },
  label: { opacity: 0.8 },
});
