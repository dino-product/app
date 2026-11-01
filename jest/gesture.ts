import { act } from '@testing-library/react-native';
import type {
  GestureResponderEvent,
  GestureResponderHandlers,
} from 'react-native';

// 한 손가락 끌기를 RN 응답자 시스템이 부르는 순서대로 뷰의 핸들러에 보낸다.
// RNTL fireEvent 는 터치 시작을 거절하는 응답자(움직인 뒤에야 응답자가 되는 PanResponder)의
// 이벤트를 막으므로, 화면 요소의 props 에서 핸들러를 꺼내 직접 부른다.

type Point = { x: number; y: number };

const FRAME_MS = 16;

function touchEvent(
  prev: Point,
  current: Point,
  step: number,
  active: boolean,
): GestureResponderEvent {
  const timestamp = step * FRAME_MS;
  return {
    nativeEvent: {
      pageX: current.x,
      pageY: current.y,
      timestamp,
      touches: active ? [{ pageX: current.x, pageY: current.y }] : [],
    },
    touchHistory: {
      numberActiveTouches: active ? 1 : 0,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: timestamp,
      touchBank: [
        {
          touchActive: active,
          startPageX: 0,
          startPageY: 0,
          startTimeStamp: 0,
          currentPageX: current.x,
          currentPageY: current.y,
          currentTimeStamp: timestamp,
          previousPageX: prev.x,
          previousPageY: prev.y,
          previousTimeStamp: timestamp - FRAME_MS,
        },
      ],
    },
  } as unknown as GestureResponderEvent;
}

export type DragResult = {
  /** 움직이는 도중 응답자가 됐는지 */
  granted: boolean;
  /** cancel 일 때 응답자를 넘겨 줬는지 */
  released?: boolean;
};

/**
 * (0,0) 에서 (dx,dy) 까지 steps 번에 고르게 끈다.
 * cancel 이면 손을 떼기 전에 바깥(리스트 스크롤 등)이 응답자를 달라고 한다.
 */
export async function drag(
  handlers: GestureResponderHandlers,
  {
    dx,
    dy = 0,
    steps = 10,
    cancel = false,
  }: { dx: number; dy?: number; steps?: number; cancel?: boolean },
): Promise<DragResult> {
  const at = (step: number): Point => ({
    x: (dx * step) / steps,
    y: (dy * step) / steps,
  });
  const result: DragResult = { granted: false };

  await act(() => {
    handlers.onStartShouldSetResponderCapture?.(
      touchEvent(at(0), at(0), 0, true),
    );
    if (
      handlers.onStartShouldSetResponder?.(touchEvent(at(0), at(0), 0, true))
    ) {
      handlers.onResponderGrant?.(touchEvent(at(0), at(0), 0, true));
      result.granted = true;
    }

    for (let step = 1; step <= steps; step++) {
      const event = touchEvent(at(step - 1), at(step), step, true);
      if (!result.granted) {
        // 응답자가 되기 전에는 이동마다 capture → bubble 순으로 응답자가 될지 묻는다
        handlers.onMoveShouldSetResponderCapture?.(event);
        if (handlers.onMoveShouldSetResponder?.(event)) {
          handlers.onResponderGrant?.(event);
          result.granted = true;
        }
      }
      // 응답자가 된 이벤트도 곧바로 move 로 다시 온다
      if (result.granted) {
        handlers.onResponderMove?.(event);
      }
    }

    if (!result.granted) {
      return;
    }
    const end = touchEvent(at(steps), at(steps), steps, false);
    if (cancel) {
      result.released = handlers.onResponderTerminationRequest?.(end) ?? true;
      if (result.released) {
        handlers.onResponderTerminate?.(end);
        return;
      }
    }
    handlers.onResponderRelease?.(end);
  });

  return result;
}
