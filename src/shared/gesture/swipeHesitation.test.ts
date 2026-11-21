import {
  BACKTRACK_DISTANCE,
  HOLD_MS,
  HOLD_SLOP,
  RELEASE_WINDOW_MS,
  STOP_SPEED,
  trackHesitation,
} from './swipeHesitation';

// 시각은 ms, 거리는 시작점에서 잰 가로 이동(pt). 왼쪽으로 미는 손길이다
const FRAME = 16;

/** t0 에서 시작해 FRAME 마다 step 씩 움직인다. 마지막 시각과 자리를 돌려준다 */
function slide(
  tracker: ReturnType<typeof trackHesitation>,
  from: { t: number; x: number },
  step: number,
  frames: number,
) {
  let { t, x } = from;
  for (let i = 0; i < frames; i++) {
    t += FRAME;
    x += step;
    tracker.move(t, x);
  }
  return { t, x };
}

describe('swipeHesitation — 미는 중의 망설임 (#216)', () => {
  it('기준값: 4pt 안에 100ms 머물면 멈춤, 8pt 되돌아오면 되돌림, 놓을 때는 40ms 창에서 0.04pt/ms', () => {
    expect(HOLD_MS).toBe(100);
    expect(HOLD_SLOP).toBe(4);
    expect(BACKTRACK_DISTANCE).toBe(8);
    expect(RELEASE_WINDOW_MS).toBe(40);
    expect(STOP_SPEED).toBeCloseTo(0.04);
  });

  it('멈추지 않고 이어 밀면 망설이지 않고, 움직이는 채 놓아도 그대로다', () => {
    const tracker = trackHesitation(0, -11);
    const end = slide(tracker, { t: 0, x: -11 }, -3, 10);
    expect(tracker.hesitation).toBeNull();
    expect(tracker.release(end.t + 8, end.x - 1)).toBeNull();
  });

  it('느려도 이어 밀면(0.05pt/ms, 100ms 에 5pt) 멈춤이 아니다', () => {
    const tracker = trackHesitation(0, -11);
    for (let t = 20; t <= 400; t += 20) {
      tracker.move(t, -11 - t * 0.05);
    }
    expect(tracker.check(400)).toBeNull();
    expect(tracker.hesitation).toBeNull();
  });

  it('4pt 안에서 100ms 머물면 멈춤이다 (이동 이벤트로도, 타이머로도 안다)', () => {
    const moving = trackHesitation(0, -11);
    const end = slide(moving, { t: 0, x: -11 }, -5, 4);
    expect(moving.move(end.t + 60, end.x - 3)).toBeNull();
    expect(moving.move(end.t + 100, end.x - 3)).toBe('hold');

    const still = trackHesitation(0, -11);
    const at = slide(still, { t: 0, x: -11 }, -5, 4);
    expect(still.holdDueAt()).toBe(at.t + HOLD_MS);
    expect(still.check(at.t + HOLD_MS - 1)).toBeNull();
    expect(still.check(at.t + HOLD_MS)).toBe('hold');
    expect(still.holdDueAt()).toBeNull();
  });

  it('가장 멀리 간 곳에서 8pt 되돌아오면 되돌림이다 (반대쪽으로 넘어가도)', () => {
    const tracker = trackHesitation(0, -11);
    const end = slide(tracker, { t: 0, x: -11 }, -7, 7); // -60
    expect(tracker.move(end.t + FRAME, -53)).toBeNull();
    expect(tracker.move(end.t + 2 * FRAME, -52)).toBe('back');

    const crossing = trackHesitation(0, 11);
    crossing.move(16, 30);
    expect(crossing.move(32, -5)).toBe('back');
  });

  it('한 번 망설이면 그 손길이 끝날 때까지 그대로다', () => {
    const tracker = trackHesitation(0, -11);
    tracker.check(HOLD_MS);
    expect(tracker.hesitation).toBe('hold');
    slide(tracker, { t: HOLD_MS, x: -11 }, -20, 10);
    expect(tracker.hesitation).toBe('hold');
    expect(tracker.release(HOLD_MS + 200, -250)).toBe('hold');
  });

  it('놓는 순간 40ms 넘게 멈춰 있었으면 놓기 전 멈춤이다', () => {
    const tracker = trackHesitation(0, -11);
    const end = slide(tracker, { t: 0, x: -11 }, -5, 6);
    expect(tracker.release(end.t + 70, end.x)).toBe('stop');
  });

  it('놓는 순간 되돌아가는 중이면(되돌림 거리 전이라도) 놓기 전 멈춤이다', () => {
    const tracker = trackHesitation(0, 11);
    slide(tracker, { t: 0, x: 11 }, 3, 3); // 20
    tracker.move(64, 18);
    tracker.move(80, 16);
    expect(tracker.release(88, 16)).toBe('stop');
  });

  it('놓는 속도는 놓은 자리와 40ms 전 자리로 잰다', () => {
    // 40ms 전까지는 빨랐지만 마지막 40ms 에 1pt 만 갔다: 1/40 = 0.025 < 0.04
    const slowed = trackHesitation(0, -11);
    slide(slowed, { t: 0, x: -11 }, -10, 5); // t 80, x -61
    slowed.move(100, -61.5);
    expect(slowed.release(120, -62)).toBe('stop');

    // 마지막 40ms 에 3pt: 0.075 ≥ 0.04
    const moving = trackHesitation(0, -11);
    slide(moving, { t: 0, x: -11 }, -10, 5);
    moving.move(100, -62.5);
    expect(moving.release(120, -64)).toBeNull();
  });
});
