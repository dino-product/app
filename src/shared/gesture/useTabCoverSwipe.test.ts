import { act, renderHook } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import {
  drag,
  touchEvent,
  touchesEvent,
  type Point,
} from '../../../jest/gesture';
import { HOLD_MS } from './swipeHesitation';
import type { TabCoverDrag } from './tabCover';
import { useTabCoverSwipe } from './useTabCoverSwipe';

const half = () => Math.floor(Dimensions.get('window').width / 2);

function fakeCover(begin = true) {
  return {
    begin: jest.fn(() => begin),
    move: jest.fn(),
    end: jest.fn(),
    cancel: jest.fn(),
  } satisfies TabCoverDrag;
}

const setup = async (
  cover: TabCoverDrag | null,
  canSwipe: () => boolean = () => true,
) => {
  const onTrackingChange = jest.fn();
  const hook = await renderHook(() =>
    useTabCoverSwipe({ canSwipe, cover, onTrackingChange }),
  );
  const touchDown = () =>
    act(() =>
      hook.result.current.onTouchStartCapture(
        touchesEvent({ changed: [0], touches: [0] }),
      ),
    );
  return { ...hook, touchDown, onTrackingChange };
};

const path = (...xs: number[]): Point[] => xs.map(x => ({ x, y: 0 }));

