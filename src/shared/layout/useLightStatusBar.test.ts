import { renderHook } from '@testing-library/react-native';
import { StatusBar } from 'react-native';
import { useLightStatusBar } from './useLightStatusBar';

describe('useLightStatusBar', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('보이는 동안 흰 글자를 쌓고, 보이지 않으면 그 항목을 뺀다', async () => {
    const push = jest.spyOn(StatusBar, 'pushStackEntry');
    const pop = jest.spyOn(StatusBar, 'popStackEntry');
    const { rerender } = await renderHook(
      ({ visible }: { visible: boolean }) => useLightStatusBar(visible),
      { initialProps: { visible: true } },
    );

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({ barStyle: 'light-content' });
    expect(pop).not.toHaveBeenCalled();

    await rerender({ visible: false });

    expect(pop).toHaveBeenCalledWith(push.mock.results[0]?.value);
  });

  it('처음부터 보이지 않으면 쌓지 않는다', async () => {
    const push = jest.spyOn(StatusBar, 'pushStackEntry');

    await renderHook(() => useLightStatusBar(false));

    expect(push).not.toHaveBeenCalled();
  });

  it('보이는 채로 사라지면 그 항목을 뺀다', async () => {
    const push = jest.spyOn(StatusBar, 'pushStackEntry');
    const pop = jest.spyOn(StatusBar, 'popStackEntry');
    const { unmount } = await renderHook(() => useLightStatusBar(true));

    await unmount();

    expect(pop).toHaveBeenCalledWith(push.mock.results[0]?.value);
  });
});
