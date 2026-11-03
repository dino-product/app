import { useMemo, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { HorizontalSwipe } from './useHorizontalSwipe';

/** 이전 페이지 -1, 지금 페이지 0, 다음 페이지 1 */
export type PageOffset = -1 | 0 | 1;
export const PAGE_OFFSETS: readonly PageOffset[] = [-1, 0, 1];

/**
 * 밀어 넘기는 내용(useHorizontalSwipe)을 지금 페이지와 앞뒤 페이지로 나란히 그린다.
 * 창은 부모 여백(inset)만큼 좌우로 넓혀 그 밖을 자르고, 페이지는 창 폭 한 칸씩 차지한다.
 * 그래서 끄는 동안 옆 페이지가 화면 가장자리(큰 화면은 본문 기둥 가장자리)에서 들어오고, 가만히 있을 때는 보이지 않는다.
 * 창 높이는 지금 페이지 높이다. 더 긴 옆 페이지(6주 달)는 아래가 잘렸다가 넘어간 뒤에 다 보인다.
 * 옆 페이지는 미리 보기라 스크린리더가 읽지 않고 누를 수도 없다 (밀기는 창이 받아 미는 뷰로 올라간다).
 */
export function SwipeTrack({
  swipe,
  inset,
  testID,
  renderPage,
}: {
  swipe: HorizontalSwipe;
  /** 부모가 이 뷰 좌우에 둔 여백. 창을 이만큼 넓히고 페이지 안쪽에 같은 여백을 둔다 */
  inset: number;
  testID?: string;
  renderPage: (offset: PageOffset) => ReactNode;
}) {
  const { translateX } = swipe;
  const trackStyle = useMemo(
    () => ({ transform: [{ translateX }] }),
    [translateX],
  );
  return (
    <View style={[styles.window, { marginHorizontal: -inset }]}>
      <Animated.View
        testID={testID}
        onLayout={swipe.onTrackLayout}
        style={trackStyle}
      >
        {PAGE_OFFSETS.map(offset => {
          const side = offset !== 0;
          return (
            <View
              // 지금 페이지는 넘겨도 같은 뷰로 남는다. 안쪽 칸을 다시 만들지 않아 스크린리더 포커스가 머문다
              key={offset}
              accessibilityElementsHidden={side}
              importantForAccessibility={side ? 'no-hide-descendants' : 'auto'}
              style={[
                side && styles.side,
                {
                  left: `${(swipe.page + offset) * 100}%`,
                  paddingHorizontal: inset,
                },
              ]}
            >
              {renderPage(offset)}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  window: { overflow: 'hidden' },
  // 지금 페이지가 트랙 높이를 정하고, 옆 페이지는 그 위에 겹쳐 앞뒤 칸에 둔다
  side: {
    position: 'absolute',
    top: 0,
    width: '100%',
    pointerEvents: 'none',
  },
});
