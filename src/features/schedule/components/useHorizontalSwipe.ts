import { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, type GestureResponderHandlers } from 'react-native';

// 달력을 좌우로 밀어 넘긴다. 새 의존성 없이 RN PanResponder 로 받고, 넘김 애니메이션은 두지 않는다.
// - 터치 시작으로는 응답자가 되지 않는다. 날짜 탭은 안쪽 Pressable 이 그대로 받는다.
// - 가로로 CLAIM_DISTANCE 를 넘고 세로보다 많이 움직여야 응답자가 된다. 세로로 밀면 리스트 스크롤이 받는다.
// - 밀던 중 리스트가 스크롤을 시작해 응답자를 달라고 하면 넘겨 주고(PanResponder 기본값) 넘기지 않는다.
// - 내 일정은 탭 첫 화면이라 뒤로 가기 제스처가 없다. 스택 안쪽 화면에 두면
//   iOS 26 화면 전체 뒤로 가기(오른쪽으로 밀기)와 겹치므로 그 화면의 fullScreenGestureEnabled 를 먼저 정한다.

/** 이만큼 가로로 움직이면 날짜 탭이 아니라 밀기로 본다 (pt) */
const CLAIM_DISTANCE = 10;
/** 밀기로 본 지점에서 이만큼 더 밀고 놓아야 넘긴다 (pt) */
const SWIPE_DISTANCE = 40;

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
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > CLAIM_DISTANCE && Math.abs(dx) > Math.abs(dy),
      onPanResponderRelease: (_, { dx }) => {
        if (dx <= -SWIPE_DISTANCE) {
          latest.current.onSwipeLeft();
        } else if (dx >= SWIPE_DISTANCE) {
          latest.current.onSwipeRight();
        }
      },
    }),
  );
  return responder.panHandlers;
}