describe('useTabCoverSwipe — 덮기 밀기 엔진 (#216)', () => {
  it('8pt 를 넘게 가로로 움직이면 덮기를 시작해 손가락 거리를 넘기고, 이어 민 채 놓으면 바꾼다', async () => {
    const cover = fakeCover();
    const { result, touchDown, onTrackingChange } = await setup(cover);

    await touchDown();
    const { granted } = await drag(result.current.panHandlers, {
      path: path(0, -4, -8, -14, -24, -40),
    });

    expect(granted).toBe(true);
    expect(cover.begin).toHaveBeenCalledTimes(1);
    expect(cover.move).toHaveBeenLastCalledWith(-40, 8);
    expect(cover.end).toHaveBeenCalledWith(-40, true);
    expect(onTrackingChange.mock.calls).toEqual([[true], [false]]);
  });

  it('8pt 이하로 스치기만 하면 아무 일도 없다', async () => {
    const cover = fakeCover();
    const { result, touchDown } = await setup(cover);

    await touchDown();
    await drag(result.current.panHandlers, { path: path(0, -3, -6, -8) });

    expect(cover.begin).not.toHaveBeenCalled();
  });

  it('미는 중에 4pt 안에서 100ms 머물면 화면 절반을 넘겨야 바꾼다', async () => {
    const cover = fakeCover();
    const { result, touchDown } = await setup(cover);

    await touchDown();
    // 한 걸음 16ms. -40 에서 8걸음(128ms) 머문 뒤 -60 까지 가서 놓는다
    await drag(result.current.panHandlers, {
      path: path(0, -12, -24, -40, ...Array(8).fill(-40), -50, -60),
    });

    expect(cover.move).toHaveBeenCalledWith(-40, half());
    expect(cover.end).toHaveBeenCalledWith(-60, false);
  });

  it('손가락이 가만히 있어 이동이 오지 않아도 100ms 가 지나면 임계가 커진 것을 알린다', async () => {
    jest.useFakeTimers();
    try {
      const cover = fakeCover();
      const { result, touchDown } = await setup(cover);
      const handlers = result.current.panHandlers;
      const at = (from: number, x: number, step: number) =>
        touchEvent({ x: from, y: 0 }, { x, y: 0 }, step, 1, true);

      await touchDown();
      await act(() => {
        handlers.onStartShouldSetResponder?.(at(0, 0, 0));
        for (const [step, from, x] of [
          [1, 0, -12],
          [2, -12, -24],
        ] as const) {
          const move = at(from, x, step);
          if (handlers.onMoveShouldSetResponder?.(move)) {
            handlers.onResponderGrant?.(move);
          }
          handlers.onResponderMove?.(move);
        }
      });
      expect(cover.move).toHaveBeenLastCalledWith(-24, 8);

      await act(() => jest.advanceTimersByTime(HOLD_MS));
      expect(cover.move).toHaveBeenLastCalledWith(-24, half());
    } finally {
      jest.useRealTimers();
    }
  });

  it('JS 가 막혀 멈춤 타이머가 한 프레임 넘게 늦으면 멈춤으로 보지 않고 다시 건다 (처음 여는 탭을 그리는 동안)', async () => {
    jest.useFakeTimers();
    try {
      const cover = fakeCover();
      const { result, touchDown } = await setup(cover);
      const handlers = result.current.panHandlers;
      const at = (from: number, x: number, step: number) =>
        touchEvent({ x: from, y: 0 }, { x, y: 0 }, step, 1, true);
      let granted = false;
      const send = (from: number, x: number, step: number) => {
        const move = at(from, x, step);
        if (!granted) {
          handlers.onMoveShouldSetResponderCapture?.(move);
          granted = handlers.onMoveShouldSetResponder?.(move) === true;
          if (granted) {
            handlers.onResponderGrant?.(move);
          }
        }
        handlers.onResponderMove?.(move);
      };

      await touchDown();
      await act(() => {
        handlers.onStartShouldSetResponderCapture?.(at(0, 0, 0));
        send(0, -12, 1);
      });
      // 손가락은 계속 움직였지만 JS 가 200ms 막혀 이동 이벤트보다 타이머가 먼저 돈다
      jest.setSystemTime(Date.now() + 200);
      await act(() => jest.advanceTimersByTime(HOLD_MS));
      expect(cover.move).not.toHaveBeenCalledWith(expect.any(Number), half());

      // 밀려 있던 이동이 들어온다 (이어 민 손길)
      await act(() => send(-12, -60, 3));
      expect(cover.move).toHaveBeenLastCalledWith(-60, 8);
    } finally {
      jest.useRealTimers();
    }
  });

  it('놓기 직전에 멈췄으면 놓기 전 멈춤이라 원래대로다', async () => {
    const cover = fakeCover();
    const { result, touchDown } = await setup(cover);

    await touchDown();
    // -50 에서 3걸음(48ms) 멈춘 채 뗀다
    await drag(result.current.panHandlers, {
      path: path(0, -12, -24, -36, -50, -50, -50, -50),
    });

    expect(cover.end).toHaveBeenCalledWith(-50, false);
  });

  it('지금 덮을 수 없으면(마무리 중) 응답자가 되지 않고, canSwipe 가 false 면 묻지도 않는다', async () => {
    const busy = fakeCover(false);
    const first = await setup(busy);
    await first.touchDown();
    const { granted } = await drag(first.result.current.panHandlers, {
      dx: -80,
    });
    expect(granted).toBe(false);

    const cover = fakeCover();
    const blocked = await setup(cover, () => false);
    await blocked.touchDown();
    await drag(blocked.result.current.panHandlers, { dx: -80 });
    expect(cover.begin).not.toHaveBeenCalled();
  });

  it('다른 응답자가 가져가거나 두 번째 손가락이 닿으면 원래대로 돌아온다', async () => {
    const cover = fakeCover();
    const { result, touchDown } = await setup(cover);

    await touchDown();
    await drag(result.current.panHandlers, { dx: -80, terminateAt: 5 });
    expect(cover.cancel).toHaveBeenCalledTimes(1);

    await touchDown();
    await drag(result.current.panHandlers, {
      dx: -80,
      fingers: step => (step < 5 ? 1 : 2),
    });
    expect(cover.cancel).toHaveBeenCalledTimes(2);
    expect(cover.end).not.toHaveBeenCalled();
  });

  it('미는 동안에는 응답자를 놓아 주지 않는다 (세로 리스트가 가져가지 못한다)', async () => {
    const cover = fakeCover();
    const { result, touchDown } = await setup(cover);

    await touchDown();
    const { released } = await drag(result.current.panHandlers, {
      dx: -80,
      cancelAt: 4,
    });

    expect(released).toBe(false);
    expect(cover.end).toHaveBeenCalledWith(-80, true);
  });
});
