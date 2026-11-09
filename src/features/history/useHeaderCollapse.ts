import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import {
  Animated,
  Platform,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useReduceMotion } from '../../shared/accessibility/useReduceMotion';
import type { ScrollMetrics } from '../../shared/layout/autoHideHeader';
import {
  barTravel,
  COLLAPSE_INITIAL,
  COLLAPSE_MS,
  COLLAPSED_BAR_HEIGHT,
  collapseEasing,
  EXPANDED_BAR_HEIGHT,
  EXPANDED_MONTH_ROW,
  monthTravel,
  nextCollapseState,
  type CollapseState,
} from './headerCollapse';

// 작업 이력 상단 바 접힘 (#175). HistoryHeaderBar 와 함께 쓴다. 판단·키프레임은 headerCollapse.ts.
//
// 바는 리스트 위에 겹쳐 그리고, 리스트 내용 위에 펼친 바 높이만큼 여백(height)을 둔다. 접힌 바는 더 짧아 내용을 더 가리지 않는다.
// - 스크롤 위치는 네이티브 드라이버 이벤트로 받는다. 맨 위에서 당기면(iOS 바운스·당겨서 새로고침) 바가 내용과 함께 내려와
//   새로고침 표시를 가리지 않는다. Android 는 위치가 음수가 되지 않아 progressViewOffset 으로 표시를 바 아래로 내린다.
// - 접을지는 같은 이벤트를 JS 로 받아 순수 함수로 정하고, 바뀔 때만 진행도 하나를 UI 스레드 애니메이션으로 끝까지 돌린다.
//   전환 중에는 판단을 미루고, 끝난 뒤 마지막 위치로 다시 판단해 반대로 돌아간다. 동작 줄이기면 애니메이션 없이 바로 바꾼다.
// - 화면은 접힘 상태가 바뀔 때만 다시 그린다 (바만: 화살표·제목을 스크린리더에서 빼고 누를 수 없게 한다). 스크롤 중에는 그리지 않는다.
//
// 스크롤 뷰는 Animated.FlatList 다. 배열·객체 props 를 참조로 비교하므로 scrollProps 는 한 번 만든 것을 그대로 넘긴다.

/** 잰 높이가 이보다 적게 다르면(픽셀 반올림) 내용 위 여백을 다시 그리지 않는다 (pt) */
const HEIGHT_TOLERANCE = 1;
/** 스크롤 표시줄은 접힌 바 아래에서 시작한다 (스크롤하는 동안은 접혀 있다) */
const SCROLL_INDICATOR_INSETS = { top: COLLAPSED_BAR_HEIGHT };

export type HeaderCollapse = {
  /** 접힘 진행도 (네이티브 값). 0 펼침, 1 접힘. 각 부분은 headerCollapse 의 키프레임으로 보간한다 */
  progress: Animated.Value;
  /** 맨 위에서 당긴 만큼 바를 내리는 거리 */
  pull: Animated.AnimatedNode;
  /** 바 배경을 올리는 거리 (아래 끝이 펼친 바에서 접힌 바로) */
  barShift: Animated.AnimatedNode;
  /** 월 줄을 올리는 거리 (가운데가 접힌 월 글자 자리로) */
  monthShift: Animated.AnimatedNode;
  /** 펼친 바 높이. 스크롤 내용 위 여백으로 쓴다 */
  height: number;
  /** 당겨서 새로고침이 있는 리스트의 progressViewOffset. Android 는 펼친 바 높이, iOS 는 없음(바가 함께 내려온다) */
  progressViewOffset: number | undefined;
  /** 바의 onLayout */
  onBarLayout: (event: LayoutChangeEvent) => void;
  /** 바 안 월 줄의 onLayout */
  onMonthLayout: (event: LayoutChangeEvent) => void;
  /** 접힘 상태가 바뀌면 알린다 (useSyncExternalStore). 돌려준 함수로 구독을 푼다 */
  subscribe: (listener: () => void) => () => void;
  /** 접혔는지. 전환 중이면 향하는 상태다 (접기 시작하면 곧바로 true) */
  isCollapsed: () => boolean;
  /** 스크롤 뷰(Animated.FlatList)에 펼쳐 넣는다 */
  scrollProps: {
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle: number;
    onLayout: (event: LayoutChangeEvent) => void;
    /** 내용이 짧아지면 스크롤 이벤트 없이 맨 위로 돌아갈 수 있다 */
    onContentSizeChange: (width: number, height: number) => void;
    scrollIndicatorInsets: { top: number };
  };
};

