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
    <View
      accessibilityRole="tablist"
      hitSlop={LIST_HIT_SLOP}
      style={styles.container}
    >
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
            hitSlop={TAB_HIT_SLOP}
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

// 탭 높이 42.4 (위 패딩 8 + 라벨 22.4 + 간격 10 + 밑줄 2) 를 터치 최소 44pt 로 보완한다.
// 아래 1 은 목록의 밑줄 테두리 안이다. 부모 뷰 경계 밖의 터치는 자식에게 가지 않으므로
// 위로 넓힌 1 만큼 목록의 터치 영역도 넓힌다.
const TAB_HIT_SLOP = { top: 1, bottom: 1 };
const LIST_HIT_SLOP = { top: TAB_HIT_SLOP.top };

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
