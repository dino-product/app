import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useReduceMotion } from '../accessibility/useReduceMotion';
import { useScreenReaderEnabled } from '../accessibility/useScreenReaderEnabled';
import {
  AUTO_HIDE_INITIAL,
  nextAutoHideState,
  type AutoHideState,
} from './autoHideHeader';
import { TAB_HEADER_HEIGHT } from './TabHeader';

// 탭 첫 화면 상단 바 자동 숨김 (#148). AutoHideHeaderLayout 과 함께 쓴다.
//
// 상단 바는 리스트 위에 겹쳐 그리고, 리스트 내용 위에 상단 바 높이만큼 여백(height)을 둔다. 그래서 상단 바가 위로
// 올라가 숨으면 그만큼 내용이 보이는 영역이 넓어지고, 레이아웃(리스트 크기)은 바뀌지 않는다.
//
// - 스크롤 위치는 네이티브 드라이버 이벤트로 받아 맨 위에서 당길 때(iOS 바운스·당겨서 새로고침) 상단 바가 내용과 함께
//   내려온다. 새로고침 표시가 상단 바에 가리지 않는다. Android 는 위치가 음수가 되지 않아 progressViewOffset 으로 내린다.
// - 숨길지는 같은 이벤트를 JS 로 받아 순수 함수(nextAutoHideState)로 정하고, 바뀔 때만 UI 스레드 애니메이션을 시작한다.
//   스크롤 중에 상태(setState)를 바꾸지 않아 다시 그리지 않는다.
// - 동작 줄이기면 애니메이션 없이 바로 옮긴다. 스크린리더를 쓰는 동안은 숨기지 않는다: 화면 밖으로 옮긴 버튼은
//   스크린리더로 두 번 탭해도 그 자리(화면 밖)를 누르게 되어 눌리지 않는다. 숨은 동안에도 접근성 트리에서 빼지 않는다.
//
// 스크롤 뷰는 Animated.FlatList · Animated.ScrollView 다. 이 컴포넌트는 배열·객체 props 를 참조로 비교해 바뀌면 네이티브
// 스크롤 이벤트 연결을 다시 만들고 한 번 더 그린다. contentContainerStyle 같은 배열·객체는 useMemo 로 메모해 넘긴다.

/** 숨고 나타나는 시간 (ms) */
export const AUTO_HIDE_MS = 200;
const easing = Easing.out(Easing.cubic);
/** 잰 높이가 이보다 적게 다르면(픽셀 반올림) 내용 위 여백을 다시 그리지 않는다 (pt) */
const HEIGHT_TOLERANCE = 1;

/**
 * 기본 글자 크기에서의 높이. 처음 그릴 때 내용 위 여백으로 쓰고, 그린 뒤 잰 높이와 다르면(큰 글자) 한 번 고친다.
 * collapsible: 숨는 부분(상단 바), total: 겹쳐 그리는 머리 전체 (늘 보이는 하위 탭까지)
 */
export type AutoHideHeaderEstimate = { collapsible: number; total: number };

const TAB_HEADER_ONLY: AutoHideHeaderEstimate = {
  collapsible: TAB_HEADER_HEIGHT,
  total: TAB_HEADER_HEIGHT,
};

export type AutoHideHeader = {
  /** 머리를 옮기는 거리 (네이티브 값) */
  translateY: Animated.AnimatedNode;
  /** 머리 전체 높이. 스크롤 내용 위 여백에 더하고, 당겨서 새로고침이 있으면 progressViewOffset 으로도 준다 (Android) */
  height: number;
  /** 머리 전체의 onLayout */
  onHeaderLayout: (event: LayoutChangeEvent) => void;
  /** 숨는 부분(상단 바)의 onLayout */
  onCollapsibleLayout: (event: LayoutChangeEvent) => void;
  /** 스크롤 뷰(Animated.FlatList · Animated.ScrollView)에 펼쳐 넣는다 */
  scrollProps: {
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle: number;
    /** 스크롤 뷰가 새로 자리 잡으면(하위 탭을 바꿔 다른 리스트가 그려짐, 화면 크기 바뀜) 맨 위이므로 다시 보인다 */
    onLayout: () => void;
    scrollIndicatorInsets: { top: number };
  };
};

export function useAutoHideHeader(
  estimate: AutoHideHeaderEstimate = TAB_HEADER_ONLY,
): AutoHideHeader {
  const reduceMotion = useReduceMotion();
  const [model] = useState(() =>
    createAutoHide(reduceMotion, estimate.collapsible),
  );
  useScreenReaderEnabled(model.setScreenReader);
  useEffect(() => model.stop, [model]);

  const [height, setHeight] = useState(estimate.total);
  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setHeight(current =>
      Math.abs(next - current) < HEIGHT_TOLERANCE ? current : next,
    );
  }, []);

  return useMemo(
    () => ({
      translateY: model.translateY,
      height,
      onHeaderLayout,
      onCollapsibleLayout: model.onCollapsibleLayout,
      scrollProps: {
        onScroll: model.onScroll,
        scrollEventThrottle: 16,
        onLayout: model.show,
        scrollIndicatorInsets: { top: height },
      },
    }),
    [model, height, onHeaderLayout],
  );
}

// 애니메이션 값과 스크롤 핸들러는 한 번만 만든다. 이벤트가 읽는 상태는 렌더와 따로 둔다
function createAutoHide(
  reduceMotion: RefObject<boolean>,
  initialDistance: number,
) {
  const scrollY = new Animated.Value(0, { useNativeDriver: true });
  /** 0 보임, 1 숨음 */
  const progress = new Animated.Value(0, { useNativeDriver: true });
  /** 숨는 거리 (상단 바 높이) */
  const distance = new Animated.Value(initialDistance, {
    useNativeDriver: true,
  });
  // 맨 위에서 당긴 만큼(음수 위치) 내려오고, 숨은 만큼 올라간다
  const pull = scrollY.interpolate({
    inputRange: [-1, 0],
    outputRange: [1, 0],
    extrapolateRight: 'clamp',
  });
  const translateY = Animated.subtract(
    pull,
    Animated.multiply(progress, distance),
  );

  let state: AutoHideState = AUTO_HIDE_INITIAL;
  let topZone = initialDistance;
  let screenReader = false;

  const update = (next: AutoHideState) => {
    if (next.hidden !== state.hidden) {
      const toValue = next.hidden ? 1 : 0;
      if (reduceMotion.current) {
        progress.setValue(toValue);
      } else {
        Animated.timing(progress, {
          toValue,
          duration: AUTO_HIDE_MS,
          easing,
          useNativeDriver: true,
        }).start();
      }
    }
    state = next;
  };
  const show = () => update(AUTO_HIDE_INITIAL);

  const onScrollEvent = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (screenReader) {
      return;
    }
    update(
      nextAutoHideState(
        state,
        {
          offset: nativeEvent.contentOffset.y,
          contentHeight: nativeEvent.contentSize.height,
          viewportHeight: nativeEvent.layoutMeasurement.height,
        },
        topZone,
      ),
    );
  };

  return {
    translateY,
    onScroll: Animated.event<NativeScrollEvent>(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true, listener: onScrollEvent },
    ),
    show,
    onCollapsibleLayout: (event: LayoutChangeEvent) => {
      topZone = event.nativeEvent.layout.height;
      distance.setValue(topZone);
    },
    setScreenReader: (enabled: boolean) => {
      screenReader = enabled;
      if (enabled) {
        show();
      }
    },
    stop: () => progress.stopAnimation(),
  };
}
