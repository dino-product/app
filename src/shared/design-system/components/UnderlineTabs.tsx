import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../tokens/colors';
import { MIN_TOUCH_TARGET, smallestLineHeight } from '../tokens/touchTarget';
import { typography } from '../tokens/typography';
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
                  variant="Caption/M/Medium"
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

const TAB_PADDING_TOP = 8;
const LABEL_GAP = 12;
const INDICATOR_HEIGHT = 2;
const BORDER_WIDTH = 1;
/** 기본 글자 크기에서 탭 목록의 높이 (아래 선 포함). 위에 겹쳐 그리는 머리가 내용 위 여백을 미리 잡을 때 쓴다 (#148) */
export const UNDERLINE_TABS_HEIGHT =
  TAB_PADDING_TOP +
  typography['Body/XS/SemiBold'].lineHeight +
  LABEL_GAP +
  INDICATOR_HEIGHT +
  BORDER_WIDTH;
// 탭 높이는 글자 크기 설정이 가장 작을 때 가장 낮다 (iOS 38.4, Android 39.0)
const MIN_TAB_HEIGHT =
  TAB_PADDING_TOP +
  smallestLineHeight('Body/XS/SemiBold') +
  LABEL_GAP +
  INDICATOR_HEIGHT;
// 탭 높이를 최소 터치 영역으로 보완한다. 아래는 밑줄 테두리 안까지만 넓히고 나머지는 위로 넓힌다
const TAB_HIT_SLOP = {
  top: Math.ceil(MIN_TOUCH_TARGET - MIN_TAB_HEIGHT - BORDER_WIDTH),
  bottom: BORDER_WIDTH,
};
// 부모 뷰 경계 밖의 터치는 자식에게 가지 않으므로, 탭이 위로 넓힌 만큼 목록도 넓힌다
const LIST_HIT_SLOP = { top: TAB_HIT_SLOP.top };

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 24,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: colors.gray[200],
  },
  tab: { gap: LABEL_GAP, paddingTop: TAB_PADDING_TOP },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  indicator: { height: INDICATOR_HEIGHT, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: colors.primary },
});
