import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../tokens/colors';
import { Text } from './Text';

// Figma 앱UI › Underline Tabs (내 일정의 확정 일정 / 응답 필요). TabBar 와 달리 탭이 라벨 폭만큼만 차지한다.
export type UnderlineTabsItem<K extends string = string> = {
  key: K;
  label: string;
  count?: number;
};

export type UnderlineTabsProps<K extends string> = {
  items: readonly UnderlineTabsItem<K>[];
  selectedKey: K;
  onChange: (key: K) => void;
};

export function UnderlineTabs<K extends string>({
  items,
  selectedKey,
  onChange,
}: UnderlineTabsProps<K>) {
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
                variant="Body/XS/SemiBold"
                color={selected ? colors.primary : colors.gray[500]}
              >
                {item.label}
              </Text>
              {item.count != null && (
                <Text
                  variant="Body/XS/SemiBold"
                  color={selected ? colors.accepted[1] : colors.gray[500]}
                >
                  {item.count}
                </Text>
              )}
            </View>
            <View
              testID={`underline-tabs-indicator-${item.key}`}
              style={[styles.indicator, selected && styles.indicatorActive]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  tab: { gap: 10, paddingTop: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  indicator: { height: 2, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: colors.primary },
});
