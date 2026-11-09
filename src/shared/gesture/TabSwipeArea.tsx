import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Dimensions,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {
  startOwner,
  type GestureOwner,
  type Rect,
  type SwipeDirection,
} from './tabSwipe';
import { useSwipeSwitch } from './useSwipeSwitch';

// 메인 탭 좌우 밀기 (#140). 판정 규칙은 tabSwipe.ts, 넘기는 엔진은 useSwipeSwitch.ts 다.
//
// TabSwipeArea 는 탭 화면 하나를 통째로 감싸 좌우 밀기로 이웃 탭을 고른다 (응답자 잡기·임계값·reject 처리는 useSwipeSwitch).
// RN 모달(Modal·BottomSheet)의 터치도 React 트리를 따라 이 영역까지 올라온다. 지금 탭 첫 화면에는 모달이 없다
// (모달은 탭 안쪽 화면에 있고 거기서는 canSwipe 가 false 다). 탭 첫 화면에 모달을 두면 열린 동안 canSwipe 가 false 가 되게 한다.
//
// 세부 컴포넌트는 useTabSwipeRegion 의 onTouchStart 를 루트에 단다. 터치를 시작한 자리가 그 컴포넌트 안쪽 깊은 곳이면
// 이번 제스처는 컴포넌트 몫이라 탭을 바꾸지 않는다. 가장자리 여유·화면 가장자리 띠에서 시작했으면 탭 전환 몫이다.
// 자체 가로 제스처가 있는 컴포넌트는 ownsGesture() 가 true 일 때만 응답자가 된다 (탭 전환 몫이면 양보한다).
// 터치 이벤트는 응답자 협상 뒤에 바깥(capture) → 안쪽 → 바깥(bubble) 으로 오므로, 이 영역이 capture 에서 제스처를 새로 시작하고
// 안쪽 컴포넌트가 bubble 에서 알린 뒤에 이동 판정이 돈다.
//
// Android 제스처 내비게이션은 화면 좌우 맨 가장자리(시스템 뒤로 가기 폭)에서 시작한 밀기를 먼저 가져간다. 그 폭보다 안쪽의 엄지 띠에서
// 시작하면 탭이 바뀐다. 가장자리 전체를 시스템 제스처에서 빼는 것은 한쪽 200dp 상한이 있어 하지 않는다 (GestureExclusionArea).

type RegionReport = { claimForComponent: () => void };

const TabSwipeContext = createContext<RegionReport | null>(null);

export function TabSwipeArea({
  canSwipe,
  onSwipe,
  testID,
  children,
}: {
  /** 지금 밀어서 탭을 바꿀 수 있는지. 밀 때마다 묻는다 (탭 안쪽 화면이면 false: iOS 뒤로 가기 밀기와 겹친다) */
  canSwipe: () => boolean;
  /** 이웃 탭으로 옮긴다. 한 제스처에 한 번만 부른다 */
  onSwipe: (direction: SwipeDirection) => void;
  testID?: string;
  children: ReactNode;
}) {
  // 이번 제스처가 세부 컴포넌트 안쪽 깊은 곳에서 시작했는지. 첫 손가락이 닿을 때 비우고 안쪽 컴포넌트가 알린다
  const [component] = useState(() => ({ current: false }));
  const latestCanSwipe = useRef(canSwipe);
  useLayoutEffect(() => {
    latestCanSwipe.current = canSwipe;
  });
  const swipe = useSwipeSwitch({
    canSwipe: () => !component.current && latestCanSwipe.current(),
    onSwipe,
  });
  const [area] = useState(() => ({
    onTouchStartCapture: (event: GestureResponderEvent) => {
      component.current = false;
      swipe.onTouchStartCapture(event);
    },
    report: {
      claimForComponent: () => {
        component.current = true;
      },
    },
  }));

  return (
    <TabSwipeContext.Provider value={area.report}>
      <View
        testID={testID}
        style={styles.area}
        onTouchStartCapture={area.onTouchStartCapture}
        {...swipe.panHandlers}
      >
        {children}
      </View>
    </TabSwipeContext.Provider>
  );
}

/** 뷰의 화면 위 사각형 (RN 0.88 DOM API, 동기). 잴 수 없으면(테스트 렌더러·null) null */
export function measureElement(target: unknown): Rect | null {
  if (typeof target !== 'object' || target === null) {
    return null;
  }
  const measurable = target as { getBoundingClientRect?: () => Rect };
  if (typeof measurable.getBoundingClientRect !== 'function') {
    return null;
  }
  const { x, y, width, height } = measurable.getBoundingClientRect();
  return { x, y, width, height };
}

/**
 * 세부 컴포넌트(상세로 들어가는 카드·행, 자체 가로 제스처가 있는 영역)가 쓴다. onTouchStart 를 컴포넌트 루트 뷰에 단다.
 * 터치를 시작한 자리가 컴포넌트 안쪽 깊은 곳이면 탭 전환을 막고, ownsGesture() 가 true 다.
 * 가장자리 여유(COMPONENT_SLACK)·화면 가장자리 띠에서 시작했으면 탭 전환 몫이라 ownsGesture() 가 false 다.
 * 탭 영역(TabSwipeArea) 밖에 두면 양보할 곳이 없어 늘 컴포넌트가 갖는다.
 * stacked 는 위아래로 다른 행과 붙어 있는 행이다 (위·아래 변에 여유를 두지 않는다).
 * measure 로 판정 영역을 따로 잴 수 있다 (예: 작업 이력 리스트에서 머리를 뺀 목록 영역, #153)
 */
export function useTabSwipeRegion({
  stacked = false,
  measure = measureElement,
}: {
  stacked?: boolean;
  /** 판정 영역을 재는 법. 기본은 onTouchStart 를 단 뷰(currentTarget) 그대로다 */
  measure?: (target: GestureResponderEvent['currentTarget']) => Rect | null;
} = {}) {
  const area = useContext(TabSwipeContext);
  // 핸들러는 한 번만 만들고 최신 값을 읽는다 (바뀌는 주인 상태를 렌더 캐시에 두지 않는다)
  const latest = useRef({ area, stacked, measure });
  useLayoutEffect(() => {
    latest.current = { area, stacked, measure };
  });
  const [region] = useState(() => {
    // 처음 닿기 전과 잴 수 없을 때는 컴포넌트 몫이다 (자체 제스처가 그대로 돈다)
    let owner: GestureOwner = 'component';
    return {
      onTouchStart: (event: GestureResponderEvent) => {
        const { touches, changedTouches, pageX, pageY } = event.nativeEvent;
        const current = latest.current;
        if (current.area === null || touches.length > changedTouches.length) {
          return;
        }
        owner = startOwner(
          { x: pageX, y: pageY },
          current.measure(event.currentTarget),
          Dimensions.get('window').width,
          { stacked: current.stacked },
        );
        if (owner === 'component') {
          current.area.claimForComponent();
        }
      },
      ownsGesture: () => owner === 'component',
    };
  });
  return region;
}

const styles = StyleSheet.create({
  area: { flex: 1 },
});
