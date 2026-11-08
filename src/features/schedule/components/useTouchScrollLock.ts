import { useState } from 'react';
import {
  Platform,
  type GestureResponderEvent,
  type NativeTouchEvent,
} from 'react-native';
import { decidePanAxis } from '../../../shared/gesture/panAxis';

type TouchHandler = (event: GestureResponderEvent) => void;

/** 막을 영역(달력)의 루트 뷰에 다는 터치 핸들러 */
export type AreaTouchHandlers = {
  onTouchStart: TouchHandler;
  /** 처음 움직인 방향으로 막을 때만 있다 */
  onTouchMove?: TouchHandler;
  onTouchEnd: TouchHandler;
  onTouchCancel: TouchHandler;
};

type TouchId = NativeTouchEvent['identifier'];

// 리스트 머리의 달력을 만지는 동안 리스트 스크롤을 막는다. 영역마다 막는 방법이 둘이다.
// - areaTouchHandlers (주간 줄, #99): 손가락이 닿아 있는 동안 내내 막는다.
// - axisAreaTouchHandlers (펼친 달력, #144): 처음 움직인 방향(decidePanAxis, 밀기와 같은 규칙)이 가로면 막아 달을 넘기고,
//   세로면 리스트가 스크롤한다. 플랫폼마다 막는 시점이 다르다.
//   - iOS 는 손가락이 닿은 채로 scrollEnabled 를 다시 켜도 그 손길에서는 스크롤하지 않는다. 그래서 닿을 때는 두고
//     가로로 정해질 때 막는다. 그 전에는 리스트의 directionalLockEnabled 가 가로로 시작한 끌기를 세로로 움직이지 않게 한다.
//   - Android 리스트는 세로로 8dp 만 넘어도 가로챈다(밀기가 응답자가 되기 전에). 그래서 닿을 때 막아 두고,
//     세로로 정해지면 푼다. 리스트는 닿은 순간(막기 전)을 이미 봤으므로 다음 움직임에서 가로채 스크롤한다.
//
// 밀기(useHorizontalSwipe)는 가로로 정해져야 응답자가 되므로 그 전의 움직임은 리스트가 받는다.
// iOS 는 JS 응답자가 리스트 안쪽 뷰면 네이티브 스크롤을 막지 못하고, Android 는 응답자가 되기 전에 리스트가 가로챈다.
// 그래서 리스트의 scrollEnabled 를 끄고, 영역에 닿은 손가락이 모두 떨어지거나 취소되면 켠다.
//
// 터치 이벤트(onTouchStart 등)는 응답자와 상관없이 닿은 뷰에서 위로 올라가므로 날짜 탭·밀기는 그대로 받는다.
// 손가락은 번호(identifier)로 센다. 다른 손가락이 영역 밖에 남아 있어도 영역 손가락만 다 떼면 푼다.
// 만지던 뷰가 그사이 사라지면(달을 넘겨 6주가 5주로 줄 때 등) 뗀 이벤트가 오지 않을 수 있어, 손가락이 모두 떨어진 뒤
// 리스트 어디서든 새로 시작한 터치가 남은 손가락을 지운다. 리스트의 capture 가 영역(bubble)보다 먼저 받는다.
// 잠금이 바뀔 때만 다시 그리고 핸들러는 그대로라, 핸들러를 받는 달력은 다시 그리지 않아도 된다.
export function useTouchScrollLock(): {
  locked: boolean;
  /** 주간 줄. 닿아 있는 동안 내내 막는다 */
  areaTouchHandlers: AreaTouchHandlers;
  /** 펼친 달력. 처음 움직인 방향이 가로면 막고 세로면 리스트가 스크롤한다 */
  axisAreaTouchHandlers: Required<AreaTouchHandlers>;
  /** 리스트의 onTouchStartCapture. 영역 밖 터치도 받는다 */
  onListTouchStartCapture: TouchHandler;
} {
  const [locked, setLocked] = useState(false);
  const [handlers] = useState(() => {
    const touching = new Set<TouchId>();
    // 방향을 정하려고 지켜보는 손가락과 닿은 자리. 정했거나 두 손가락이 되면 비운다
    let watching: { id: TouchId; x: number; y: number } | null = null;
    // 같은 값으로 setState 해도 React 가 한 번 더 그릴 수 있어 바뀔 때만 부른다
    let current = false;
    const update = (next: boolean) => {
      if (next !== current) {
        current = next;
        setLocked(next);
      }
    };
    const hold: TouchHandler = ({ nativeEvent }) => {
      nativeEvent.changedTouches.forEach(touch =>
        touching.add(touch.identifier),
      );
    };
    const release: TouchHandler = ({ nativeEvent }) => {
      nativeEvent.changedTouches.forEach(touch =>
        touching.delete(touch.identifier),
      );
      if (touching.size === 0) {
        watching = null;
        update(false);
      }
    };
    return {
      areaTouchHandlers: {
        onTouchStart: (event: GestureResponderEvent) => {
          hold(event);
          update(true);
        },
        onTouchEnd: release,
        onTouchCancel: release,
      },
      axisAreaTouchHandlers: {
        onTouchStart: (event: GestureResponderEvent) => {
          const first = touching.size === 0;
          hold(event);
          const { changedTouches, touches } = event.nativeEvent;
          const [touch] = changedTouches;
          // 화면에 손가락 하나로 시작한 손길만 방향을 본다. 여러 손가락이면 밀기도 응답자가 되지 않는다
          watching =
            first && touches.length === 1
              ? { id: touch.identifier, x: touch.pageX, y: touch.pageY }
              : null;
          if (first && Platform.OS === 'android') {
            update(true);
          }
        },
        onTouchMove: ({ nativeEvent }: GestureResponderEvent) => {
          if (!watching) {
            return;
          }
          // 정하기 전에 화면 다른 곳에 손가락이 닿으면 그 손길은 방향을 보지 않는다 (밀기와 같다)
          if (nativeEvent.touches.length !== 1) {
            watching = null;
            return;
          }
          const { id, x, y } = watching;
          const touch = nativeEvent.touches.find(t => t.identifier === id);
          if (!touch) {
            return;
          }
          const axis = decidePanAxis(touch.pageX - x, touch.pageY - y);
          if (axis) {
            watching = null;
            update(axis === 'horizontal');
          }
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
          watching = null;
          update(false);
        }
      },
    };
  });
  return { locked, ...handlers };
}
