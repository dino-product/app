import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useToday } from './useToday';

describe('useToday', () => {
  const listeners: Array<(state: AppStateStatus) => void> = [];
  const remove = jest.fn();

  beforeEach(() => {
    listeners.length = 0;
    remove.mockClear();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler) => {
        listeners.push(handler as (state: AppStateStatus) => void);
        return { remove };
      });
    jest.useFakeTimers({ now: new Date(2026, 9, 21, 23, 50) });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const changeTo = (state: AppStateStatus) =>
    act(() => listeners.forEach(listener => listener(state)));

  it('처음 그린 날을 준다', async () => {
    const { result } = await renderHook(() => useToday());

    expect(result.current).toEqual(new Date(2026, 9, 21, 23, 50));
  });

  it('날짜가 바뀐 뒤 앱이 다시 active 가 되면 새 오늘을 준다', async () => {
    const { result } = await renderHook(() => useToday());

    jest.setSystemTime(new Date(2026, 9, 22, 7, 0));
    await changeTo('active');

    expect(result.current).toEqual(new Date(2026, 9, 22, 7, 0));
  });

  it('같은 날 다시 active 가 되면 그대로 둔다 (다시 그리지 않는다)', async () => {
    const { result } = await renderHook(() => useToday());
    const before = result.current;

    jest.setSystemTime(new Date(2026, 9, 21, 23, 55));
    await changeTo('active');

    expect(result.current).toBe(before);
  });

  it('background 로 갈 때는 바꾸지 않고, 화면이 사라지면 구독을 푼다', async () => {
    const { result, unmount } = await renderHook(() => useToday());
    const before = result.current;

    jest.setSystemTime(new Date(2026, 9, 22, 7, 0));
    await changeTo('background');
    expect(result.current).toBe(before);

    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
