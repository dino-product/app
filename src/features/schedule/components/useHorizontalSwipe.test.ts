import { renderHook } from '@testing-library/react-native';
import { drag } from '../../../../jest/gesture';
import { useHorizontalSwipe } from './useHorizontalSwipe';

const setup = async () => {
  const onSwipeLeft = jest.fn();
  const onSwipeRight = jest.fn();
  const hook = await renderHook(
    (props: Parameters<typeof useHorizontalSwipe>[0]) =>
      useHorizontalSwipe(props),
    { initialProps: { onSwipeLeft, onSwipeRight } },
  );
  return { onSwipeLeft, onSwipeRight, ...hook };
};

describe('useHorizontalSwipe', () => {
  it('왼쪽으로 밀면 onSwipeLeft, 오른쪽으로 밀면 onSwipeRight 를 부른다', async () => {
    const { result, onSwipeLeft, onSwipeRight } = await setup();

    await drag(result.current, { dx: -80 });
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();

    await drag(result.current, { dx: 80 });
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('터치를 시작할 때는 응답자가 되지 않는다 (탭은 안쪽 날짜 버튼 몫)', async () => {
    const { result, onSwipeLeft, onSwipeRight } = await setup();

    const { granted } = await drag(result.current, { dx: 0, dy: 0 });

    expect(granted).toBe(false);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('누르다 손가락이 가로로 조금(10pt 이하) 흔들려도 응답자가 되지 않는다', async () => {
    const { result } = await setup();

    expect((await drag(result.current, { dx: -10, dy: 2 })).granted).toBe(
      false,
    );
    expect((await drag(result.current, { dx: 8 })).granted).toBe(false);
  });

  it('세로로 더 많이 움직이면 응답자가 되지 않고 리스트 스크롤에 맡긴다', async () => {
    const { result, onSwipeLeft, onSwipeRight } = await setup();

    expect((await drag(result.current, { dx: 0, dy: 120 })).granted).toBe(
      false,
    );
    expect((await drag(result.current, { dx: -60, dy: 90 })).granted).toBe(
      false,
    );
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('조금만 천천히 밀었다 놓으면 넘기지 않는다', async () => {
    const { result, onSwipeLeft, onSwipeRight } = await setup();

    // 16ms 마다 3pt (0.19pt/ms)
    const { granted } = await drag(result.current, { dx: -30 });

    expect(granted).toBe(true);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('짧아도 빠르게 튕기면 넘긴다', async () => {
    const { result, onSwipeLeft, onSwipeRight } = await setup();

    // 16ms 마다 10pt (0.63pt/ms)
    await drag(result.current, { dx: -30, steps: 3 });
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);

    await drag(result.current, { dx: 30, steps: 3 });
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('한쪽으로 끌다가 반대로 튕기면 넘기지 않는다', async () => {
    const { result, onSwipeLeft, onSwipeRight } = await setup();

    // 오른쪽으로 16ms 마다 3pt 끌다가 마지막에 왼쪽으로 12pt (0.75pt/ms)
    const path = Array.from({ length: 11 }, (_, i) => ({ x: i * 3, y: 0 }));
    path.push({ x: 18, y: 0 });
    const { granted } = await drag(result.current, { path });

    expect(granted).toBe(true);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('두 손가락으로 밀면 응답자가 되지 않는다', async () => {
    const { result, onSwipeLeft } = await setup();

    const { granted } = await drag(result.current, { dx: -80, fingers: 2 });

    expect(granted).toBe(false);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('밀던 중에 리스트가 스크롤하겠다고 하면 넘겨 주고 넘기지 않는다', async () => {
    const { result, onSwipeLeft } = await setup();

    const { released } = await drag(result.current, { dx: -80, cancelAt: 6 });

    expect(released).toBe(true);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('콜백이 바뀌면 다음 밀기부터 새 콜백을 부른다', async () => {
    const { result, rerender, onSwipeLeft, onSwipeRight } = await setup();
    const nextLeft = jest.fn();

    await rerender({ onSwipeLeft: nextLeft, onSwipeRight });
    await drag(result.current, { dx: -80 });

    expect(nextLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
