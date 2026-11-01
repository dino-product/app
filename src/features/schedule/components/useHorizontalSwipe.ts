import { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, type GestureResponderHandlers } from 'react-native';

// 달력을 좌우로 밀어 넘긴다. 새 의존성 없이 PanResponder 로 받고 넘김 애니메이션은 없다.
// 한 손가락이 가로로 CLAIM_DISTANCE 를 넘고 세로보다 많이 움직여야 응답자가 되므로,
// 날짜 탭은 안쪽 Pressable 이, 세로 끌기는 리스트가 받는다.
// 밀던 중 리스트가 스크롤을 시작하면 iOS 는 응답자를 넘겨 주고(기본값), Android 는 취소된다. 둘 다 넘기지 않는다.
// 스택 안쪽 화면에 두면 iOS 26 화면 전체 뒤로 가기와 오른쪽 밀기가 겹친다 (지금은 탭 첫 화면에만 있다).

/** 이만큼 가로로 움직이면 날짜 탭이 아니라 밀기로 본다 (pt) */
const CLAIM_DISTANCE = 10;
/** 밀기로 본 지점에서 이만큼 더 밀고 놓으면 넘긴다 (pt) */
const SWIPE_DISTANCE = 40;
/** 덜 밀었어도 같은 방향으로 이만큼 빠르게 튕기면 넘긴다 (pt/ms) */
const FLICK_VELOCITY = 0.3;

export function useHorizontalSwipe(callbacks: {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}): GestureResponderHandlers {
  // 부모가 렌더마다 새 콜백을 넘겨도 PanResponder 는 한 번만 만들고 최신 콜백을 부른다
  const latest = useRef(callbacks);
  useLayoutEffect(() => {
    latest.current = callbacks;
  });

  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy, numberActiveTouches }) =>
        numberActiveTouches === 1 &&
        Math.abs(dx) > CLAIM_DISTANCE &&
        Math.abs(dx) > Math.abs(dy),
      onPanResponderRelease: (_, { dx, vx }) => {
        const far = Math.abs(dx) >= SWIPE_DISTANCE;
        const flick =
          Math.abs(vx) >= FLICK_VELOCITY && Math.sign(vx) === Math.sign(dx);
        if (!far && !flick) {
          return;
        }
        if (dx < 0) {
          latest.current.onSwipeLeft();
        } else {
          latest.current.onSwipeRight();
        }
      },
    }),
  );
  return responder.panHandlers;
}
