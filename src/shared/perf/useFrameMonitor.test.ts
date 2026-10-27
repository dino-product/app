import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useFrameMonitor } from './useFrameMonitor';

let changeListener: ((state: AppStateStatus) => void) | undefined;
const remove = jest.fn();

// jest preset 의 AppState 목은 currentState 가 함수라 replaceProperty 를 쓸 수 없다
function setCurrentState(state: AppStateStatus) {
  Object.defineProperty(AppState, 'currentState', {
    value: state,
    configurable: true,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  setCurrentState('active');
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, handler) => {
      changeListener = handler as (state: AppStateStatus) => void;
      return { remove };
    });
  jest.spyOn(globalThis, 'requestAnimationFrame');
  jest.spyOn(globalThis, 'cancelAnimationFrame');
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  changeListener = undefined;
  remove.mockClear();
});

describe('useFrameMonitor', () => {
  it('enabled=false 면 프레임 루프도 AppState 구독도 만들지 않는다', async () => {
    await renderHook(() => useFrameMonitor({ enabled: false }));

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('앱이 active 면 시작하고 background 로 가면 멈춘다', async () => {
    await renderHook(() => useFrameMonitor({ enabled: true }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    await act(() => changeListener?.('background'));
    expect(cancelAnimationFrame).toHaveBeenCalled();

    await act(() => changeListener?.('active'));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('background 상태로 마운트되면 프레임 루프를 돌리지 않는다', async () => {
    setCurrentState('background');

    await renderHook(() => useFrameMonitor({ enabled: true }));

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('unmount 시 구독을 해제하고 프레임 루프를 멈춘다', async () => {
    const { unmount } = await renderHook(() =>
      useFrameMonitor({ enabled: true }),
    );

    await unmount();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
