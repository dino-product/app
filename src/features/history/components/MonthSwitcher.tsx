import { useMemo } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  colors,
  Icon,
  MIN_TOUCH_TARGET,
  Text,
  touchSlop,
} from '../../../shared/design-system';
import { collapseKeyframes } from '../headerCollapse';

// Figma 작업이력 › 월 선택 (◀ 2026년 9월 ▶). 화살표는 #70 의 내 일정 달력 화살표와 같은 채운 삼각형이다.
// 다음 달로 갈 수 없을 때(이번 달)는 ▶ 를 비활성으로 흐리게 둔다.
// 상단 바가 접히면(#175) 월 글자는 20 → 18 로 줄고 화살표는 월 글자 쪽으로 들어가며 사라진다. 접힌 동안 화살표는
// 누를 수 없고(터치는 아래 리스트로 통과) 스크린리더에서도 빠진다. 월 글자는 그대로 읽는다
export type MonthSwitcherProps = {
  title: string;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** 상단 바 접힘 진행도 (0 펼침, 1 접힘) */
  progress: Animated.Value;
  /** 접혔는지 (접는 중 포함) */
  collapsed: boolean;
  /** 줄을 옮기는 스타일 (접히면 월 글자가 접힌 바 자리로 올라간다) */
  style?: StyleProp<Animated.WithAnimatedValue<ViewStyle>>;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
};

export function MonthSwitcher({
  title,
  canGoNext,
  onPrev,
  onNext,
  progress,
  collapsed,
  style,
  onLayout,
  testID,
}: MonthSwitcherProps) {
  const animated = useMemo(
    () => ({
      prev: arrowStyle(progress, collapseKeyframes.prevArrowTranslateX),
      next: arrowStyle(progress, collapseKeyframes.nextArrowTranslateX),
      title: {
        transform: [
          { scale: progress.interpolate(collapseKeyframes.monthTextScale) },
        ],
      },
    }),
    [progress],
  );
  // 화면이 다시 그려져도 같은 스타일을 넘겨 애니메이션 값의 연결을 다시 만들지 않는다
  const rowStyle = useMemo(() => [styles.row, style], [style]);
  const arrow = collapsed ? COLLAPSED_ARROW : EXPANDED_ARROW;

  return (
    <Animated.View testID={testID} style={rowStyle} onLayout={onLayout}>
      {/* 자식을 요소 하나(Fragment)로 넘긴다. Animated.View 는 배열 props(여러 자식)를 참조로 비교해,
          다시 그려질 때마다 네이티브 애니메이션 연결을 새로 만든다 */}
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          hitSlop={PREV_HIT_SLOP}
          onPress={onPrev}
          {...arrow}
        >
          <Animated.View style={animated.prev}>
            <Icon
              name="triangle-left"
              size={ARROW_SIZE}
              color={colors.gray[300]}
            />
          </Animated.View>
        </Pressable>
        <Animated.View style={animated.title}>
          <Text variant="Body/M/SemiBold" color={colors.gray[800]}>
            {title}
          </Text>
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          disabled={!canGoNext}
          hitSlop={NEXT_HIT_SLOP}
          onPress={onNext}
          {...arrow}
        >
          <Animated.View style={animated.next}>
            <Icon
              name="triangle-right"
              size={ARROW_SIZE}
              color={canGoNext ? colors.gray[300] : colors.gray[100]}
            />
          </Animated.View>
        </Pressable>
      </>
    </Animated.View>
  );
}

function arrowStyle(
  progress: Animated.Value,
  translateX: { inputRange: number[]; outputRange: number[] },
) {
  return [
    styles.arrow,
    {
      opacity: progress.interpolate(collapseKeyframes.arrowOpacity),
      transform: [
        { translateX: progress.interpolate(translateX) },
        { scale: progress.interpolate(collapseKeyframes.arrowScale) },
      ],
    },
  ];
}

const ARROW_SIZE = 24;
const TITLE_GAP = 6;

// 24 화살표를 최소 터치 영역으로 보완한다. 제목 쪽은 간격까지만 넓히고(제목이 먼저 받는다) 나머지는 바깥쪽으로
const ARROW_SLOP = touchSlop(ARROW_SIZE);
const ARROW_OUTER_SLOP = MIN_TOUCH_TARGET - ARROW_SIZE - TITLE_GAP;
const PREV_HIT_SLOP = {
  top: ARROW_SLOP,
  bottom: ARROW_SLOP,
  left: ARROW_OUTER_SLOP,
  right: TITLE_GAP,
};
const NEXT_HIT_SLOP = {
  top: ARROW_SLOP,
  bottom: ARROW_SLOP,
  left: TITLE_GAP,
  right: ARROW_OUTER_SLOP,
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: TITLE_GAP,
  },
  arrow: { width: ARROW_SIZE, height: ARROW_SIZE },
  inert: { pointerEvents: 'none' },
});

const EXPANDED_ARROW = {
  accessibilityElementsHidden: false,
  importantForAccessibility: 'auto',
} as const;
// 접힌 동안: 누를 수 없고(터치는 아래 리스트로 통과) 스크린리더에서도 빠진다 (iOS·Android)
const COLLAPSED_ARROW = {
  style: styles.inert,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;
