import { Animated } from 'react-native';
import {
  ANCHOR_ANTICIPATION,
  ANCHOR_OVERSHOOT,
  anchorAnimation,
  anchorKeyframes,
} from './reportAnchorMotion';

const HIDDEN = 218;
const targets = (visible: boolean, interrupted?: boolean) =>
  anchorKeyframes(visible, HIDDEN, interrupted).map(frame => frame.toValue);

// #149 '완료 보고 작성하기' 앵커의 카툰 등장·퇴장. 값은 제자리에서 아래로 내려간 거리(음수는 위로 넘침)
describe('anchorKeyframes', () => {
  it('나타날 때는 제자리보다 위로 살짝 넘쳤다가 제자리로 내려앉는다', () => {
    expect(ANCHOR_OVERSHOOT).toBeGreaterThan(0);
    expect(targets(true)).toEqual([-ANCHOR_OVERSHOOT, 0]);
  });

  it('사라질 때는 위로 살짝 떴다가 숨은 자리(아래)로 빠진다', () => {
    expect(ANCHOR_ANTICIPATION).toBeGreaterThan(0);
    expect(targets(false)).toEqual([-ANCHOR_ANTICIPATION, HIDDEN]);
  });

  it('올라오던 중에 숨으면 위로 더 뜨지 않고 바로 아래로 빠진다', () => {
    expect(targets(false, true)).toEqual([HIDDEN]);
  });

  it('내려가던 중에 다시 나타나도 위로 넘쳤다 제자리로 온다', () => {
    expect(targets(true, true)).toEqual([-ANCHOR_OVERSHOOT, 0]);
  });

  it('넘침·예비 동작은 숨는 거리보다 훨씬 작다 (살짝)', () => {
    expect(ANCHOR_OVERSHOOT).toBeGreaterThan(0);
    expect(ANCHOR_ANTICIPATION).toBeGreaterThan(0);
    expect(ANCHOR_OVERSHOOT).toBeLessThan(HIDDEN / 10);
    expect(ANCHOR_ANTICIPATION).toBeLessThan(HIDDEN / 10);
  });

  it('모든 단계에 시간이 있다', () => {
    [true, false].forEach(visible => {
      const frames = anchorKeyframes(visible, HIDDEN);
      expect(frames.length).toBeGreaterThan(0);
      frames.forEach(frame => expect(frame.duration).toBeGreaterThan(0));
    });
  });
});

describe('anchorAnimation', () => {
  afterEach(() => jest.restoreAllMocks());

  it('키프레임을 차례로 UI 스레드(네이티브 드라이버)에서 돈다', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const sequence = jest.spyOn(Animated, 'sequence');
    const offset = new Animated.Value(HIDDEN);

    anchorAnimation(offset, true, HIDDEN);

    expect(sequence).toHaveBeenCalledTimes(1);
    expect(timing).toHaveBeenCalledTimes(2);
    timing.mock.calls.forEach(([value]) => expect(value).toBe(offset));
    expect(
      timing.mock.calls.map(([, config]) => ({
        toValue: config.toValue,
        duration: config.duration,
        useNativeDriver: config.useNativeDriver,
      })),
    ).toEqual(
      anchorKeyframes(true, HIDDEN).map(frame => ({
        toValue: frame.toValue,
        duration: frame.duration,
        useNativeDriver: true,
      })),
    );
  });
});
