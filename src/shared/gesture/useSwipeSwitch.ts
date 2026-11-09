import { useLayoutEffect, useRef, useState } from 'react';
import {
  PanResponder,
  type GestureResponderEvent,
  type GestureResponderHandlers,
  type PanResponderGestureState,
} from 'react-native';
import {
  decideTabSwipe,
  swipeDirection,
  type SwipeDirection,
} from './tabSwipe';

// 좌우로 밀어 이웃(탭·달)으로 한 번 넘기는 판정 엔진 (#140 탭 전환, #153 작업 이력 월 넘김).
// 판정 규칙은 tabSwipe.ts 의 decideTabSwipe 다 (손바닥 오작동 방지 임계값·수평 30°·두 손가락 무시).
//
// 터치를 시작할 때는 응답자가 되지 않고(누르기·스크롤은 안쪽 몫), 한 손가락의 방향이 가로로 정해지면(10pt) bubble 단계에서
// 응답자가 되고, 가로로 임계값을 넘는 순간 넘긴다 (손을 떼기 전에 전환이 시작된다). 응답자를 먼저 잡는 것은 네이티브 부모의
// 가로채기를 막기 위해서다 (Android 세로 리스트는 세로로 터치 슬롭만 움직여도 터치를 가져간다. 응답자가 되면 PanResponder
// 기본값으로 막는다). RN 은 새 응답자에게 grant 를 먼저 보내고 지금 응답자가 놓아 주지 않으면 reject 를 보내므로,
// 넘기기는 grant 가 아니라 응답자가 된 뒤 오는 이동(또는 손을 뗄 때)에서 한다.
// 안쪽 누르기(Pressable)는 응답자를 놓아 주므로 누르기가 취소된다.

export type SwipeSwitch = {
  /** 미는 뷰에 단다 */
  panHandlers: GestureResponderHandlers;
  /** 미는 뷰의 onTouchStartCapture. 첫 손가락이 닿을 때 제스처를 새로 시작한다 */
  onTouchStartCapture: (event: GestureResponderEvent) => void;
};

export function useSwipeSwitch(options: {
  /** 이번 제스처를 받을 수 있는지. 응답자가 되기 전 이동마다 묻고, false 면 그 제스처는 끝까지 받지 않는다 */
  canSwipe: () => boolean;
  /** 넘긴다. 한 제스처에 한 번만 부른다 */
  onSwipe: (direction: SwipeDirection) => void;
}): SwipeSwitch {
  // PanResponder 는 한 번만 만들고 최신 값을 읽는다
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const [swipe] = useState(() => {
    // 지금 제스처. 첫 손가락이 닿을 때 새로 시작한다
    const gesture = {
      /** 이번 제스처는 판정이 끝났다 (넘겼거나, 받지 않는다) */
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
        if (gesture.settled) {
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
        gesture.settled =
          nativeEvent.touches.length > nativeEvent.changedTouches.length;
      },
    };
  });
  return swipe;
}
