import { act, renderHook } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import { drag, touchesEvent } from '../../../jest/gesture';
import { SWITCH_DISTANCE } from './tabSwipe';
import { useSwipeSwitch } from './useSwipeSwitch';

const FAR = SWITCH_DISTANCE + 20;

const setup = async (canSwipe: () => boolean = () => true) => {
  const onSwipe = jest.fn();
  const hook = await renderHook(() => useSwipeSwitch({ canSwipe, onSwipe }));
  /** 첫 손가락이 닿는다 (제스처를 새로 시작한다) */
  const touchDown = () =>
    act(() =>
      hook.result.current.onTouchStartCapture(
        touchesEvent({ changed: [0], touches: [0] }),
      ),
    );
  return { ...hook, onSwipe, touchDown };
};

describe('useSwipeSwitch — 한 번 넘기는 판정 엔진', () => {
  it('가로로 정해지면 응답자가 되고, 임계값을 넘을 때 한 번만 넘긴다', async () => {
    const { result, onSwipe, touchDown } = await setup();

    await touchDown();
    const { granted } = await drag(result.current.panHandlers, {
      dx: -FAR * 3,
      steps: 30,
    });

    expect(granted).toBe(true);
    expect(onSwipe).toHaveBeenCalledTimes(1);
    expect(onSwipe).toHaveBeenCalledWith('next');
  });

  it('canSwipe 가 false 면 그 제스처는 끝까지 받지 않는다 (나중에 true 가 돼도)', async () => {
    let allowed = false;
    const canSwipe = jest.fn(() => allowed);
    const { result, onSwipe, touchDown } = await setup(canSwipe);

    await touchDown();
    const first = await drag(result.current.panHandlers, {
      path: [
        { x: 0, y: 0 },
        { x: -4, y: 0 },
      ],
    });
    allowed = true;
    const rest = await drag(result.current.panHandlers, { dx: -FAR });

    expect(first.granted || rest.granted).toBe(false);
    expect(onSwipe).not.toHaveBeenCalled();

    // 새 제스처(첫 손가락이 다시 닿음)는 다시 묻는다
    await touchDown();
    await drag(result.current.panHandlers, { dx: -FAR });
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it('응답자가 되지 못하면(지금 응답자가 거절, reject) 그 제스처는 넘기지 않는다', async () => {
    const { result, onSwipe, touchDown } = await setup();
    const handlers = result.current.panHandlers;

    await touchDown();
    // 가로로 정해져 응답자를 달라고 했지만 거절당했다
    const move = (dx: number, timestamp: number) =>
      ({
        nativeEvent: { touches: [{}], pageX: dx, pageY: 0, timestamp },
        touchHistory: {
          numberActiveTouches: 1,
          indexOfSingleActiveTouch: 0,
          mostRecentTimeStamp: timestamp,
          touchBank: [
            {
              touchActive: true,
              startPageX: 0,
              startPageY: 0,
              startTimeStamp: 0,
              currentPageX: dx,
              currentPageY: 0,
              currentTimeStamp: timestamp,
              previousPageX: 0,
              previousPageY: 0,
              previousTimeStamp: timestamp - 16,
            },
          ],
        },
      } as unknown as GestureResponderEvent);
    await act(() => {
      handlers.onMoveShouldSetResponderCapture?.(move(-20, 16));
      expect(handlers.onMoveShouldSetResponder?.(move(-20, 16))).toBe(true);
      handlers.onResponderGrant?.(move(-20, 16));
      handlers.onResponderReject?.(move(-20, 16));
      handlers.onMoveShouldSetResponderCapture?.(move(-FAR, 32));
      expect(handlers.onMoveShouldSetResponder?.(move(-FAR, 32))).toBe(false);
    });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('다른 손가락이 이미 닿아 있을 때 닿은 손가락의 제스처는 무시한다', async () => {
    const { result, onSwipe, touchDown } = await setup();

    await touchDown();
    await act(() =>
      result.current.onTouchStartCapture(
        touchesEvent({ changed: [1], touches: [0, 1] }),
      ),
    );
    const { granted } = await drag(result.current.panHandlers, { dx: -FAR });

    expect(granted).toBe(false);
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
