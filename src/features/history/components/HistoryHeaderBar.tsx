import { useMemo, useSyncExternalStore, type Ref } from 'react';
import { Animated, StyleSheet, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/design-system';
import { readableColumn } from '../../../shared/layout/readableColumn';
import { TabEnterView } from '../../../shared/layout/tabEnter';
import { TabHeader } from '../../../shared/layout/TabHeader';
import { collapseKeyframes } from '../headerCollapse';
import type { HeaderCollapse } from '../useHeaderCollapse';
import { MonthSwitcher } from './MonthSwitcher';

// 작업 이력 상단 바 (#175). 리스트 위에 겹쳐 그린다 (화면이 리스트 앞에 두어 읽는 순서를 지키고 zIndex 로 위에 쌓는다).
// 펼침 — Figma 작업이력 (기본) 3753:4890: 제목 '작업 이력'(상태 표시줄 아래 8) 아래 14 에 ◀ 월 ▶, 그 아래 24 까지가 바다.
//        바 배경은 화면 바탕(Background/3)과 같아 구분되지 않는다.
// 접힘 — Figma 작업이력 (스크롤) 50833:6839: 제목이 없고, 월 글자(18)가 상태 표시줄 아래 19 에 가운데로 온다.
//        바는 높이 68(상태 표시줄 포함 128)로 줄어든 회색(Background/3) 바이고 그림자 0 4 8 4% 가 진다. 리스트가 그 아래로 지나간다.
// 바 뷰 자체는 펼친 크기 그대로 두고 그리는 것만 옮긴다 (레이아웃이 바뀌지 않아 스크롤 중·전환 중에 다시 그리지 않는다).
// 빈 곳 터치는 아래 리스트로 통과한다 (끌면 리스트가 스크롤되고, 바 자리에서 민 것은 탭 전환이다)
export type HistoryHeaderBarProps = {
  collapse: HeaderCollapse;
  monthTitle: string;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** 바의 화면 위 자리를 잰다 (탭·월 밀기 판정) */
  ref?: Ref<ViewInstance>;
};

export function HistoryHeaderBar({
  collapse,
  monthTitle,
  canGoNext,
  onPrev,
  onNext,
  ref,
}: HistoryHeaderBarProps) {
  const collapsed = useSyncExternalStore(
    collapse.subscribe,
    collapse.isCollapsed,
  );
  // 접힌 바 배경은 상태 표시줄 자리까지 덮는다 (Figma 바 높이 128 은 상태 표시줄 60 을 포함한다)
  const { top: statusBar } = useSafeAreaInsets();
  const { progress, pull, barShift, monthShift } = collapse;
  // 화면이 다시 그려져도 같은 스타일을 넘겨 애니메이션 값의 연결을 다시 만들지 않는다
  const animated = useMemo(
    () => ({
      bar: [styles.bar, { transform: [{ translateY: pull }] }],
      tint: [
        styles.tint,
        { opacity: progress.interpolate(collapseKeyframes.barTintOpacity) },
      ],
      title: [
        styles.passThrough,
        {
          opacity: progress.interpolate(collapseKeyframes.titleOpacity),
          transform: [
            {
              translateY: progress.interpolate(
                collapseKeyframes.titleTranslateY,
              ),
            },
          ],
        },
      ],
      // 큰 화면에서도 월 선택은 제목·목록과 같은 읽기 좋은 폭 안에 둔다 (바 배경은 창 전체 폭)
      month: [
        readableColumn,
        styles.month,
        { transform: [{ translateY: monthShift }] },
      ],
    }),
    [progress, pull, monthShift],
  );
  const backgroundStyle = useMemo(
    () => [
      styles.background,
      { top: -statusBar, transform: [{ translateY: barShift }] },
    ],
    [statusBar, barShift],
  );

  return (
    <Animated.View
      ref={ref}
      testID="work-history-bar"
      onLayout={collapse.onBarLayout}
      style={animated.bar}
    >
      {/* 자식을 요소 하나(Fragment)로 넘긴다. Animated.View 는 배열 props(여러 자식)를 참조로 비교해,
          다시 그려질 때마다 네이티브 애니메이션 연결을 새로 만든다 */}
      <>
        <Animated.View
          testID="work-history-bar-background"
          style={backgroundStyle}
        >
          <Animated.View testID="work-history-bar-tint" style={animated.tint} />
        </Animated.View>
        {/* 탭을 옮길 때 제목·월 선택만 옆에서 들어오고 바 바탕은 제자리다 (#176) */}
        <TabEnterView part="header" style={styles.content}>
          {/* 접힌 동안 보이지 않는 제목은 스크린리더도 읽지 않는다 (월 글자가 남는다) */}
          <Animated.View
            testID="work-history-title"
            style={animated.title}
            accessibilityElementsHidden={collapsed}
            importantForAccessibility={
              collapsed ? 'no-hide-descendants' : 'auto'
            }
          >
            <TabHeader title="작업 이력" style={styles.title} />
          </Animated.View>
          <MonthSwitcher
            testID="work-history-month"
            title={monthTitle}
            canGoNext={canGoNext}
            onPrev={onPrev}
            onNext={onNext}
            progress={progress}
            collapsed={collapsed}
            style={animated.month}
            onLayout={collapse.onMonthLayout}
          />
        </TabEnterView>
      </>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    pointerEvents: 'box-none',
  },
  // 제목·월 선택 (탭을 옮길 때 들어오는 내용, #176). Figma: 월 선택 아래 24 에서 요약 카드가 시작한다.
  // 그 여백을 이 안에 두어 화살표가 아래로 넓힌 터치 영역이 부모 경계 안에 든다 (경계 밖 터치는 자식에게 가지 않는다)
  content: { paddingBottom: 24, pointerEvents: 'box-none' },
  // 바 배경. 펼친 동안은 화면 바탕(Background/3, #181)과 같고, 접히면 아래 끝이 접힌 바 높이로 올라간다
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background[3],
    pointerEvents: 'none',
  },
  // 접힌 바의 회색 배경·그림자 (Figma 50833:6842). 접히는 동안 나타난다. 화면 바탕과 같은 색이라 실제로는 그림자가 나타난다
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background[3],
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.04)',
  },
  passThrough: { pointerEvents: 'box-none' },
  // Figma 3753:4895: 제목은 상태 표시줄 아래 8 (다른 탭 첫 화면의 12 와 다르다)
  title: { paddingTop: 8 },
  // Figma 3753:4897: 제목 아래 14
  month: { marginTop: 14 },
});