export function useHeaderCollapse(): HeaderCollapse {
  const reduceMotion = useReduceMotion();
  const [model] = useState(() => createCollapse(reduceMotion));
  useEffect(() => model.stop, [model]);

  const [height, setHeight] = useState(EXPANDED_BAR_HEIGHT);
  const onBarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height;
      model.setBarHeight(next);
      setHeight(current =>
        Math.abs(next - current) < HEIGHT_TOLERANCE ? current : next,
      );
    },
    [model],
  );

  return useMemo(
    () => ({
      progress: model.progress,
      pull: model.pull,
      barShift: model.barShift,
      monthShift: model.monthShift,
      height,
      progressViewOffset: Platform.OS === 'android' ? height : undefined,
      onBarLayout,
      onMonthLayout: model.onMonthLayout,
      subscribe: model.subscribe,
      isCollapsed: model.isCollapsed,
      scrollProps: model.scrollProps,
    }),
    [model, height, onBarLayout],
  );
}

// 애니메이션 값과 핸들러는 한 번만 만든다. 이벤트가 읽는 상태는 렌더와 따로 둔다
function createCollapse(reduceMotion: RefObject<boolean>) {
  const progress = new Animated.Value(0, { useNativeDriver: true });
  const scrollY = new Animated.Value(0, { useNativeDriver: true });
  const barDistance = new Animated.Value(barTravel(EXPANDED_BAR_HEIGHT), {
    useNativeDriver: true,
  });
  const monthDistance = new Animated.Value(monthTravel(EXPANDED_MONTH_ROW), {
    useNativeDriver: true,
  });

  let state: CollapseState = COLLAPSE_INITIAL;
  // 위치를 받기 전에는 스크롤할 수 없는 것으로 본다 (펼친 채)
  let metrics: ScrollMetrics = {
    offset: 0,
    contentHeight: 0,
    viewportHeight: 0,
  };
  const listeners = new Set<() => void>();

  const finish = () => {
    state = { ...state, running: false };
    settle();
  };

  // 지금 위치로 다시 판단해, 바라는 상태가 다르면 전환을 시작한다
  function settle() {
    const next = nextCollapseState(state, metrics);
    if (next === state) {
      return;
    }
    state = next;
    const toValue = next.collapsed ? 1 : 0;
    if (reduceMotion.current) {
      progress.setValue(toValue);
    } else {
      Animated.timing(progress, {
        toValue,
        duration: COLLAPSE_MS,
        easing: collapseEasing,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // 화면을 떠나 멈춘 것이면 다시 판단하지 않는다
        if (finished) {
          finish();
        }
      });
    }
    listeners.forEach(listener => listener());
    if (reduceMotion.current) {
      finish();
    }
  }

  const onScrollEvent = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    metrics = {
      offset: nativeEvent.contentOffset.y,
      contentHeight: nativeEvent.contentSize.height,
      viewportHeight: nativeEvent.layoutMeasurement.height,
    };
    settle();
  };

  return {
    progress,
    // 맨 위에서 당긴 만큼(음수 위치) 내려온다
    pull: scrollY.interpolate({
      inputRange: [-1, 0],
      outputRange: [1, 0],
      extrapolateRight: 'clamp',
    }),
    barShift: Animated.multiply(progress, barDistance),
    monthShift: Animated.multiply(progress, monthDistance),
    setBarHeight: (height: number) => {
      barDistance.setValue(barTravel(height));
    },
    onMonthLayout: (event: LayoutChangeEvent) => {
      monthDistance.setValue(monthTravel(event.nativeEvent.layout));
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isCollapsed: () => state.collapsed,
    scrollProps: {
      onScroll: Animated.event<NativeScrollEvent>(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true, listener: onScrollEvent },
      ),
      scrollEventThrottle: 16,
      onLayout: (event: LayoutChangeEvent) => {
        metrics = {
          ...metrics,
          viewportHeight: event.nativeEvent.layout.height,
        };
        settle();
      },
      onContentSizeChange: (_width: number, height: number) => {
        metrics = { ...metrics, contentHeight: height };
        settle();
      },
      scrollIndicatorInsets: SCROLL_INDICATOR_INSETS,
    },
    stop: () => progress.stopAnimation(),
  };
}
