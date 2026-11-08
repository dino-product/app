import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
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

// 펼친 달력은 처음 움직인 방향으로 정한다 (#144). 가로면 리스트를 막아 달을 넘기고, 세로면 리스트가 스크롤한다.
// iOS 는 손가락이 닿은 채로 scrollEnabled 를 다시 켜도 그 손길에서는 스크롤하지 않으므로, 가로로 정해질 때 막는다.
// Android 는 리스트가 세로 8dp 만 넘어도 가로채므로 닿을 때 막아 두고, 세로로 정해지면 풀어 리스트가 가로채게 한다
describe('useTouchScrollLock — 처음 움직인 방향으로 막기 (펼친 달력)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setupAxis = async (os: 'ios' | 'android') => {
    jest.replaceProperty(Platform, 'OS', os);
    let renders = 0;
    const hook = await renderHook(() => {
      renders += 1;
      return useTouchScrollLock();
    });
    const { axisAreaTouchHandlers: area, onListTouchStartCapture } =
      hook.result.current;
    // 손가락 0 번이 (0,0) 에 닿는다
    const start = (changed = [0], touches = changed) =>
      act(() => {
        const event = touchesEvent({ changed, touches });
        onListTouchStartCapture(event);
        area.onTouchStart(event);
      });
    // 손가락이 모두 (x, y) 로 움직인다
    const move = (x: number, y: number, touches = [0]) =>
      act(() =>
        area.onTouchMove(touchesEvent({ changed: touches, touches, x, y })),
      );
    const end = (changed = [0], touches: number[] = []) =>
      act(() => area.onTouchEnd(touchesEvent({ changed, touches })));
    const cancel = (changed = [0], touches: number[] = []) =>
      act(() => area.onTouchCancel(touchesEvent({ changed, touches })));
    return {
      locked: () => hook.result.current.locked,
      renderCount: () => renders,
      start,
      move,
      end,
      cancel,
    };
  };

  describe('iOS', () => {
    it('닿기만 해서는 막지 않는다 (탭·세로 스크롤이 그대로 된다)', async () => {
      const { locked, start } = await setupAxis('ios');

      await start();

      expect(locked()).toBe(false);
    });

    it('처음 움직임이 가로면 막고, 떼면 푼다', async () => {
      const { locked, start, move, end } = await setupAxis('ios');

      await start();
      await move(-11, 3);
      expect(locked()).toBe(true);

      await end();
      expect(locked()).toBe(false);
    });

    it('처음 움직임이 세로면 막지 않고, 이어서 옆으로 흘러도 막지 않는다', async () => {
      const { locked, start, move } = await setupAxis('ios');

      await start();
      await move(3, 11);
      expect(locked()).toBe(false);

      await move(-80, 11);
      expect(locked()).toBe(false);
    });

    it('10pt 이하로만 움직이면 아직 정하지 않는다', async () => {
      const { locked, start, move } = await setupAxis('ios');

      await start();
      await move(-10, 0);
      expect(locked()).toBe(false);

      await move(-11, 0);
      expect(locked()).toBe(true);
    });
  });

  describe('Android', () => {
    it('닿으면 방향을 정하기 전까지 막아 둔다 (가로 밀기를 리스트가 가로채지 않게)', async () => {
      const { locked, start, move } = await setupAxis('android');

      await start();
      expect(locked()).toBe(true);

      await move(-10, 0);
      expect(locked()).toBe(true);
    });

    it('처음 움직임이 세로면 풀어 리스트가 스크롤하게 하고, 이어서 옆으로 흘러도 다시 막지 않는다', async () => {
      const { locked, start, move } = await setupAxis('android');

      await start();
      await move(3, -11);
      expect(locked()).toBe(false);

      await move(-80, -11);
      expect(locked()).toBe(false);
    });

    it('처음 움직임이 가로면 계속 막고, 떼면 푼다', async () => {
      const { locked, start, move, end } = await setupAxis('android');

      await start();
      await move(11, 3);
      await move(11, 80);
      expect(locked()).toBe(true);

      await end();
      expect(locked()).toBe(false);
    });
  });

  it.each(['ios', 'android'] as const)(
    '%s: 다음 손길은 처음부터 다시 정한다',
    async os => {
      const { locked, start, move, end } = await setupAxis(os);

      await start();
      await move(0, 11);
      await end();
      await start();
      await move(-11, 0);

      expect(locked()).toBe(true);
    },
  );

  // 두 손가락은 밀기가 응답자가 되지 않는다. 방향을 보지 않고 닿을 때의 상태를 뗄 때까지 둔다
  it.each([
    ['ios', false],
    ['android', true],
  ] as const)(
    '%s: 정하기 전에 두 번째 손가락이 닿으면 방향을 보지 않는다',
    async (os, expected) => {
      const { locked, start, move } = await setupAxis(os);

      await start([0]);
      await start([1], [0, 1]);
      await move(0, 40, [0, 1]);
      await move(-40, 0, [0, 1]);

      expect(locked()).toBe(expected);
    },
  );

  // 밀기(useHorizontalSwipe)도 화면에 손가락이 하나일 때만 방향을 보므로 같은 손길은 같게 다룬다
  it.each([
    ['ios', false],
    ['android', true],
  ] as const)(
    '%s: 화면 다른 곳에 손가락이 닿은 채로 시작한 손길은 방향을 보지 않는다',
    async (os, expected) => {
      const { locked, start, move } = await setupAxis(os);

      await start([1], [0, 1]);
      await move(-40, 0, [1]);
      await move(0, 40, [1]);

      expect(locked()).toBe(expected);
    },
  );

  it('iOS: 정하기 전에 화면 다른 곳에 손가락이 닿으면 그 손길은 방향을 보지 않는다', async () => {
    const { locked, start, move } = await setupAxis('ios');

    await start();
    await move(-40, 0, [0, 1]);
    await move(-60, 0);

    expect(locked()).toBe(false);
  });

  // 방어용 분기: 실제로는 다른 손가락이 닿을 때 onTouchStart·리스트 capture 가 먼저 지켜보기를 멈춘다
  it('지켜보던 손가락이 움직임에 없으면 아직 정하지 않는다', async () => {
    const { locked, start, move } = await setupAxis('ios');

    await start([0]);
    await move(-40, 0, [1]);
    expect(locked()).toBe(false);

    await move(-40, 0, [0]);
    expect(locked()).toBe(true);
  });

  it('iOS: 가로로 정해 막은 뒤 터치가 취소되면 푼다', async () => {
    const { locked, start, move, cancel } = await setupAxis('ios');

    await start();
    await move(-11, 0);
    expect(locked()).toBe(true);
    await cancel();

    expect(locked()).toBe(false);
  });

  // 만지던 칸이 사라져 뗀 이벤트를 놓쳐도, 다음 손길은 리스트의 capture 에서 지난 손길을 지우고 처음부터 정한다
  it.each(['ios', 'android'] as const)(
    '%s: 뗀 이벤트를 놓친 뒤 새 손길은 처음부터 다시 정한다',
    async os => {
      const { locked, start, move } = await setupAxis(os);

      await start();
      await move(0, 11);
      await start();
      await move(-11, 0);

      expect(locked()).toBe(true);
    },
  );

  it.each(['ios', 'android'] as const)(
    '%s: 움직이는 동안 잠금이 바뀔 때만 다시 그린다',
    async os => {
      const { renderCount, start, move } = await setupAxis(os);
      const mounted = renderCount();

      await start();
      await move(-5, 0);
      await move(-11, 0);
      await move(-30, 0);
      await move(-60, 0);

      // 막기 시작할 때 한 번 (Android 는 닿을 때 이미 막았다)
      expect(renderCount()).toBe(mounted + 1);
    },
  );
});
