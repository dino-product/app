import { useState } from 'react';
import type { GestureResponderEvent, NativeTouchEvent } from 'react-native';

type TouchHandler = (event: GestureResponderEvent) => void;

/** 막을 영역(달력)의 루트 뷰에 다는 터치 핸들러 */
export type AreaTouchHandlers = {
  onTouchStart: TouchHandler;
  onTouchEnd: TouchHandler;
  onTouchCancel: TouchHandler;
};

// 영역(리스트 머리의 달력)에 손가락이 닿아 있는 동안 리스트 스크롤을 막는다 (#99).
// 밀기(useHorizontalSwipe)는 가로로 10pt 넘게 움직여야 응답자가 되므로 그 전의 움직임과 세로 성분은 리스트가 받는다.
// iOS 는 JS 응답자가 리스트 안쪽 뷰면 네이티브 스크롤을 막지 못하고, Android 는 응답자가 되기 전에 리스트가 가로챈다.
// 그래서 닿는 순간 리스트의 scrollEnabled 를 끄고, 영역에 닿은 손가락이 모두 떨어지거나 취소되면 켠다.
//
// 터치 이벤트(onTouchStart 등)는 응답자와 상관없이 닿은 뷰에서 위로 올라가므로 날짜 탭·밀기는 그대로 받는다.
// 손가락은 번호(identifier)로 센다. 다른 손가락이 영역 밖에 남아 있어도 영역 손가락만 다 떼면 푼다.
// 만지던 뷰가 그사이 사라지면(달을 넘겨 6주가 5주로 줄 때 등) 뗀 이벤트가 오지 않을 수 있어, 손가락이 모두 떨어진 뒤
// 리스트 어디서든 새로 시작한 터치가 남은 손가락을 지운다. 리스트의 capture 가 영역(bubble)보다 먼저 받는다.
// 잠금이 바뀔 때만 다시 그리고 핸들러는 그대로라, 핸들러를 받는 달력은 다시 그리지 않아도 된다.
export function useTouchScrollLock(): {
  locked: boolean;
  areaTouchHandlers: AreaTouchHandlers;
  /** 리스트의 onTouchStartCapture. 영역 밖 터치도 받는다 */
  onListTouchStartCapture: TouchHandler;
} {
  const [locked, setLocked] = useState(false);
  const [handlers] = useState(() => {
    const touching = new Set<NativeTouchEvent['identifier']>();
    // 같은 값으로 setState 해도 React 가 한 번 더 그릴 수 있어 바뀔 때만 부른다
    let current = false;
    const update = (next: boolean) => {
      if (next !== current) {
        current = next;
        setLocked(next);
      }
    };
    const release: TouchHandler = ({ nativeEvent }) => {
      nativeEvent.changedTouches.forEach(touch =>
        touching.delete(touch.identifier),
      );
      if (touching.size === 0) {
        update(false);
      }
    };
    return {
      areaTouchHandlers: {
        onTouchStart: ({ nativeEvent }: GestureResponderEvent) => {
          nativeEvent.changedTouches.forEach(touch =>
            touching.add(touch.identifier),
          );
          update(true);
        },
        onTouchEnd: release,
        onTouchCancel: release,
      },
      onListTouchStartCapture: ({ nativeEvent }: GestureResponderEvent) => {
        // 이번에 닿은 손가락 말고는 화면에 없다. 남은 손가락은 뗀 이벤트를 놓친 것이다
        const onlyNewTouches =
          nativeEvent.touches.length <= nativeEvent.changedTouches.length;
        if (onlyNewTouches && touching.size > 0) {
          touching.clear();
          update(false);
        }
      },
    };
  });
  return { locked, ...handlers };
}
