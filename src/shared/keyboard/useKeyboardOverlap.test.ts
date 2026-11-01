import { act, renderHook } from '@testing-library/react-native';
import {
  DeviceEventEmitter,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { hideKeyboard, showKeyboard } from '../../../jest/keyboard';
import { useKeyboardOverlap } from './useKeyboardOverlap';

const layout = (y: number, height: number) =>
  ({
    nativeEvent: { layout: { x: 0, y, width: 360, height } },
  } as LayoutChangeEvent);

async function renderOn(os: 'ios' | 'android') {
  jest.replaceProperty(Platform, 'OS', os);
  let renders = 0;
  const hook = await renderHook(() => {
    renders += 1;
    return useKeyboardOverlap();
  });
  return { ...hook, renders: () => renders };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useKeyboardOverlap', () => {
  it('Android 는 키보드 윗변(screenY)이 영역 아래를 가린 만큼을 돌려준다', async () => {
    const { result } = await renderOn('android');
    await act(() => result.current.onLayout(layout(100, 700))); // 아래 끝 800
    expect(result.current.overlap).toBe(0);

    await showKeyboard(500);
    // 이벤트의 height(252)가 아니라 800 − 500
    expect(result.current.overlap).toBe(300);

    await showKeyboard(440); // 숫자 패드·이모지 패널로 높이가 바뀌면 다시 알린다
    expect(result.current.overlap).toBe(360);

    await hideKeyboard();
    expect(result.current.overlap).toBe(0);
  });

  it('키보드가 영역 아래 끝보다 낮으면 가리지 않는다', async () => {
    const { result } = await renderOn('android');
    await act(() => result.current.onLayout(layout(100, 300))); // 아래 끝 400

    await showKeyboard(500);

    expect(result.current.overlap).toBe(0);
  });

  it('영역 크기를 키보드보다 늦게 알아도 계산한다', async () => {
    const { result } = await renderOn('android');

    await showKeyboard(500);
    expect(result.current.overlap).toBe(0);

    await act(() => result.current.onLayout(layout(100, 700)));
    expect(result.current.overlap).toBe(300);

    await hideKeyboard();
  });

  it('가린 높이가 그대로면 다시 렌더하지 않는다 (리렌더 예산)', async () => {
    const { result, renders } = await renderOn('android');

    await act(() => result.current.onLayout(layout(100, 700)));
    await hideKeyboard();
    expect(renders()).toBe(1);

    await showKeyboard(500);
    await act(() => result.current.onLayout(layout(100, 700)));
    expect(renders()).toBe(2);

    await hideKeyboard();
  });

  it('iOS 는 늘 0 이다. ScrollView 의 automaticallyAdjustKeyboardInsets 가 맡는다', async () => {
    const { result } = await renderOn('ios');
    await act(() => result.current.onLayout(layout(100, 700)));

    await showKeyboard(500);

    expect(result.current.overlap).toBe(0);
    await hideKeyboard();
  });

  it('언마운트하면 키보드 구독을 푼다', async () => {
    const count = () =>
      DeviceEventEmitter.listenerCount('keyboardDidShow') +
      DeviceEventEmitter.listenerCount('keyboardDidHide');
    const before = count();

    const { unmount } = await renderOn('android');
    expect(count()).toBe(before + 2);

    await unmount();
    expect(count()).toBe(before);
  });
});
