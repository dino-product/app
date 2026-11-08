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
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import {
  decideTabSwipe,
  startOwner,
  swipeDirection,
  type GestureOwner,
  type Rect,
  type SwipeDirection,
} from './tabSwipe';

// 메인 탭 좌우 밀기 (#140). 판정 규칙은 tabSwipe.ts 다.
//
// TabSwipeArea 는 탭 화면 하나를 통째로 감싸는 PanResponder 다. 터치를 시작할 때는 응답자가 되지 않고(누르기·스크롤은 안쪽 몫),
// 한 손가락의 방향이 가로로 정해지면(10pt) bubble 단계에서 응답자가 되고, 가로로 임계값을 넘는 순간 이웃 탭으로 옮긴다
// (손을 떼기 전에 전환이 시작된다). 응답자를 먼저 잡는 것은 네이티브 부모의 가로채기를 막기 위해서다 (Android 세로 리스트는
// 세로로 터치 슬롭만 움직여도 터치를 가져간다. 응답자가 되면 PanResponder 기본값으로 막는다).
// RN 은 새 응답자에게 grant 를 먼저 보내고 지금 응답자가 놓아 주지 않으면 reject 를 보내므로, 탭은 grant 가 아니라
// 응답자가 된 뒤 오는 이동(또는 손을 뗄 때)에서 바꾼다. 안쪽 누르기(Pressable)는 응답자를 놓아 주므로 누르기가 취소되고,
// 자체 가로 제스처(달력 넘김 등)는 아래 규칙으로 먼저 받는다.
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
  // PanResponder 는 한 번만 만들고 최신 값을 읽는다
  const latest = useRef({ canSwipe, onSwipe });
  useLayoutEffect(() => {
    latest.current = { canSwipe, onSwipe };
  });

  const [area] = useState(() => {
    // 지금 제스처. 첫 손가락이 닿을 때 새로 시작한다
    const gesture = {
      /** 세부 컴포넌트 안쪽 깊은 곳에서 시작했다 */
      component: false,
      /** 이번 제스처는 판정이 끝났다 (바꿨거나, 탭 전환이 아니다) */
      settled: false,
      /** 응답자가 되기까지 움직인 거리. 응답자가 되면 PanResponder 가 dx·dy 를 0 부터 다시 잰다 */
      claimedAt: { dx: 0, dy: 0 },
    };
    // 응답자가 된 뒤의 이동: 시작점부터 움직인 거리로 판정한다
    const follow = (
      _: GestureResponderEvent,
      { dx, dy, numberActiveTouches }: PanResponderGestureState,
    ) => {
      if (gesture.settled) {
        return;
      }
      const total = {
        dx: gesture.claimedAt.dx + dx,
        dy: gesture.claimedAt.dy + dy,
      };
      const decision = decideTabSwipe({
        ...total,
        touches: numberActiveTouches,
      });
      if (decision === 'ignore') {
        gesture.settled = true;
      } else if (decision === 'switch') {
        gesture.settled = true;
        latest.current.onSwipe(swipeDirection(total.dx));
      }
    };
    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy, numberActiveTouches }) => {
        if (gesture.settled || gesture.component) {
          return false;
        }
        if (!latest.current.canSwipe()) {
          gesture.settled = true;
          return false;
        }
        const decision = decideTabSwipe({
          dx,
          dy,
          touches: numberActiveTouches,
        });
        if (decision === 'ignore') {
          gesture.settled = true;
          return false;
        }
        if (decision === 'wait') {
          return false;
        }
        gesture.claimedAt = { dx, dy };
        return true;
      },
      // 지금 응답자(안쪽 리스트 등)가 놓아 주지 않았다. 이번 제스처는 그쪽 몫이다
      onPanResponderReject: () => {
        gesture.settled = true;
      },
      onPanResponderMove: follow,
      // 한 번에 크게 움직이고 바로 떼면 응답자가 된 뒤의 이동이 없다
      onPanResponderRelease: follow,
    });
    return {
      panHandlers: responder.panHandlers,
      onTouchStartCapture: ({ nativeEvent }: GestureResponderEvent) => {
        // 이번에 닿은 손가락 말고 다른 손가락이 이미 닿아 있으면 두 손가락 이상이다
        if (nativeEvent.touches.length > nativeEvent.changedTouches.length) {
          gesture.settled = true;
          return;
        }
        gesture.component = false;
        gesture.settled = false;
      },
      report: {
        claimForComponent: () => {
          gesture.component = true;
        },
      },
    };
  });

  return (
    <TabSwipeContext.Provider value={area.report}>
      <View
        testID={testID}
        style={styles.area}
        onTouchStartCapture={area.onTouchStartCapture}
        {...area.panHandlers}
      >
        {children}
      </View>
    </TabSwipeContext.Provider>
  );
}

/** 이벤트를 단 뷰의 화면 위 사각형. 잴 수 없으면(테스트 렌더러 등) null */
function regionRect(
  target: GestureResponderEvent['currentTarget'],
): Rect | null {
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
 * stacked 는 위아래로 다른 행과 붙어 있는 행이다 (위·아래 변에 여유를 두지 않는다)
 */
export function useTabSwipeRegion({
  stacked = false,
}: { stacked?: boolean } = {}) {
  const area = useContext(TabSwipeContext);
  // 핸들러는 한 번만 만들고 최신 값을 읽는다 (바뀌는 주인 상태를 렌더 캐시에 두지 않는다)
  const latest = useRef({ area, stacked });
  useLayoutEffect(() => {
    latest.current = { area, stacked };
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
          regionRect(event.currentTarget),
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
