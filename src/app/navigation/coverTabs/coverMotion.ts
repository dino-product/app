import { Animated, Easing } from 'react-native';

// 메인 탭 덮기 전환의 움직임 (#216, 시안 B 시차 덮기). 이웃 탭 화면(over)이 손가락을 따라 지금 화면(under) 위로 덮고,
// 아래 화면은 같은 쪽으로 조금 밀리며 어두워진다. 움직이는 동안 두 화면 모서리가 둥글다 (들어오는 화면 22 → 0, 아래 0 → 22).
// 값은 모두 손가락이 간 거리(finger) × 따라오는 비율(follow) 하나에서 나온다. 둘 다 네이티브 값이라 미는 동안 JS 는
// 손가락 거리만 넘기고, 화면 위치·모서리·어둡기는 UI 스레드에서 계산된다

/** 아래 화면이 같은 쪽으로 밀리는 비율 (손가락 이동의 30%) */
export const PARALLAX = 0.3;
/** 아래 화면이 가장 어두워지는 정도 */
export const DIM = 0.1;
/** 움직이는 동안의 모서리 (pt) */
export const CORNER_RADIUS = 22;
/** 임계 전에는 손가락의 이만큼만 따라온다. 임계를 넘으면 FOLLOW_MS 에 손가락 위치로 따라붙는다 (딸깍) */
export const FOLLOW_BEFORE = 0.8;
export const FOLLOW_MS = 110;
/** 놓은 뒤 마무리 (화면 폭 전체를 갈 때). 남은 거리에 비례하고 최소 SETTLE_MIN_RATIO */
export const SETTLE_MS = 280;
export const SETTLE_MIN_RATIO = 0.4;
/** 끝 탭에서 바깥으로 밀면 이만큼(pt)까지만 버티다 EDGE_RETURN_MS 에 돌아온다 */
export const EDGE_RESIST = 28;
export const EDGE_RETURN_MS = 220;

/** cubic-out */
export const coverEasing = Easing.bezier(0.33, 1, 0.68, 1);

export function settleDuration(from: number, to: number, width: number) {
  return Math.round(
    SETTLE_MS * Math.max(SETTLE_MIN_RATIO, Math.abs(to - from) / width),
  );
}

/** 끝 탭에서 바깥으로 distance 만큼 밀 때 지금 화면이 버티는 거리 */
export function edgeResistance(distance: number) {
  return (
    Math.sign(distance) *
    EDGE_RESIST *
    (1 - Math.exp(-Math.abs(distance) / 110))
  );
}

export type Follow = { crossed: boolean; threshold: number };

/**
 * 임계를 넘었는지로 따라오는 비율을 정한다. snap 'in' 은 손가락 위치로 따라붙기(+햅틱), 'out' 은 80% 로 물러나기다.
 * 망설여 임계가 커져서 넘지 않게 된 것은 손가락이 움직인 것이 아니므로 화면을 그 자리에 둔다
 */
export function nextFollow(
  previous: Follow | null,
  distance: number,
  threshold: number,
): { follow: Follow; snap: 'in' | 'out' | null; haptic: boolean } {
  const crossed = distance >= threshold;
  const follow = { crossed, threshold };
  if (crossed && !previous?.crossed) {
    return { follow, snap: 'in', haptic: true };
  }
  if (!crossed && previous?.crossed && threshold <= previous.threshold) {
    return { follow, snap: 'out', haptic: false };
  }
  return { follow, snap: null, haptic: false };
}

type Values = {
  /** +1: 오른쪽 탭으로 (왼쪽으로 민다), -1: 왼쪽 탭으로 */
  side: 1 | -1;
  /** 손가락이 간 거리 (pt) */
  finger: Animated.Value;
  /** 따라오는 비율 */
  follow: Animated.Value;
  /** 끝 탭에서 버티는 거리 (pt) */
  edge: Animated.Value;
};

/** 들어오는 화면(over)·아래 화면(under)·그 사이 어둡게(scrim)·끝 탭(edge)의 스타일 */
export function coverStyles(
  { side, finger, follow, edge }: Values,
  width: number,
) {
  const travel = Animated.multiply(finger, follow);
  const along = (from: number, to: number) =>
    travel.interpolate({
      inputRange: [0, width],
      outputRange: [from, to],
      extrapolate: 'clamp',
    });
  return {
    over: {
      transform: [{ translateX: along(side * width, 0) }],
      borderRadius: along(CORNER_RADIUS, 0),
    },
    under: {
      transform: [{ translateX: along(0, -side * width * PARALLAX) }],
      borderRadius: along(0, CORNER_RADIUS),
    },
    scrim: { opacity: along(0, DIM) },
    edge: { transform: [{ translateX: edge }] },
  };
}
