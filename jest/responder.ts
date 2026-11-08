import { act, type screen } from '@testing-library/react-native';
import type {
  GestureResponderEvent,
  GestureResponderHandlers,
} from 'react-native';
import { drag, touchEvent, type DragResult, type Point } from './gesture';

// 화면 요소에서 시작한 끌기를 RN 응답자 협상 순서대로 흉내 낸다.
// 터치가 시작된 요소부터 위로 올라가는 조상 중 누가 응답자가 되는지는 RN 이 정한다:
// capture 는 바깥(루트)부터 안쪽으로, bubble 은 안쪽(터치한 요소)부터 바깥으로 묻는다.
// drag 는 핸들러 하나만 받으므로, 조상들의 핸들러를 하나로 묶어 응답자가 된 요소에 이벤트를 보낸다.
// 응답자가 생기기 전까지만 협상한다 (응답자를 빼앗는 경우는 흉내 내지 않는다).
// 테스트 렌더러에는 네이티브 스크롤이 없어, 스크롤 뷰 안에서 시작한 끌기를 JS 응답자가 가져가는지 확인하는 데 쓴다.

type HostElement = ReturnType<typeof screen.getByRole>;
type Handlers = Partial<GestureResponderHandlers>;
type ShouldSet = (event: GestureResponderEvent) => boolean;

/** 터치한 요소부터 루트까지 (안쪽 → 바깥) */
function ancestorsOf(element: HostElement): Handlers[] {
  const chain: Handlers[] = [];
  for (let node: HostElement | null = element; node; node = node.parent) {
    chain.push(node.props as Handlers);
  }
  return chain;
}

export async function dragFrom(
  element: HostElement,
  options: Parameters<typeof drag>[1],
): Promise<DragResult> {
  const chain = ancestorsOf(element);
  let responder: Handlers | undefined;
  const negotiate =
    (capture: keyof Handlers, bubble: keyof Handlers): ShouldSet =>
    event => {
      const ask = (handlers: Handlers, key: keyof Handlers) =>
        (handlers[key] as ShouldSet | undefined)?.(event) === true;
      const found =
        [...chain].reverse().find(handlers => ask(handlers, capture)) ??
        chain.find(handlers => ask(handlers, bubble));
      responder = found;
      return found !== undefined;
    };
  const forward =
    (key: keyof Handlers) =>
    (event: GestureResponderEvent): boolean | void =>
      (
        responder?.[key] as
          | ((e: GestureResponderEvent) => boolean | void)
          | undefined
      )?.(event);

  return drag(
    {
      onStartShouldSetResponder: negotiate(
        'onStartShouldSetResponderCapture',
        'onStartShouldSetResponder',
      ),
      onMoveShouldSetResponder: negotiate(
        'onMoveShouldSetResponderCapture',
        'onMoveShouldSetResponder',
      ),
      onResponderGrant: forward('onResponderGrant'),
      onResponderStart: forward('onResponderStart'),
      onResponderMove: forward('onResponderMove'),
      onResponderEnd: forward('onResponderEnd'),
      onResponderRelease: forward('onResponderRelease'),
      onResponderTerminationRequest: event =>
        (forward('onResponderTerminationRequest')(event) as
          | boolean
          | undefined) ?? true,
      onResponderTerminate: forward('onResponderTerminate'),
    } as GestureResponderHandlers,
    options,
  );
}

type Rect = { x: number; y: number; width: number; height: number };

export type SwipeOptions = {
  /** 손가락이 처음 닿은 화면 좌표 */
  from: Point;
  dx?: number;
  dy?: number;
  /** from 에서 지나갈 상대 위치들. 주면 dx·dy·steps 대신 쓴다 */
  path?: readonly Point[];
  steps?: number;
  fingers?: number;
  /** 요소마다의 화면 사각형. 이벤트의 currentTarget.getBoundingClientRect 가 돌려준다 (없는 요소는 잴 수 없다) */
  rects?: ReadonlyMap<HostElement, Rect>;
};

/**
 * 화면 요소에서 시작한 밀기를 RN 응답자 시스템처럼 흉내 낸다. dragFrom 과 달리
 * - 터치 이벤트(onTouchStartCapture → onTouchStart)를 응답자 협상 뒤에 보낸다. currentTarget 은 그 핸들러를 단 요소다
 * - 응답자가 있어도 이동마다 그 조상에게 응답자를 달라고 할지 묻고, 응답자가 놓아 주면(termination request) 넘긴다.
 *   그래서 누르기(Pressable)로 시작한 터치를 바깥 PanResponder 가 가져가는 경우를 볼 수 있다
 * 손가락은 from 에서 시작해 함께 움직인다. 돌려주는 값은 마지막 응답자의 props (없으면 undefined) 다
 */
