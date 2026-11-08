import {
  NavigationContext,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { act, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Animated, NativeModules } from 'react-native';
import { changeAppState, mockAppState } from '../../../../jest/appState';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { Skeleton, SkeletonBlock, SkeletonLine } from './Skeleton';

// jest 프리셋의 네이티브 애니메이션 목은 16ms 뒤에 저절로 끝난다. 루프가 도는 동안을 보려고 끝내지 않는다
let started: Array<{ iterations?: number }> = [];
let stop: jest.SpyInstance;
const running = () => started.length - stop.mock.calls.length;

const reduceMotion = (enabled: boolean) =>
  jest
    .mocked(AccessibilityInfo.isReduceMotionEnabled)
    .mockResolvedValueOnce(enabled);

// 동작 줄이기 설정을 바꾸는 리스너. 프리셋 목은 모든 이벤트를 받으므로 이 이벤트만 골라 둔다
const listenReduceMotion = () => {
  const listen = jest.spyOn(AccessibilityInfo, 'addEventListener').mockClear();
  return (enabled: boolean) =>
    act(() => {
      listen.mock.calls
        .filter(([event]) => event === 'reduceMotionChanged')
        .forEach(([, handler]) =>
          (handler as (value: boolean) => void)(enabled),
        );
    });
};

// 화면 포커스만 흉내 낸 내비게이션 (useKeyboardOverlap.test 와 같다)
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
  return { navigation, emit };
}

const skeleton = (
  <Skeleton testID="skeleton">
    <SkeletonBlock width={60} height={60} radius={30} testID="avatar" />
    <SkeletonLine variant="Body/S/SemiBold" width={120} testID="name" />
  </Skeleton>
);

// 설정을 읽는 약속이 풀린 뒤까지 기다린다
const settle = () => act(async () => {});

describe('Skeleton', () => {
  beforeEach(() => {
    started = [];
    jest
      .spyOn(NativeModules.NativeAnimatedModule, 'startAnimatingNode')
      .mockImplementation((...args: unknown[]) => {
        started.push(args[2] as { iterations?: number });
      });
    // 프리셋의 공유 목이라 spyOn 이 같은 목을 돌려준다. 앞 테스트의 기록을 지운다
    stop = jest
      .spyOn(NativeModules.NativeAnimatedModule, 'stopAnimation')
      .mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('블록은 정한 크기·모서리로 토큰 회색을 칠한다', async () => {
    await render(skeleton);

    expect(screen.getByTestId('avatar')).toHaveStyle({
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.gray[100],
    });
  });

  it('줄은 그 글자 스타일의 줄 높이를 차지해, 글자로 바뀌어도 높이가 같다', async () => {
    await render(skeleton);

    expect(screen.getByTestId('name')).toHaveStyle({
      width: 120,
      height: typography['Body/S/SemiBold'].lineHeight,
    });
    expect(screen.getByTestId('name-bar')).toHaveStyle({
      backgroundColor: colors.gray[100],
    });
  });

  it('어두운 배경(Primary 카드) 위에서는 inverse 로 흰색 토큰을 옅게 칠한다', async () => {
    await render(
      <Skeleton>
        <SkeletonBlock height={20} inverse testID="block" />
        <SkeletonLine variant="Body/L/Bold" width={64} inverse testID="line" />
      </Skeleton>,
    );

    expect(screen.getByTestId('block')).toHaveStyle({
      backgroundColor: colors.white[9],
    });
    expect(screen.getByTestId('line-bar')).toHaveStyle({
      backgroundColor: colors.white[9],
    });
  });

  it('스크린리더는 묶음 전체를 "불러오는 중" 하나로 읽는다', async () => {
    await render(skeleton);

    expect(screen.getAllByLabelText('불러오는 중')).toHaveLength(1);
    expect(screen.getByRole('progressbar', { name: '불러오는 중' })).toBe(
      screen.getByTestId('skeleton'),
    );
    expect(screen.getByTestId('skeleton').props.accessible).toBe(true);
  });

  it('감싼 요소가 이미 읽으면(accessible={false}) 스크린리더에서 숨는다', async () => {
    await render(
      <Skeleton accessible={false} testID="skeleton">
        <SkeletonLine variant="Body/XL/Bold" width={56} />
      </Skeleton>,
    );

    expect(screen.queryByLabelText('불러오는 중')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('skeleton')).not.toBeOnTheScreen();
    expect(
      screen.getByTestId('skeleton', { includeHiddenElements: true }).props,
    ).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
  });

  it('동작 줄이기가 꺼져 있으면 UI 스레드(네이티브 드라이버)에서 끝없이 깜빡인다', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(skeleton);
    await settle();

    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ useNativeDriver: true }),
    );
    // 루프 전체를 네이티브로 넘겨 반복마다 JS 를 거치지 않는다
    expect(started).toEqual([expect.objectContaining({ iterations: -1 })]);
  });

  it('동작 줄이기면 애니메이션 없이 정지된 블록이다', async () => {
    reduceMotion(true);
    await render(skeleton);
    await settle();

    expect(started).toHaveLength(0);
    expect(screen.getByTestId('skeleton')).toHaveStyle({ opacity: 1 });
  });

  it('보는 중에 동작 줄이기를 켜면 멈추고, 끄면 다시 깜빡인다', async () => {
    const changeReduceMotion = listenReduceMotion();
    await render(skeleton);
    await settle();
    expect(running()).toBe(1);

    await changeReduceMotion(true);
    expect(running()).toBe(0);
    expect(screen.getByTestId('skeleton')).toHaveStyle({ opacity: 1 });

    await changeReduceMotion(false);
    expect(running()).toBe(1);
  });

  it('설정을 읽기 전에는 시작하지 않는다', async () => {
    let resolveRead: (enabled: boolean) => void = () => {};
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockReturnValueOnce(new Promise(resolve => (resolveRead = resolve)));
    await render(skeleton);

    expect(started).toHaveLength(0);
    await act(async () => resolveRead(false));
    expect(running()).toBe(1);
  });

  it('로딩이 끝나 사라지면 멈춘다', async () => {
    const { unmount } = await render(skeleton);
    await settle();
    expect(running()).toBe(1);

    await unmount();

    expect(running()).toBe(0);
  });

  it('앱이 background 로 가면 멈추고, 돌아오면 다시 깜빡인다', async () => {
    mockAppState('active');
    await render(skeleton);
    await settle();
    expect(running()).toBe(1);

    await changeAppState('background');
    expect(running()).toBe(0);

    await changeAppState('active');
    expect(running()).toBe(1);
  });

  it('background 에서 그려지면 앞으로 올 때까지 시작하지 않는다', async () => {
    mockAppState('background');
    await render(skeleton);
    await settle();
    expect(started).toHaveLength(0);

    await changeAppState('active');
    expect(running()).toBe(1);
  });

  it('화면을 떠나면(다른 탭·위 화면) 멈추고, 돌아오면 다시 깜빡인다', async () => {
    const { navigation, emit } = fakeNavigation();
    await render(skeleton, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationContext.Provider value={navigation}>
          {children}
        </NavigationContext.Provider>
      ),
    });
    await settle();
    expect(running()).toBe(1);

    await emit('blur');
    expect(running()).toBe(0);

    await emit('focus');
    expect(running()).toBe(1);
  });
});
