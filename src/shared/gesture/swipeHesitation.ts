// 미는 중의 망설임 (#216). 덮기 밀기는 놓을 때 탭을 바꿀지 정하는데, 망설인 손길은 더 멀리 밀어야 바꾼다 (tabSwipe.ts).
// - 멈춤: 손가락이 HOLD_SLOP 안에 HOLD_MS 넘게 머묾 (평균 0.04pt/ms 미만). 손가락이 가만히 있으면 이동 이벤트가 오지 않으므로
//   부르는 쪽이 holdDueAt() 에 타이머를 걸고 check() 로 본다. Android·Flutter 속도 측정기는 40ms 동안 움직임이 없으면 멈춘 것으로
//   보는데, 그보다 길게 잡아 프레임 사이 흔들림이나 떼기 직전의 짧은 머뭇거림은 멈춤으로 보지 않는다
// - 되돌림: 가장 멀리 간 곳에서 BACKTRACK_DISTANCE 이상 되돌아옴 (흔들림 폭의 두 배. 반대쪽으로 넘어가도 같다)
// - 놓기 전 멈춤: 놓는 순간 미는 쪽 속도가 STOP_SPEED 미만이거나 반대쪽. 속도는 놓은 자리와 RELEASE_WINDOW_MS 전 자리로 잰다
//   (그 창 안에 이동이 없었으면 0). 위 플랫폼들의 '멈춤' 기준과 같은 창이다
// 한 번 망설이면 그 손길이 끝날 때까지 그대로다. 시각은 ms, 거리는 시작점에서 잰 가로 이동(pt)이다

export const HOLD_MS = 100;
export const HOLD_SLOP = 4;
export const BACKTRACK_DISTANCE = 8;
export const RELEASE_WINDOW_MS = 40;
/** 이보다 느리면 멈춘 것이다 (pt/ms) */
export const STOP_SPEED = HOLD_SLOP / HOLD_MS;

export type Hesitation = 'hold' | 'back' | 'stop';

export type HesitationTracker = {
  /** 지금까지의 망설임. 없으면 null */
  readonly hesitation: Hesitation | null;
  /** 손가락이 x 로 움직였다. 이번에 처음 망설였으면 그 종류 */
  move: (t: number, x: number) => Hesitation | null;
  /** 손가락이 가만히 있는 동안 t 에 멈춤인지 본다. 이번에 처음 멈췄으면 'hold' */
  check: (t: number) => Hesitation | null;
  /** 다음에 멈춤을 볼 시각. 이미 망설였으면 null */
  holdDueAt: () => number | null;
  /** 놓았다. 놓기 전 멈춤까지 보고 망설임을 돌려준다 */
  release: (t: number, x: number) => Hesitation | null;
};

type Sample = { t: number; x: number };

/**
 * 가로로 정해진 순간(t, x)부터 본다. since 는 손가락이 처음 닿은 순간(x 0)이다. 주면 그때부터의 움직임도 놓는 속도에 넣는다
 * (한 번에 크게 움직이고 바로 떼면 정해진 뒤의 이동이 거의 없다)
 */
export function trackHesitation(
  t: number,
  x: number,
  since?: Sample,
): HesitationTracker {
  const direction = Math.sign(x) || 1;
  let hesitation: Hesitation | null = null;
  let peak = x * direction;
  let anchor: Sample =
    since && Math.abs(x - since.x) <= HOLD_SLOP ? since : { t, x };
  const samples: Sample[] =
    since && since.t < t ? [since, { t, x }] : [{ t, x }];

  const decide = (next: Hesitation) => {
    hesitation = next;
    return next;
  };
  const move = (now: number, next: number) => {
    samples.push({ t: now, x: next });
    // 놓는 속도는 마지막 RELEASE_WINDOW_MS 만 본다. 그 앞의 기준점 하나만 남긴다
    while (samples.length > 2 && samples[1].t <= now - RELEASE_WINDOW_MS) {
      samples.shift();
    }
    if (hesitation) {
      return null;
    }
    const along = next * direction;
    peak = Math.max(peak, along);
    if (peak - along >= BACKTRACK_DISTANCE) {
      return decide('back');
    }
    if (Math.abs(next - anchor.x) > HOLD_SLOP) {
      anchor = { t: now, x: next };
      return null;
    }
    return now - anchor.t >= HOLD_MS ? decide('hold') : null;
  };

  return {
    get hesitation() {
      return hesitation;
    },
    move,
    check: now =>
      !hesitation && now - anchor.t >= HOLD_MS ? decide('hold') : null,
    holdDueAt: () => (hesitation ? null : anchor.t + HOLD_MS),
    release: (now, next) => {
      move(now, next);
      if (hesitation) {
        return hesitation;
      }
      const reference =
        [...samples].reverse().find(s => s.t <= now - RELEASE_WINDOW_MS) ??
        samples[0];
      const elapsed = now - reference.t;
      const speed = elapsed > 0 ? (next - reference.x) / elapsed : 0;
      const toward = speed * (Math.sign(next) || direction);
      return toward < STOP_SPEED ? decide('stop') : null;
    },
  };
}