export async function swipeFrom(
  element: HostElement,
  { from, dx = 0, dy = 0, path, steps = 10, fingers = 1, rects }: SwipeOptions,
): Promise<Handlers | undefined> {
  const nodes: HostElement[] = [];
  for (let node: HostElement | null = element; node; node = node.parent) {
    nodes.push(node);
  }
  const chain = nodes.map(node => node.props as Handlers);
  const points: Point[] = (
    path ??
    Array.from({ length: steps + 1 }, (_, step) => ({
      x: (dx * step) / steps,
      y: (dy * step) / steps,
    }))
  ).map(point => ({ x: from.x + point.x, y: from.y + point.y }));
  const last = points.length - 1;

  // Pressable 이 응답자가 되면 event.persist·currentTarget.measure 를 부른다
  const responderEvent = (step: number, active = true) => {
    const event = touchEvent(
      points[Math.max(0, Math.min(step, last) - 1)],
      points[Math.min(step, last)],
      step,
      fingers,
      active,
    );
    const touch = { identifier: 0, ...points[Math.min(step, last)] };
    return Object.assign(event, {
      persist: () => {},
      currentTarget: { measure: () => {} },
      nativeEvent: {
        ...event.nativeEvent,
        changedTouches: [touch],
        locationX: 0,
        locationY: 0,
      },
    });
  };

  let responder: number | null = null;
  // 응답자가 없으면 터치한 요소부터, 있으면 응답자의 조상만 묻는다 (응답자 자신은 건너뛴다)
  const negotiate = (
    capture: keyof Handlers,
    bubble: keyof Handlers,
    event: GestureResponderEvent,
  ): number | null => {
    const first = responder === null ? 0 : responder + 1;
    const ask = (index: number, key: keyof Handlers) =>
      (chain[index][key] as ShouldSet | undefined)?.(event) === true;
    for (let index = chain.length - 1; index >= first; index--) {
      if (ask(index, capture)) {
        return index;
      }
    }
    for (let index = first; index < chain.length; index++) {
      if (ask(index, bubble)) {
        return index;
      }
    }
    return null;
  };
  const claim = (index: number, event: GestureResponderEvent) => {
    const current = responder === null ? undefined : chain[responder];
    if (current && current.onResponderTerminationRequest?.(event) === false) {
      chain[index].onResponderReject?.(event);
      return;
    }
    chain[index].onResponderGrant?.(event);
    current?.onResponderTerminate?.(event);
    responder = index;
  };
  type TouchHandler = (event: GestureResponderEvent) => void;
  const touchHandler = (index: number, key: string) =>
    (chain[index] as Record<string, unknown>)[key] as TouchHandler | undefined;
  const touchStartEvent = (index: number) => {
    const rect = rects?.get(nodes[index]);
    const touches = Array.from({ length: fingers }, (_, identifier) => ({
      identifier,
      pageX: from.x,
      pageY: from.y,
    }));
    return {
      nativeEvent: {
        pageX: from.x,
        pageY: from.y,
        touches,
        changedTouches: touches,
        timestamp: 0,
      },
      currentTarget: rect ? { getBoundingClientRect: () => rect } : {},
    } as unknown as GestureResponderEvent;
  };

  await act(() => {
    const start = responderEvent(0);
    const startResponder = negotiate(
      'onStartShouldSetResponderCapture',
      'onStartShouldSetResponder',
      start,
    );
    if (startResponder !== null) {
      claim(startResponder, start);
      chain[startResponder].onResponderStart?.(start);
    }
    // 터치 이벤트는 응답자 협상 뒤에 바깥 → 안쪽(capture), 안쪽 → 바깥(bubble) 으로 간다
    for (let index = chain.length - 1; index >= 0; index--) {
      touchHandler(index, 'onTouchStartCapture')?.(touchStartEvent(index));
    }
    for (let index = 0; index < chain.length; index++) {
      touchHandler(index, 'onTouchStart')?.(touchStartEvent(index));
    }

    for (let step = 1; step <= last; step++) {
      const move = responderEvent(step);
      const next = negotiate(
        'onMoveShouldSetResponderCapture',
        'onMoveShouldSetResponder',
        move,
      );
      if (next !== null) {
        claim(next, move);
      }
      if (responder !== null) {
        chain[responder].onResponderMove?.(move);
      }
    }

    if (responder !== null) {
      const end = responderEvent(last + 1, false);
      chain[responder].onResponderEnd?.(end);
      chain[responder].onResponderRelease?.(end);
    }
  });

  return responder === null ? undefined : chain[responder];
}
