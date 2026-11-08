import { Animated } from 'react-native';
import {
  TAB_ENTER_MS,
  TAB_ENTER_OFFSET,
  forTabEnter,
  tabTransitionOptions,
} from './tabTransition';

// 탭 화면의 진행값: 지금 탭 0, 그 오른쪽 탭 1, 왼쪽 탭 -1 (bottom-tabs). 탭을 옮기면 새 탭이 ±1 에서 0 으로 간다
const sceneAt = (progress: number) => {
  const { sceneStyle } = forTabEnter({
    current: { progress: new Animated.Value(progress) },
  });
  const style = sceneStyle as {
    opacity?: unknown;
    transform: [{ translateX: Animated.AnimatedInterpolation<number> }];
  };
  return {
    translateX: style.transform[0].translateX.__getValue(),
    opacity: style.opacity,
  };
};

describe('탭 전환 애니메이션', () => {
  it('오른쪽 탭으로 가면 새 화면이 +x 에서 0 으로, 왼쪽 탭이면 -x 에서 0 으로 들어온다', () => {
    expect(sceneAt(1).translateX).toBe(TAB_ENTER_OFFSET);
    expect(sceneAt(-1).translateX).toBe(-TAB_ENTER_OFFSET);
    expect(sceneAt(0).translateX).toBe(0);
  });

  it('투명도는 건드리지 않는다 (투명도 0 프레임이 없다)', () => {
    expect(sceneAt(1).opacity).toBeUndefined();
    expect(sceneAt(0).opacity).toBeUndefined();
  });

  it('찰나에 방향만 느껴지는 짧은 시간·작은 거리다', () => {
    expect(TAB_ENTER_OFFSET).toBeLessThanOrEqual(32);
    expect(TAB_ENTER_MS).toBeLessThanOrEqual(200);
    const options = tabTransitionOptions(false);
    expect(options.transitionSpec).toEqual({
      animation: 'timing',
      config: expect.objectContaining({ duration: TAB_ENTER_MS }),
    });
    expect(options.sceneStyleInterpolator).toBe(forTabEnter);
  });

  it('동작 줄이기면 옮기지 않고 바로 바꾼다', () => {
    const options = tabTransitionOptions(true);

    expect(options.sceneStyleInterpolator).toBeUndefined();
    // 전환 설정은 남겨 둔다. 없애면 탭 화면 컨테이너 종류가 바뀌어 탭 화면이 모두 다시 마운트된다
    expect(options.transitionSpec).toEqual({
      animation: 'timing',
      config: { duration: 0 },
    });
  });
});
