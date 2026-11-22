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
import { smallestLineHeight } from '../../../shared/design-system/tokens/touchTarget';
import { collapseKeyframes } from '../headerCollapse';
import { pickerKeyframes } from '../monthPicker';

// Figma 작업이력 › 월 선택 (◀ 2026년 9월 ▶). 화살표는 #70 의 내 일정 달력 화살표와 같은 채운 삼각형이고,
// 색은 이 자리의 Figma 값 Gray400 이다 (50929:14830 · 50929:14833, #204). 다음 달로 갈 수 없을 때(이번 달)는 ▶ 를 비활성으로 흐리게 둔다.
// 상단 바가 접히면(#175) 월 글자는 20 → 18 로 줄고 화살표는 월 글자 쪽으로 들어가며 사라진다. 접힌 동안 화살표는
// 누를 수 없고(터치는 아래 리스트로 통과) 스크린리더에서도 빠진다. 월 글자는 그대로 읽는다.
// 월 글자는 날짜 선택 상자를 여닫는 버튼이다 (#203). 누르는 동안·열린 동안 Gray900 이고 (Figma 날짜 호버 50867:4871),
// 열린 동안 상자의 머리 글자가 된다: 같은 자리·같은 크기로 그대로 있고, 접힌 바에서 열면 접힌 자리에서 머리 자리로 내려오며 커진다.
// 화살표는 열리는 앞 35% 안에 글자 쪽으로 들어가며 사라지고, 열린 동안 누를 수 없다
export type MonthSwitcherProps = {
  title: string;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** 상단 바 접힘 진행도 (0 펼침, 1 접힘) */
  progress: Animated.Value;
  /** 접혔는지 (접는 중 포함) */
  collapsed: boolean;
  /** 날짜 선택 상자 열림 진행도 (0 닫힘, 1 열림, #203) */
  pickerProgress: Animated.Value;
  /** 날짜 선택 상자가 열려 있는지 (닫는 중이면 false) */
  pickerOpen: boolean;
  /** 날짜 선택 상자가 보이는지 (닫는 중 포함). 월 글자가 머리 글자(Gray900)다 */
  pickerVisible: boolean;
  /** 월 글자를 눌렀다 (상자를 여닫는다) */
  onPressTitle: () => void;
  /** 월 글자 줄의 onLayout (상자가 이 크기에서 펼쳐진다) */
  onTitleLayout?: (event: LayoutChangeEvent) => void;
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
  pickerProgress,
  pickerOpen,
  pickerVisible,
  onPressTitle,
  onTitleLayout,
  style,
  onLayout,
  testID,
}: MonthSwitcherProps) {
  const animated = useMemo(
    () => ({
      prev: arrowStyle(
        progress,
        pickerProgress,
        collapseKeyframes.prevArrowTranslateX,
        pickerKeyframes.prevArrowTranslateX,
      ),
      next: arrowStyle(
        progress,
        pickerProgress,
        collapseKeyframes.nextArrowTranslateX,
        pickerKeyframes.nextArrowTranslateX,
      ),
      // 접히면 20 → 18. 상자를 열면 그 크기에서 머리 글자 크기(20)로 커진다
      title: {
        transform: [
          {
            scale: Animated.add(
              Animated.multiply(
                progress.interpolate(collapseKeyframes.monthTextScale),
                Animated.subtract(1, pickerProgress),
              ),
              pickerProgress,
            ),
          },
        ],
      },
    }),
    [progress, pickerProgress],
  );
  // 화면이 다시 그려져도 같은 스타일을 넘겨 애니메이션 값의 연결을 다시 만들지 않는다
  const rowStyle = useMemo(() => [styles.row, style], [style]);
  const arrow = collapsed || pickerVisible ? COLLAPSED_ARROW : EXPANDED_ARROW;

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
              color={colors.gray[400]}
            />
          </Animated.View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: pickerOpen }}
          hitSlop={TITLE_HIT_SLOP}
          onPress={onPressTitle}
          // 열면 초점이 이 버튼에 남는다. 스크린리더 닫기 동작(iOS 두 손가락 문지르기)으로도 닫는다
          onAccessibilityEscape={pickerOpen ? onPressTitle : undefined}
        >
          {({ pressed }) => (
            <Animated.View style={animated.title} onLayout={onTitleLayout}>
              <Text
                variant="Body/M/SemiBold"
                color={
                  pressed || pickerVisible ? colors.gray[900] : colors.gray[800]
                }
              >
                {title}
              </Text>
            </Animated.View>
          )}
        </Pressable>
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
              color={canGoNext ? colors.gray[400] : colors.gray[100]}
            />
          </Animated.View>
        </Pressable>
      </>
    </Animated.View>
  );
}

type Keyframes = { inputRange: number[]; outputRange: number[] };

// 바가 접힐 때와 상자가 열릴 때 같은 모양으로 사라진다. 둘 중 하나라도 진행하면 사라진다
function arrowStyle(
  progress: Animated.Value,
  pickerProgress: Animated.Value,
  translateX: Keyframes,
  pickerTranslateX: Keyframes,
) {
  return [
    styles.arrow,
    {
      opacity: Animated.multiply(
        progress.interpolate(collapseKeyframes.arrowOpacity),
        pickerProgress.interpolate(pickerKeyframes.arrowOpacity),
      ),
      transform: [
        {
          translateX: Animated.add(
            progress.interpolate(translateX),
            pickerProgress.interpolate(pickerTranslateX),
          ),
        },
        {
          scale: Animated.multiply(
            progress.interpolate(collapseKeyframes.arrowScale),
            pickerProgress.interpolate(pickerKeyframes.arrowScale),
          ),
        },
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
// 월 글자는 가장 작은 글자에서도 최소 터치 영역이 되게 위아래로만 넓힌다 (좌우는 화살표 몫)
const TITLE_SLOP = touchSlop(smallestLineHeight('Body/M/SemiBold'));
const TITLE_HIT_SLOP = { top: TITLE_SLOP, bottom: TITLE_SLOP };
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
// 접힌 동안·날짜 선택 상자가 보이는 동안: 누를 수 없고(터치는 아래로 통과) 스크린리더에서도 빠진다 (iOS·Android)
const COLLAPSED_ARROW = {
  style: styles.inert,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;
