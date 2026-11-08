import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useScreenReaderEnabled } from './useScreenReaderEnabled';

// jest 프리셋의 AccessibilityInfo 는 공유 목이라 spyOn 이 같은 목을 돌려준다. 앞 테스트의 기록을 지운다
const listenScreenReader = () => {
  const remove = jest.fn();
  const listen = jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockClear()
    .mockReturnValueOnce({ remove } as never);
  const change = (enabled: boolean) => {
    const [event, handler] = listen.mock.calls[0];
    expect(event).toBe('screenReaderChanged');
    return act(() => (handler as (value: boolean) => void)(enabled));
  };
  return { change, remove };
};

const settingIs = (read: Promise<boolean>) =>
  jest
    .mocked(AccessibilityInfo.isScreenReaderEnabled)
    .mockReturnValueOnce(read);

describe('useScreenReaderEnabled (#148)', () => {
  it('처음에는 꺼진 것으로 보고, 설정을 읽으면 그 값을 쓰고 알린다', async () => {
    let resolveRead: (enabled: boolean) => void = () => {};
    settingIs(new Promise(resolve => (resolveRead = resolve)));
    listenScreenReader();
    const onChange = jest.fn();
    const { result } = await renderHook(() => useScreenReaderEnabled(onChange));

    expect(result.current.current).toBe(false);
    await act(async () => resolveRead(true));

    expect(result.current.current).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('화면을 연 채로 스크린리더를 켜고 끄면 따르고 알리며, 닫으면 구독을 푼다', async () => {
    const { change, remove } = listenScreenReader();
    const onChange = jest.fn();
    const { result, unmount } = await renderHook(() =>
      useScreenReaderEnabled(onChange),
    );
    await act(async () => {});

    await change(true);
    expect(result.current.current).toBe(true);
    await change(false);
    expect(result.current.current).toBe(false);
    expect(onChange.mock.calls).toEqual([[true], [false]]);

    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('렌더마다 새로 넘긴 알림 함수 중 가장 최근 것을 부른다', async () => {
    const { change } = listenScreenReader();
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = await renderHook(
      ({ onChange }) => useScreenReaderEnabled(onChange),
      { initialProps: { onChange: first } },
    );
    await act(async () => {});
    await rerender({ onChange: latest });

    await change(true);

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(true);
  });

  it('읽는 사이에 설정이 바뀌면 나중에 온 읽기 결과가 덮어쓰지 않는다', async () => {
    let resolveRead: (enabled: boolean) => void = () => {};
    settingIs(new Promise(resolve => (resolveRead = resolve)));
    const { change } = listenScreenReader();
    const { result } = await renderHook(() => useScreenReaderEnabled());

    await change(true);
    await act(async () => resolveRead(false));

    expect(result.current.current).toBe(true);
  });

  it('닫은 뒤에 온 읽기 결과는 버린다', async () => {
    let resolveRead: (enabled: boolean) => void = () => {};
    settingIs(new Promise(resolve => (resolveRead = resolve)));
    listenScreenReader();
    const onChange = jest.fn();
    const { result, unmount } = await renderHook(() =>
      useScreenReaderEnabled(onChange),
    );
    const screenReader = result.current;

    await unmount();
    await act(async () => resolveRead(true));

    expect(screenReader.current).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('설정을 읽지 못하면 꺼진 것으로 둔다', async () => {
    settingIs(Promise.reject(new Error('네이티브 모듈 없음')));
    listenScreenReader();
    const { result } = await renderHook(() => useScreenReaderEnabled());
    await act(async () => {});

    expect(result.current.current).toBe(false);
  });
});
