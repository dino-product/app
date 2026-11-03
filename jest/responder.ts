import type { screen } from '@testing-library/react-native';
import type {
  GestureResponderEvent,
  GestureResponderHandlers,
} from 'react-native';
import { drag, type DragResult } from './gesture';

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
