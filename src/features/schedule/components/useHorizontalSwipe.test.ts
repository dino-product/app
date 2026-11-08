import { act, renderHook } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Animated,
  type LayoutChangeEvent,
} from 'react-native';
import { drag } from '../../../../jest/gesture';
import { holdNativeAnimations } from '../../../../jest/nativeAnimation';
import {
  MIN_SLIDE_MS,
  SLIDE_MS,
  useHorizontalSwipe,
} from './useHorizontalSwipe';

const PAGE_WIDTH = 375;

const layout = (width: number) =>
  ({
    nativeEvent: { layout: { x: 0, y: 0, width, height: 69 } },
  } as LayoutChangeEvent);

const setup = async ({ width = PAGE_WIDTH }: { width?: number } = {}) => {
  const animations = holdNativeAnimations();
  const timing = jest.spyOn(Animated, 'timing');
  const onPrev = jest.fn();
  const onNext = jest.fn();
  let renders = 0;
  const hook = await renderHook(
    (props: Parameters<typeof useHorizontalSwipe>[0]) => {
      renders += 1;
      return useHorizontalSwipe(props);
    },
    { initialProps: { onPrev, onNext } },
  );
  if (width > 0) {
    await act(() => hook.result.current.onTrackLayout(layout(width)));
  }
  // 트랙에 들어간 이동량 (setValue 와 끝난 애니메이션의 값)
  const offsets: number[] = [];
  hook.result.current.translateX.addListener(({ value }) => {
    offsets.push(value);
  });
  return {
    ...hook,
    ...animations,
    timing,
    onPrev,
    onNext,
    offsets,
    renderCount: () => renders,
    /** 마지막으로 시작한 넘김 애니메이션의 설정 */
    lastSlide: () => timing.mock.calls.at(-1)?.[1],
  };
};

