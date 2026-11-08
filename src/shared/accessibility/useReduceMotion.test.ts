import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useReduceMotion, useReduceMotionEnabled } from './useReduceMotion';

// jest 프리셋의 AccessibilityInfo 는 공유 목이라 spyOn 이 같은 목을 돌려준다. 앞 테스트의 기록을 지운다
const listenReduceMotion = () => {
  const remove = jest.fn();
  const listen = jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockClear()
    .mockReturnValueOnce({ remove } as never);
  const change = (enabled: boolean) => {
    const [event, handler] = listen.mock.calls[0];
    expect(event).toBe('reduceMotionChanged');
    return act(() => (handler as (value: boolean) => void)(enabled));
  };
  return { change, remove };
};

const settingIs = (read: Promise<boolean>) =>
  jest
    .mocked(AccessibilityInfo.isReduceMotionEnabled)
    .mockReturnValueOnce(read);

describe('useReduceMotion', () => {
  it('처음에는 꺼진 것으로 보고, 설정을 읽으면 그 값을 쓴다', async () => {
    let resolveRead: (enabled: boolean) => void = () => {};
    settingIs(new Promise(resolve => (resolveRead = resolve)));
    listenReduceMotion();
    const { result } = await renderHook(() => useReduceMotion());

    // 읽기 전에는 애니메이션을 한다
    expect(result.current.current).toBe(false);
    await act(async () => resolveRead(true));
    expect(result.current.current).toBe(true);
  });

  it('화면을 연 채로 설정을 바꾸면 따르고, 닫으면 구독을 푼다', async () => {
    const { change, remove } = listenReduceMotion();
    const { result, unmount } = await renderHook(() => useReduceMotion());
    await act(async () => {});

    await change(true);
    expect(result.current.current).toBe(true);
    await change(false);
    expect(result.current.current).toBe(false);

    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('읽는 사이에 설정이 바뀌면 나중에 온 읽기 결과가 덮어쓰지 않는다', async () => {
    let resolveRead: (enabled: boolean) => void = () => {};
    settingIs(new Promise(resolve => (resolveRead = resolve)));
    const { change } = listenReduceMotion();
    const { result } = await renderHook(() => useReduceMotion());

    await change(true);
    await act(async () => resolveRead(false));

    expect(result.current.current).toBe(true);
  });

  it('닫은 뒤에 온 읽기 결과는 버린다', async () => {
    let resolveRead: (enabled: boolean) => void = () => {};
    settingIs(new Promise(resolve => (resolveRead = resolve)));
    listenReduceMotion();
    const { result, unmount } = await renderHook(() => useReduceMotion());
    const reduceMotion = result.current;

    await unmount();
    await act(async () => resolveRead(true));

    expect(reduceMotion.current).toBe(false);
  });

  it('설정을 읽지 못하면 꺼진 것으로 둔다', async () => {
    settingIs(Promise.reject(new Error('네이티브 모듈 없음')));
    listenReduceMotion();
    const { result } = await renderHook(() => useReduceMotion());
    await act(async () => {});

    expect(result.current.current).toBe(false);
  });
});

// 설정에 따라 그리는 것이 달라지는 곳(탭 전환 설정 #140)은 값이 바뀔 때 다시 그려야 한다
describe('useReduceMotionEnabled', () => {
  it('처음에는 꺼진 것으로 그리고, 설정을 읽어 켜져 있으면 다시 그린다', async () => {
    let resolveRead: (enabled: boolean) => void = () => {};
    settingIs(new Promise(resolve => (resolveRead = resolve)));
    listenReduceMotion();
    const { result } = await renderHook(() => useReduceMotionEnabled());

    expect(result.current).toBe(false);
    await act(async () => resolveRead(true));
    expect(result.current).toBe(true);
  });

  it('화면을 연 채로 설정을 바꾸면 따르고, 닫으면 구독을 푼다', async () => {
    const { change, remove } = listenReduceMotion();
    const { result, unmount } = await renderHook(() =>
      useReduceMotionEnabled(),
    );
    await act(async () => {});

    await change(true);
    expect(result.current).toBe(true);
    await change(false);
    expect(result.current).toBe(false);

    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('읽는 사이에 설정이 바뀌면 나중에 온 읽기 결과가 덮어쓰지 않는다', async () => {
    let resolveRead: (enabled: boolean) => void = () => {};
    settingIs(new Promise(resolve => (resolveRead = resolve)));
    const { change } = listenReduceMotion();
    const { result } = await renderHook(() => useReduceMotionEnabled());

    await change(true);
    await act(async () => resolveRead(false));

    expect(result.current).toBe(true);
  });
});
