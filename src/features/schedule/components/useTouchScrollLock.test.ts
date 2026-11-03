import { act, renderHook } from '@testing-library/react-native';
import { touchesEvent } from '../../../../jest/gesture';
import { useTouchScrollLock } from './useTouchScrollLock';

const setup = async () => {
  let renders = 0;
  const hook = await renderHook(() => {
    renders += 1;
    return useTouchScrollLock();
  });
  const { areaTouchHandlers: area, onListTouchStartCapture } =
    hook.result.current;
  // RN 은 터치 시작을 리스트(조상)의 capture 로 먼저 보내고, 닿은 뷰에서 위로 올리며 영역(bubble)에 보낸다
  const startInArea = (changed: number[], touches = changed) =>
    act(() => {
      const event = touchesEvent({ changed, touches });
      onListTouchStartCapture(event);
      area.onTouchStart(event);
    });
  const startOutside = (changed: number[], touches = changed) =>
    act(() => onListTouchStartCapture(touchesEvent({ changed, touches })));
  // 끝·취소는 터치가 시작된 뷰로 간다. touches 는 그 뒤에도 닿아 있는 손가락
  const endInArea = (changed: number[], touches: number[] = []) =>
    act(() => area.onTouchEnd(touchesEvent({ changed, touches })));
  const cancelInArea = (changed: number[], touches: number[] = []) =>
    act(() => area.onTouchCancel(touchesEvent({ changed, touches })));
  return {
    locked: () => hook.result.current.locked,
    renderCount: () => renders,
    startInArea,
    startOutside,
    endInArea,
    cancelInArea,
  };
};

describe('useTouchScrollLock', () => {
  it('처음에는 잠그지 않는다', async () => {
    const { locked } = await setup();

    expect(locked()).toBe(false);
  });

  it('영역에 손가락이 닿으면 잠그고, 떼면 푼다', async () => {
    const { locked, startInArea, endInArea } = await setup();

    await startInArea([0]);
    expect(locked()).toBe(true);

    await endInArea([0]);
    expect(locked()).toBe(false);
  });

  // 리스트가 가로채거나(Android) 시스템 제스처·전화가 가져가면 터치가 취소된다
  it('터치가 취소돼도 푼다', async () => {
    const { locked, startInArea, cancelInArea } = await setup();

    await startInArea([0]);
    expect(locked()).toBe(true);
    await cancelInArea([0]);

    expect(locked()).toBe(false);
  });

  it('영역에 닿은 손가락이 모두 떨어질 때까지 잠근다', async () => {
    const { locked, startInArea, endInArea } = await setup();

    await startInArea([0]);
    await startInArea([1], [0, 1]);
    await endInArea([0], [1]);
    expect(locked()).toBe(true);

    await endInArea([1]);
    expect(locked()).toBe(false);
  });

  it('영역 밖에서 시작한 터치는 잠그지 않는다', async () => {
    const { locked, startOutside } = await setup();

    await startOutside([0]);

    expect(locked()).toBe(false);
  });

  it('다른 손가락이 영역을 만지는 동안 영역 밖에 닿은 손가락은 잠금을 풀지 않는다', async () => {
    const { locked, startInArea, startOutside, endInArea } = await setup();

    await startInArea([0]);
    await startOutside([1], [0, 1]);
    expect(locked()).toBe(true);

    await endInArea([0], [1]);
    expect(locked()).toBe(false);
  });

  // 만지던 칸이 그사이 사라지면(달을 넘겨 6주가 5주로 줄 때 등) 뗀 이벤트가 오지 않을 수 있다.
  // 손가락이 모두 떨어진 뒤 새로 시작한 터치가 남은 잠금을 바로잡는다
  describe('뗀 이벤트를 놓쳤을 때', () => {
    it('다음에 영역 밖에서 새로 시작한 터치에서 푼다', async () => {
      const { locked, startInArea, startOutside } = await setup();

      await startInArea([0]);
      expect(locked()).toBe(true);
      // 0 번을 뗀 이벤트가 오지 않았다. iOS 는 손가락 번호를 다시 쓰므로 새 터치도 0 번이다
      await startOutside([0]);

      expect(locked()).toBe(false);
    });

    it('다음에 영역에서 새로 시작한 터치는 그 손가락만 따라가 떼면 푼다', async () => {
      const { locked, startInArea, endInArea } = await setup();

      await startInArea([3]);
      await startInArea([0]);
      expect(locked()).toBe(true);

      await endInArea([0]);
      expect(locked()).toBe(false);
    });
  });

  it('잠금이 바뀔 때만 다시 그린다', async () => {
    const { renderCount, startInArea, startOutside, endInArea } = await setup();
    const mounted = renderCount();

    await startOutside([0]);
    await endInArea([0]);
    expect(renderCount()).toBe(mounted);

    await startInArea([0]);
    await startInArea([1], [0, 1]);
    await endInArea([1], [0]);
    expect(renderCount()).toBe(mounted + 1);

    await endInArea([0]);
    expect(renderCount()).toBe(mounted + 2);
  });

  it('핸들러는 다시 그려도 그대로라 달력을 다시 그리게 하지 않는다', async () => {
    const hook = await renderHook(() => useTouchScrollLock());
    const first = hook.result.current;

    await act(() =>
      first.areaTouchHandlers.onTouchStart(
        touchesEvent({ changed: [0], touches: [0] }),
      ),
    );

    expect(hook.result.current.areaTouchHandlers).toBe(first.areaTouchHandlers);
    expect(hook.result.current.onListTouchStartCapture).toBe(
      first.onListTouchStartCapture,
    );
  });
});