describe('useHorizontalSwipe 넘김 판정', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전으로 넘긴다', async () => {
    const { result, finish, onPrev, onNext } = await setup();

    await drag(result.current.panHandlers, { dx: -80 });
    await finish();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();

    await drag(result.current.panHandlers, { dx: 80 });
    await finish();
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('터치를 시작할 때는 응답자가 되지 않는다 (탭은 안쪽 날짜 버튼 몫)', async () => {
    const { result, finish, onPrev, onNext } = await setup();

    const { granted } = await drag(result.current.panHandlers, {
      dx: 0,
      dy: 0,
    });
    await finish();

    expect(granted).toBe(false);
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('누르다 손가락이 가로로 조금(10pt 이하) 흔들려도 응답자가 되지 않는다', async () => {
    const { result } = await setup();

    expect(
      (await drag(result.current.panHandlers, { dx: -10, dy: 2 })).granted,
    ).toBe(false);
    expect((await drag(result.current.panHandlers, { dx: 8 })).granted).toBe(
      false,
    );
  });

  it('세로로 더 많이 움직이면 응답자가 되지 않고 리스트 스크롤에 맡긴다', async () => {
    const { result, finish, offsets, onPrev, onNext } = await setup();

    expect(
      (await drag(result.current.panHandlers, { dx: 0, dy: 120 })).granted,
    ).toBe(false);
    expect(
      (await drag(result.current.panHandlers, { dx: -60, dy: 90 })).granted,
    ).toBe(false);
    await finish();

    expect(offsets).toEqual([]);
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  // 처음 움직인 방향(decidePanAxis)으로 정하고 그 손길이 끝날 때까지 바꾸지 않는다 (#144).
  // 세로로 스크롤하던 손가락이 옆으로 흘러도 달을 넘기지 않는다
  it('처음에 세로로 움직였으면 이어서 가로로 많이 밀어도 응답자가 되지 않는다', async () => {
    const { result, finish, offsets, onNext } = await setup();

    const { granted } = await drag(result.current.panHandlers, {
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 6 },
        { x: 0, y: 12 },
        { x: -40, y: 12 },
        { x: -80, y: 12 },
      ],
    });
    await finish();

    expect(granted).toBe(false);
    expect(offsets).toEqual([]);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('세로로 정한 손길이 끝나면 다음 손길은 처음부터 다시 정한다', async () => {
    const { result, finish, onNext } = await setup();

    await drag(result.current.panHandlers, { dx: 0, dy: 40 });
    const { granted } = await drag(result.current.panHandlers, { dx: -80 });
    await finish();

    expect(granted).toBe(true);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  // 방향은 화면에 손가락 하나로 시작해 방향을 정할 때까지 한 손가락인 손길에서만 본다 (useTouchScrollLock 과 같은 규칙)
  it('화면 다른 곳에 손가락이 닿은 채로 시작한 손길은 지난 손길의 방향을 이어 쓰지 않고 넘기지 않는다', async () => {
    const { result, finish, onNext, onPrev } = await setup();

    await drag(result.current.panHandlers, { dx: -80 });
    await finish();
    const vertical = await drag(result.current.panHandlers, {
      dy: 80,
      otherFingersAtStart: 1,
    });
    const horizontal = await drag(result.current.panHandlers, {
      dx: 80,
      otherFingersAtStart: 1,
    });
    await finish();

    expect(vertical.granted).toBe(false);
    expect(horizontal.granted).toBe(false);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('두 손가락으로 가로로 밀다 한 손가락을 떼도 넘기지 않는다', async () => {
    const { result, finish, onNext } = await setup();

    const { granted } = await drag(result.current.panHandlers, {
      dx: -80,
      fingers: step => (step < 4 ? 2 : 1),
    });
    await finish();

    expect(granted).toBe(false);
    expect(onNext).not.toHaveBeenCalled();
  });

  // 두 번째 손가락이 밀기 뷰 밖(리스트 행 등)에 닿으면 밀기 뷰는 닿는 순간을 못 보고 손가락 수로만 안다
  it('한 손가락으로 시작해 방향을 정하기 전에 두 손가락이 되면 그 손길은 넘기지 않는다', async () => {
    const { result, finish, onNext } = await setup();

    const { granted } = await drag(result.current.panHandlers, {
      dx: -80,
      fingers: step => (step === 0 ? 1 : 2),
    });
    await finish();

    expect(granted).toBe(false);
    expect(onNext).not.toHaveBeenCalled();
  });

  // 다른 뷰가 응답자인 동안 닿은 손가락은 밀기 뷰가 닿는 순간을 못 볼 수 있다. 지난 손길의 방향으로 넘기지 않는다
  it('닿는 순간을 못 본 손길은 지난 손길이 가로였어도 넘기지 않는다', async () => {
    const { result, finish, onNext } = await setup();

    await drag(result.current.panHandlers, { dx: -80 });
    await finish();
    const { granted } = await drag(
      {
        ...result.current.panHandlers,
        onStartShouldSetResponderCapture: undefined,
      },
      { dy: 80 },
    );
    await finish();

    expect(granted).toBe(false);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('조금만 천천히 밀었다 놓으면 넘기지 않고 제자리로 돌아간다', async () => {
    const { result, finish, lastSlide, onPrev, onNext } = await setup();

    // 16ms 마다 3pt (0.19pt/ms)
    const { granted } = await drag(result.current.panHandlers, { dx: -30 });

    expect(granted).toBe(true);
    expect(lastSlide()?.toValue).toBeCloseTo(0);
    // 남은 거리가 짧아도 한 프레임에 튀지 않게 최소 시간은 미끄러진다
    expect(lastSlide()?.duration).toBe(MIN_SLIDE_MS);
    await finish();
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
    expect(result.current.page).toBe(0);
  });

  it('짧아도 빠르게 튕기면 넘긴다', async () => {
    const { result, finish, onPrev, onNext } = await setup();

    // 16ms 마다 10pt (0.63pt/ms)
    await drag(result.current.panHandlers, { dx: -30, steps: 3 });
    await finish();
    expect(onNext).toHaveBeenCalledTimes(1);

    await drag(result.current.panHandlers, { dx: 30, steps: 3 });
    await finish();
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('한쪽으로 끌다가 반대로 튕기면 넘기지 않는다', async () => {
    const { result, finish, onPrev, onNext } = await setup();

    // 오른쪽으로 16ms 마다 3pt 끌다가 마지막에 왼쪽으로 12pt (0.75pt/ms)
    const path = Array.from({ length: 11 }, (_, i) => ({ x: i * 3, y: 0 }));
    path.push({ x: 18, y: 0 });
    const { granted } = await drag(result.current.panHandlers, { path });
    await finish();

    expect(granted).toBe(true);
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('두 손가락으로 밀면 응답자가 되지 않는다', async () => {
    const { result, finish, onNext } = await setup();

    const { granted } = await drag(result.current.panHandlers, {
      dx: -80,
      fingers: 2,
    });
    await finish();

    expect(granted).toBe(false);
    expect(onNext).not.toHaveBeenCalled();
  });

  // 달력을 만지는 동안 리스트가 세로로 움직이지 않게 한다 (#99). iOS 는 리스트가 응답자를 달라고 하고
  // 넘겨 주면 그때부터 스크롤한다. Android 는 묻지 않고 끊으므로(가로채기) 응답자가 될 때 부모의 가로채기를 막는다
  it('밀던 중에 리스트가 스크롤하겠다고 해도 넘겨 주지 않고 계속 따라가 넘긴다', async () => {
    const { result, finish, offsets, onNext } = await setup();

    const { released } = await drag(result.current.panHandlers, {
      dx: -80,
      cancelAt: 6,
    });

    expect(released).toBe(false);
    expect(offsets.at(-1)).toBe(-64);
    await finish();
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('응답자가 되면 네이티브 부모(리스트)의 터치 가로채기를 막는다', async () => {
    const { result } = await setup();
    const grant = jest.fn(result.current.panHandlers.onResponderGrant);

    await drag(
      { ...result.current.panHandlers, onResponderGrant: grant },
      {
        dx: -80,
      },
    );

    // PanResponder 는 onResponderGrant 의 반환값으로 네이티브 응답자를 막을지 정한다
    expect(grant).toHaveReturnedWith(true);
  });

  it('시스템이 밀기를 끊으면(전화·시스템 제스처 등) 넘기지 않고 제자리로 돌아간다', async () => {
    const { result, finish, lastSlide, onNext } = await setup();

    await drag(result.current.panHandlers, { dx: -80, terminateAt: 6 });

    expect(lastSlide()?.toValue).toBeCloseTo(0);
    await finish();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('콜백이 바뀌면 다음 넘김부터 새 콜백을 부른다', async () => {
    const { result, rerender, finish, onPrev, onNext } = await setup();
    const nextNext = jest.fn();

    await rerender({ onPrev, onNext: nextNext });
    await drag(result.current.panHandlers, { dx: -80 });
    await finish();

    expect(nextNext).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});

describe('useHorizontalSwipe 손가락 따라가기·넘김 애니메이션', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // PanResponder 는 응답자가 될 때 dx 를 0 으로 둔다. 밀기로 본 거리(10pt 남짓)만큼 튀지 않고 그 자리부터 따라간다
  it('끄는 동안 밀기로 본 지점부터의 이동량을 dx 그대로 트랙에 넣고, 그 사이 다시 그리지 않는다', async () => {
    const { result, offsets, renderCount } = await setup();
    const before = renderCount();

    // 16ms 마다 8pt. 둘째 이동(16pt)에서 응답자가 되고 그 뒤 여덟 번 더 움직인다
    await drag(result.current.panHandlers, { dx: -80 });

    expect(offsets).toEqual([-8, -16, -24, -32, -40, -48, -56, -64]);
    expect(renderCount()).toBe(before);
  });

  it('기준 이상에서 놓으면 남은 거리를 네이티브 드라이버로 한 페이지 폭까지 넘기고, 다 넘어간 뒤 콜백을 한 번 부른다', async () => {
    const { result, finish, lastSlide, onNext } = await setup();

    await drag(result.current.panHandlers, { dx: -80 });

    expect(lastSlide()).toMatchObject({
      toValue: -PAGE_WIDTH,
      useNativeDriver: true,
    });
    // 남은 거리(375 - 64)만큼 버튼 넘김보다 짧게 돈다
    expect(lastSlide()?.duration).toBeCloseTo(
      (SLIDE_MS * (PAGE_WIDTH - 64)) / PAGE_WIDTH,
    );
    expect(onNext).not.toHaveBeenCalled();
    expect(result.current.page).toBe(0);

    await finish();
    expect(onNext).toHaveBeenCalledTimes(1);
    // 트랙을 되돌리지 않고 지금 페이지를 옆 페이지 자리로 옮긴다
    expect(result.current.page).toBe(1);
  });

  it('넘긴 뒤에는 옮긴 자리에서 이어 끈다', async () => {
    const { result, finish, offsets, lastSlide, onPrev } = await setup();
    await drag(result.current.panHandlers, { dx: -80 });
    await finish();
    offsets.length = 0;

    await drag(result.current.panHandlers, { dx: 80 });

    expect(offsets[0]).toBe(-PAGE_WIDTH + 8);
    expect(offsets.at(-1)).toBe(-PAGE_WIDTH + 64);
    expect(lastSlide()?.toValue).toBeCloseTo(0);
    await finish();
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(result.current.page).toBe(0);
  });

  // 큰 화면에서는 창(본문 기둥)보다 길게 끌 수 있다. 그 너머에는 그린 페이지가 없다
  it('한 페이지 폭보다 더 끌어도 옆 페이지 너머로 가지 않는다', async () => {
    const { result, finish, offsets } = await setup();

    await drag(result.current.panHandlers, { dx: -600 });
    expect(Math.min(...offsets)).toBe(-PAGE_WIDTH);
    await finish();

    // 넘긴 뒤(page 1)에는 그 앞 페이지(page 0) 자리까지
    offsets.length = 0;
    await drag(result.current.panHandlers, { dx: 600 });
    expect(Math.max(...offsets)).toBeCloseTo(0);
  });

  it('폭이 바뀌면 트랙을 지금 페이지 자리로 옮긴다', async () => {
    const { result, finish, offsets } = await setup();
    await drag(result.current.panHandlers, { dx: -80 });
    await finish();

    await act(() => result.current.onTrackLayout(layout(400)));

    expect(offsets.at(-1)).toBe(-400);
  });
});

describe('useHorizontalSwipe 버튼 넘김', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('한 페이지를 SLIDE_MS 동안 미끄러져 넘기고, 다 넘어간 뒤 콜백을 부른다', async () => {
    const { result, finish, lastSlide, onPrev } = await setup();

    await act(() => result.current.slide(-1));

    expect(lastSlide()).toMatchObject({
      toValue: PAGE_WIDTH,
      duration: SLIDE_MS,
      useNativeDriver: true,
    });
    expect(onPrev).not.toHaveBeenCalled();
    await finish();
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(result.current.page).toBe(-1);
  });

  it('넘기는 중에 또 누르면 앞 넘김을 바로 확정하고 이어서 넘어가 누른 횟수만큼 넘긴다', async () => {
    const { result, finish, offsets, lastSlide, onNext } = await setup();

    await act(() => result.current.slide(1));
    await act(() => result.current.slide(1));

    // 트랙을 추정 자리에 세우지 않는다. 새 애니메이션이 네이티브의 지금 값에서 이어 가 뒤로 튀지 않는다
    expect(offsets).toEqual([]);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(result.current.page).toBe(1);
    expect(lastSlide()?.toValue).toBe(-2 * PAGE_WIDTH);

    await finish();
    expect(onNext).toHaveBeenCalledTimes(2);
    expect(result.current.page).toBe(2);
  });

  it('미끄러지는 중에 폭이 바뀌면 다 넘어간 뒤 새 폭의 자리로 맞춘다', async () => {
    const { result, finish, offsets } = await setup();

    await act(() => result.current.slide(1));
    await act(() => result.current.onTrackLayout(layout(400)));
    await finish();

    expect(offsets.at(-1)).toBe(-400);
  });

  it('미끄러지는 중에 화면을 떠나면 콜백을 부르지 않는다', async () => {
    const { result, unmount, finish, onNext } = await setup();

    await act(() => result.current.slide(1));
    await unmount();
    await finish();

    expect(onNext).not.toHaveBeenCalled();
  });

  it('미끄러지는 중에 손가락으로 잡으면 넘김을 확정하고 지금 보이는 자리에서 이어 끈다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const { result, finish, offsets, lastSlide, onNext } = await setup();

    await act(() => result.current.slide(1));
    // 반쯤 지났을 때 잡는다. Easing.out(cubic) 이라 이미 87.5% 를 왔다
    now.mockReturnValue(1000 + SLIDE_MS / 2);
    await drag(result.current.panHandlers, { dx: -80 });

    expect(offsets[0]).toBeCloseTo(-PAGE_WIDTH * 0.875);
    expect(offsets[1]).toBeCloseTo(-PAGE_WIDTH * 0.875 - 8);
    expect(onNext).toHaveBeenCalledTimes(1);
    // 잡기 전 넘김이 확정됐으므로 그다음 페이지로 넘어간다
    expect(lastSlide()?.toValue).toBe(-2 * PAGE_WIDTH);
    await finish();
    expect(onNext).toHaveBeenCalledTimes(2);
  });
});

describe('useHorizontalSwipe 바로 넘기기', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('동작 줄이기가 켜져 있으면 미끄러지지 않고 바로 옮기고 부른다', async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValueOnce(true);
    const { result, timing, offsets, onPrev, onNext } = await setup();
    // 설정을 읽은 뒤에 민다
    await act(async () => {});

    await drag(result.current.panHandlers, { dx: -80 });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(offsets.at(-1)).toBe(-PAGE_WIDTH);
    expect(result.current.page).toBe(1);

    await act(() => result.current.slide(-1));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(offsets.at(-1)).toBeCloseTo(0);

    // 덜 밀고 놓아도 바로 제자리다
    await drag(result.current.panHandlers, { dx: -30 });
    expect(offsets.at(-1)).toBeCloseTo(0);
    expect(timing).not.toHaveBeenCalled();
  });

  it('폭을 재기 전에는 미끄러지지 않고 바로 넘긴다', async () => {
    const { result, timing, onNext } = await setup({ width: 0 });

    await drag(result.current.panHandlers, { dx: -80 });

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(timing).not.toHaveBeenCalled();
  });
});
