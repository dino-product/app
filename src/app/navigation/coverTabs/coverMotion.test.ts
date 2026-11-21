import { Animated } from 'react-native';
import {
  CORNER_RADIUS,
  DIM,
  EDGE_RESIST,
  FOLLOW_BEFORE,
  PARALLAX,
  SETTLE_MS,
  coverStyles,
  edgeResistance,
  nextFollow,
  settleDuration,
} from './coverMotion';

const WIDTH = 393;

describe('coverMotion — 덮기 움직임 값 (#216)', () => {
  it('시안 B 시차 덮기 값: 아래 화면 30% 밀림·최대 10% 어둡게, 모서리 22pt, 딸깍 전 80%, 마무리 280ms, 끝 탭 28pt', () => {
    expect(PARALLAX).toBe(0.3);
    expect(DIM).toBe(0.1);
    expect(CORNER_RADIUS).toBe(22);
    expect(FOLLOW_BEFORE).toBe(0.8);
    expect(SETTLE_MS).toBe(280);
    expect(EDGE_RESIST).toBe(28);
  });

  it('놓은 뒤 마무리는 남은 거리에 비례하고 최소 40% 다', () => {
    expect(settleDuration(0, WIDTH, WIDTH)).toBe(280);
    expect(settleDuration(WIDTH, 0, WIDTH)).toBe(280);
    expect(settleDuration(300, WIDTH, WIDTH)).toBe(112);
    expect(settleDuration(WIDTH / 2, WIDTH, WIDTH)).toBe(140);
  });

  it('끝 탭에서 바깥으로 밀면 최대 28pt 까지만 버틴다 (방향 그대로)', () => {
    expect(edgeResistance(0)).toBe(0);
    expect(edgeResistance(110)).toBeCloseTo(28 * (1 - Math.exp(-1)));
    expect(edgeResistance(-5000)).toBeCloseTo(-28);
  });
});

describe('nextFollow — 임계에서 딸깍 (#216)', () => {
  it('임계를 넘는 순간 손가락 위치로 따라붙고 햅틱, 넘은 채로는 그대로', () => {
    const first = nextFollow(null, 9, 8);
    expect(first).toMatchObject({ snap: 'in', haptic: true });
    expect(nextFollow(first.follow, 40, 8)).toMatchObject({
      snap: null,
      haptic: false,
    });
  });

  it('첫 이동이 임계 전이면 그대로 80% 로 따라온다', () => {
    expect(nextFollow(null, 5, 8)).toMatchObject({ snap: null, haptic: false });
  });

  it('손가락이 임계 안으로 돌아오면 다시 80% 로 물러난다', () => {
    const crossed = nextFollow(null, 30, 8).follow;
    expect(nextFollow(crossed, 6, 8)).toMatchObject({
      snap: 'out',
      haptic: false,
    });
  });

  it('망설여 임계가 커지면(8 → 196) 화면은 그 자리에 있다. 새 임계를 넘으면 다시 딸깍', () => {
    const crossed = nextFollow(null, 60, 8).follow;
    const hesitated = nextFollow(crossed, 60, 196);
    expect(hesitated).toMatchObject({ snap: null, haptic: false });
    expect(hesitated.follow.crossed).toBe(false);
    expect(nextFollow(hesitated.follow, 120, 196)).toMatchObject({
      snap: null,
      haptic: false,
    });
    expect(nextFollow(hesitated.follow, 196, 196)).toMatchObject({
      snap: 'in',
      haptic: true,
    });
  });
});

describe('coverStyles — 손가락이 간 거리로 두 화면을 그린다 (#216)', () => {
  const at = (side: 1 | -1, finger: number, follow: number) => {
    const values = {
      finger: new Animated.Value(finger),
      follow: new Animated.Value(follow),
      edge: new Animated.Value(0),
    };
    const styles = coverStyles({ side, ...values }, WIDTH);
    type Node = { __getValue: () => number };
    const x = (style: { transform: Array<{ translateX: unknown }> }) =>
      (style.transform[0].translateX as Node).__getValue();
    return {
      overX: x(styles.over),
      overRadius: (styles.over.borderRadius as unknown as Node).__getValue(),
      underX: x(styles.under),
      underRadius: (styles.under.borderRadius as unknown as Node).__getValue(),
      dim: (styles.scrim.opacity as unknown as Node).__getValue(),
    };
  };

  it('오른쪽 탭으로(왼쪽으로 밀기): 새 화면이 오른쪽 끝에서 들어오고 아래 화면은 같은 쪽으로 30% 밀린다', () => {
    expect(at(1, 0, 1)).toEqual({
      overX: WIDTH,
      overRadius: CORNER_RADIUS,
      underX: 0,
      underRadius: 0,
      dim: 0,
    });
    const half = at(1, WIDTH / 2, 1);
    expect(half.overX).toBeCloseTo(WIDTH / 2);
    expect(half.underX).toBeCloseTo((-WIDTH / 2) * PARALLAX);
    expect(half.overRadius).toBeCloseTo(CORNER_RADIUS / 2);
    expect(half.underRadius).toBeCloseTo(CORNER_RADIUS / 2);
    expect(half.dim).toBeCloseTo(DIM / 2);
  });

  it('왼쪽 탭으로는 거울처럼, 딸깍 전에는 손가락의 80% 만 따라온다', () => {
    const before = at(-1, 100, FOLLOW_BEFORE);
    expect(before.overX).toBeCloseTo(-WIDTH + 80);
    expect(before.underX).toBeCloseTo(80 * PARALLAX);
  });

  it('화면 폭보다 멀리 끌어도 새 화면이 다 덮은 데서 멈춘다 (옆 탭 하나까지만)', () => {
    expect(at(1, WIDTH * 4, 1)).toEqual({
      overX: 0,
      overRadius: 0,
      underX: -WIDTH * PARALLAX,
      underRadius: CORNER_RADIUS,
      dim: DIM,
    });
  });
});
