import { act } from '@testing-library/react-native';
import type {
  GestureResponderEvent,
  GestureResponderHandlers,
} from 'react-native';

// 끌기를 RN 응답자 시스템이 부르는 순서대로 뷰의 핸들러에 보낸다.
// RNTL fireEvent 는 터치 시작을 거절하는 응답자(움직인 뒤에야 응답자가 되는 PanResponder)의
// 이벤트를 막으므로, 화면 요소의 props 에서 핸들러를 꺼내 직접 부른다.

type Point = { x: number; y: number };

const FRAME_MS = 16;

/** 손가락 fingers 개가 prev 에서 current 로 함께 움직인 이벤트 */
function touchEvent(
  prev: Point,
  current: Point,
  step: number,
  fingers: number,
  active: boolean,
): GestureResponderEvent {
  const timestamp = step * FRAME_MS;
  const touchBank = Array.from({ length: fingers }, () => ({
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
  }));
  return {
    nativeEvent: {
      pageX: current.x,
      pageY: current.y,
      timestamp,
      touches: active ? touchBank.map(() => ({ ...current })) : [],
    },
    touchHistory: {
      numberActiveTouches: active ? fingers : 0,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: timestamp,
      touchBank,
    },
  } as unknown as GestureResponderEvent;
}

export type DragResult = {
  /** 움직이는 도중 응답자가 됐는지 */
  granted: boolean;
  /** cancelAt 에서 응답자를 넘겨 줬는지 */
  released?: boolean;
};

/**
 * (0,0) 에서 (dx,dy) 까지 steps 번(한 번에 16ms)에 고르게 끈다.
 * cancelAt 번째 이동 뒤에는 바깥(리스트 스크롤 등)이 응답자를 달라고 한다. 넘겨 주면 거기서 끝난다.
 */
export async function drag(
  handlers: GestureResponderHandlers,
  {
    dx,
    dy = 0,
    steps = 10,
    fingers = 1,
    cancelAt,
  }: {
    dx: number;
    dy?: number;
    steps?: number;
    fingers?: number;
    cancelAt?: number;
  },
): Promise<DragResult> {
  const at = (step: number): Point => ({
    x: (dx * Math.min(step, steps)) / steps,
    y: (dy * Math.min(step, steps)) / steps,
  });
  const event = (step: number, active = true) =>
    touchEvent(at(step - 1), at(step), step, fingers, active);
  const result: DragResult = { granted: false };

  await act(() => {
    const start = touchEvent(at(0), at(0), 0, fingers, true);
    handlers.onStartShouldSetResponderCapture?.(start);
    if (handlers.onStartShouldSetResponder?.(start)) {
      handlers.onResponderGrant?.(start);
      handlers.onResponderStart?.(start);
      result.granted = true;
    }

    for (let step = 1; step <= steps; step++) {
      const move = event(step);
      if (!result.granted) {
        // 응답자가 되기 전에는 이동마다 capture → bubble 순으로 응답자가 될지 묻는다
        handlers.onMoveShouldSetResponderCapture?.(move);
        if (handlers.onMoveShouldSetResponder?.(move)) {
          handlers.onResponderGrant?.(move);
          result.granted = true;
        }
      }
      // 응답자가 된 이벤트도 곧바로 move 로 다시 온다
      if (result.granted) {
        handlers.onResponderMove?.(move);
      }
      if (result.granted && step === cancelAt) {
        result.released =
          handlers.onResponderTerminationRequest?.(move) ?? true;
        if (result.released) {
          handlers.onResponderTerminate?.(move);
          return;
        }
      }
    }

    if (result.granted) {
      // 손을 떼면 end 다음에 release 가 온다
      const end = event(steps + 1, false);
      handlers.onResponderEnd?.(end);
      handlers.onResponderRelease?.(end);
    }
  });

  return result;
}
