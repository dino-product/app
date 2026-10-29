import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../tokens/colors';
import { Text } from './Text';

// Figma DesignSystem › Tab Bar (Active / Inactive, 건수, Bar). 탭은 폭을 균등하게 나눈다.
export type TabBarItem<K extends string = string> = {
  key: K;
  label: string;
  count?: number;
};

export type TabBarProps<K extends string> = {
  items: readonly TabBarItem<K>[];
  selectedKey: K;
  onChange: (key: K) => void;
};

export function TabBar<K extends string>({
  items,
  selectedKey,
  onChange,
}: TabBarProps<K>) {
  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {items.map(item => {
        const selected = item.key === selectedKey;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={
              item.count != null ? `${item.label} ${item.count}건` : item.label
            }
            accessibilityState={{ selected }}
            onPress={() => onChange(item.key)}
            style={styles.tab}
          >
            <View style={styles.labelRow}>
              <Text
                variant="Body/M/Medium"
                color={selected ? colors.black : colors.gray[700]}
              >
                {item.label}
              </Text>
              {item.count != null && (
                <Text variant="Body/XS/Medium" color={colors.accepted[1]}>
                  {item.count}
                </Text>
              )}
            </View>
            <View
              testID={`tab-bar-indicator-${item.key}`}
              style={[styles.indicator, selected && styles.indicatorActive]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row' },
  tab: { flex: 1, gap: 14 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  indicator: { height: 3, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: colors.accepted[1] },
});
