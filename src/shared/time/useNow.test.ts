import { act, renderHook } from '@testing-library/react-native';
import { changeAppState, mockAppState } from '../../../jest/appState';
import { useNow } from './useNow';

// 화면이 정한 경계(예: 작업의 예정 시작·종료)에 닿을 때만 바뀌는 지금 (#205)

const MINUTE = 60 * 1000;
const T1840 = new Date(2026, 10, 18, 18, 40).getTime();
const T1900 = new Date(2026, 10, 18, 19, 0).getTime();
const T2000 = new Date(2026, 10, 18, 20, 0).getTime();

// 19:00 과 20:00 이 경계다
const boundaries = [T1900, T2000];
const nextBoundary = (now: number) => boundaries.find(at => at > now);

describe('useNow', () => {
  let timeouts: jest.SpyInstance;
  let clears: jest.SpyInstance;

  beforeEach(() => {
    mockAppState('active');
    jest.useFakeTimers({ now: T1840 });
    // 렌더 도구가 setImmediate 등을 쓰므로 타이머 수 대신 이 훅이 건 setTimeout 을 센다
    timeouts = jest.spyOn(globalThis, 'setTimeout');
    clears = jest.spyOn(globalThis, 'clearTimeout');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('처음 그릴 때의 지금을 준다', async () => {
    const { result } = await renderHook(() => useNow(nextBoundary));

    expect(result.current).toBe(T1840);
  });

  it('다음 경계 전에는 바꾸지 않고, 닿으면 그때의 지금으로 바꾼다 — 타이머는 다음 경계까지 하나뿐이다', async () => {
    const { result } = await renderHook(() => useNow(nextBoundary));
    expect(timeouts).toHaveBeenCalledTimes(1);
    expect(timeouts).toHaveBeenLastCalledWith(
      expect.any(Function),
      20 * MINUTE,
    );

    await act(() => jest.advanceTimersByTime(20 * MINUTE - 1));
    expect(result.current).toBe(T1840);

    await act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(T1900);
    // 다음 경계(20:00)까지 다시 하나
    expect(timeouts).toHaveBeenCalledTimes(2);
    expect(timeouts).toHaveBeenLastCalledWith(
      expect.any(Function),
      60 * MINUTE,
    );

    await act(() => jest.advanceTimersByTime(60 * MINUTE));
    expect(result.current).toBe(T2000);
    // 더 남은 경계가 없다
    expect(timeouts).toHaveBeenCalledTimes(2);
  });

  it('남은 경계가 없으면 타이머를 두지 않는다', async () => {
    const { result } = await renderHook(() => useNow(() => undefined));

    await act(() => jest.advanceTimersByTime(24 * 60 * MINUTE));
    expect(timeouts).not.toHaveBeenCalled();
    expect(result.current).toBe(T1840);
  });

  it('앱이 background 면 타이머를 지우고, 경계를 지나 active 로 돌아오면 바로 바꾼다', async () => {
    const { result } = await renderHook(() => useNow(nextBoundary));

    await changeAppState('background');
    expect(clears).toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(25 * MINUTE));
    expect(result.current).toBe(T1840);

    await changeAppState('active');
    expect(result.current).toBe(T1840 + 25 * MINUTE);
  });

  // PR #207 리뷰: background 동안 조회 결과가 와 경계가 새로 생겨도 그때 타이머를 걸지 않는다
  it('background 인 동안 경계가 바뀌어도 타이머를 걸지 않고, active 로 돌아오면 그때 반영한다', async () => {
    const { result, rerender } = await renderHook(
      ({ next }: { next: (now: number) => number | undefined }) => useNow(next),
      { initialProps: { next: () => undefined } },
    );

    await changeAppState('background');
    timeouts.mockClear();
    await rerender({ next: nextBoundary });
    expect(timeouts).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(25 * MINUTE));
    expect(result.current).toBe(T1840);

    await changeAppState('active');
    expect(result.current).toBe(T1840 + 25 * MINUTE);
  });

  it('경계 전에 active 로 돌아오면 그대로 두고 남은 시간만큼 다시 기다린다', async () => {
    const { result } = await renderHook(() => useNow(nextBoundary));

    await changeAppState('inactive');
    await act(() => jest.advanceTimersByTime(10 * MINUTE));
    await changeAppState('active');
    expect(result.current).toBe(T1840);
    expect(timeouts).toHaveBeenLastCalledWith(
      expect.any(Function),
      10 * MINUTE,
    );

    await act(() => jest.advanceTimersByTime(10 * MINUTE));
    expect(result.current).toBe(T1900);
  });

  it('화면을 떠나 있으면(active false) 타이머를 지우고, 돌아왔을 때 그사이 경계를 지났으면 바로 바꾼다', async () => {
    const { result, rerender } = await renderHook(
      ({ active }: { active: boolean }) => useNow(nextBoundary, active),
      { initialProps: { active: true } },
    );

    await rerender({ active: false });
    expect(clears).toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(21 * MINUTE));
    // 떠나 있는 동안은 앱이 다시 active 가 되어도 바꾸지 않는다
    await changeAppState('active');
    expect(result.current).toBe(T1840);

    await rerender({ active: true });
    expect(result.current).toBe(T1840 + 21 * MINUTE);
  });

  it('화면이 사라지면 타이머와 AppState 구독을 지운다', async () => {
    const { unmount } = await renderHook(() => useNow(nextBoundary));

    await unmount();
    expect(clears).toHaveBeenCalled();

    timeouts.mockClear();
    await act(() => jest.advanceTimersByTime(30 * MINUTE));
    await changeAppState('background');
    await changeAppState('active');
    expect(timeouts).not.toHaveBeenCalled();
  });

  it('setTimeout 한도(약 24.8일)보다 먼 경계도 일찍 바꾸지 않는다', async () => {
    const far = T1840 + 30 * 24 * 60 * MINUTE;
    const { result } = await renderHook(() =>
      useNow(now => (now < far ? far : undefined)),
    );

    await act(() => jest.advanceTimersByTime(2 ** 31 - 1));
    expect(result.current).toBe(T1840);

    await act(() => jest.advanceTimersByTime(far - T1840 - (2 ** 31 - 1)));
    expect(result.current).toBe(far);
  });
});
