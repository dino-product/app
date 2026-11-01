import {
  NavigationContext,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
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

const keyboardListeners = () =>
  DeviceEventEmitter.listenerCount('keyboardDidShow') +
  DeviceEventEmitter.listenerCount('keyboardDidHide');

// 화면 포커스만 흉내 낸 내비게이션. 탭을 바꾸거나 위에 화면을 쌓으면 blur, 돌아오면 focus 가 온다
function fakeNavigation() {
  let focused = true;
  const listeners = {
    focus: new Set<() => void>(),
    blur: new Set<() => void>(),
  };
  const navigation = {
    isFocused: () => focused,
    addListener: (type: 'focus' | 'blur', callback: () => void) => {
      listeners[type].add(callback);
      return () => listeners[type].delete(callback);
    },
  } as unknown as NavigationProp<ParamListBase>;
  const emit = (type: 'focus' | 'blur') =>
    act(() => {
      focused = type === 'focus';
      listeners[type].forEach(callback => callback());
    });
  const listening = () => listeners.focus.size + listeners.blur.size;
  return { navigation, emit, listening };
}

async function renderOn(
  os: 'ios' | 'android',
  navigation?: NavigationProp<ParamListBase>,
) {
  jest.replaceProperty(Platform, 'OS', os);
  let renders = 0;
  const hook = await renderHook(
    () => {
      renders += 1;
      return useKeyboardOverlap();
    },
    navigation && {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationContext.Provider value={navigation}>
          {children}
        </NavigationContext.Provider>
      ),
    },
  );
  const onLayout = (y: number, height: number) =>
    act(() => hook.result.current.onLayout?.(layout(y, height)));
  return { ...hook, onLayout, renders: () => renders };
}

afterEach(async () => {
  // Keyboard 모듈은 마지막 키보드 상태를 들고 있어 다음 테스트로 넘어가지 않게 내린다
  await hideKeyboard();
  jest.restoreAllMocks();
});

describe('useKeyboardOverlap', () => {
  it('Android 는 키보드 윗변(screenY)이 영역 아래를 가린 만큼을 돌려준다', async () => {
    const { result, onLayout } = await renderOn('android');
    await onLayout(100, 700); // 아래 끝 800
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
    const { result, onLayout } = await renderOn('android');
    await onLayout(100, 300); // 아래 끝 400

    await showKeyboard(500);

    expect(result.current.overlap).toBe(0);
  });

  it('키보드가 영역 위 끝보다 높아도 영역 높이까지만 줄인다', async () => {
    const { result, onLayout, renders } = await renderOn('android');
    await onLayout(100, 300);

    await showKeyboard(50);
    // 높이보다 큰 padding 은 View 를 늘려 onLayout 이 다시 오고, 그만큼 또 늘어난다
    expect(result.current.overlap).toBe(300);

    await onLayout(100, 300);
    expect(renders()).toBe(2);
  });

  it('영역 크기를 키보드보다 늦게 알아도 계산한다', async () => {
    const { result, onLayout } = await renderOn('android');

    await showKeyboard(500);
    expect(result.current.overlap).toBe(0);

    await onLayout(100, 700);
    expect(result.current.overlap).toBe(300);
  });

  it('키보드가 이미 떠 있을 때 마운트돼도 반영한다', async () => {
    await showKeyboard(500);

    const { result, onLayout } = await renderOn('android');
    await onLayout(100, 700);

    expect(result.current.overlap).toBe(300);
  });

  it('가린 높이가 그대로면 다시 렌더하지 않는다 (리렌더 예산)', async () => {
    const { onLayout, renders } = await renderOn('android');

    await onLayout(100, 700);
    await hideKeyboard();
    expect(renders()).toBe(1);

    await showKeyboard(500);
    await showKeyboard(500); // 내비게이션 바만 바뀌면 같은 윗변으로 다시 온다
    await onLayout(100, 700);
    await onLayout(0, 800); // 위치·높이가 바뀌어도 아래 끝이 같으면 가린 높이도 같다
    expect(renders()).toBe(2);
  });

  it('가려진 화면은 키보드를 듣지 않고, 다시 보이면 떠 있는 키보드를 반영한다', async () => {
    const { navigation, emit } = fakeNavigation();
    const before = keyboardListeners();
    const { result, onLayout } = await renderOn('android', navigation);
    await onLayout(100, 700);
    await showKeyboard(500);
    expect(result.current.overlap).toBe(300);

    // 다른 탭·위 화면에서 키보드를 써도 가려진 이 화면은 렌더·레이아웃하지 않는다
    await emit('blur');
    expect(result.current.overlap).toBe(0);
    expect(keyboardListeners()).toBe(before);
    await showKeyboard(450);
    expect(result.current.overlap).toBe(0);

    await emit('focus');
    expect(result.current.overlap).toBe(350);
    expect(keyboardListeners()).toBe(before + 2);
  });

  it('iOS 는 레이아웃도 키보드도 듣지 않는다. ScrollView 의 automaticallyAdjustKeyboardInsets 가 맡는다', async () => {
    const before = keyboardListeners();
    const { result } = await renderOn('ios');

    await showKeyboard(500);

    expect(result.current.onLayout).toBeUndefined();
    expect(result.current.overlap).toBe(0);
    expect(keyboardListeners()).toBe(before);
  });

  it('내비게이션이 바뀌면 이전 포커스 구독을 풀고, 키보드 구독과 값은 그대로 둔다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const first = fakeNavigation();
    const second = fakeNavigation();
    let navigation = first.navigation;
    let renders = 0;
    const before = keyboardListeners();
    const { result, rerender } = await renderHook(
      () => {
        renders += 1;
        return useKeyboardOverlap();
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <NavigationContext.Provider value={navigation}>
            {children}
          </NavigationContext.Provider>
        ),
      },
    );
    await act(() => result.current.onLayout?.(layout(100, 700)));
    await showKeyboard(500);
    expect(renders).toBe(2);

    navigation = second.navigation;
    await rerender({});

    expect(first.listening()).toBe(0);
    expect(second.listening()).toBe(2);
    expect(keyboardListeners()).toBe(before + 2);
    expect(result.current.overlap).toBe(300);
    expect(renders).toBe(3); // rerender 한 번뿐이다
  });

  it('언마운트하면 키보드와 포커스 구독을 푼다', async () => {
    const { navigation, listening } = fakeNavigation();
    const before = keyboardListeners();

    const { unmount } = await renderOn('android', navigation);
    expect(keyboardListeners()).toBe(before + 2);
    expect(listening()).toBe(2);

    await unmount();
    expect(keyboardListeners()).toBe(before);
    expect(listening()).toBe(0);
  });
});
