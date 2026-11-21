// 메인 탭 좌우 밀기 판정 (#140). 탭 전환(TabSwipeArea)과 화면 안의 가로 제스처 컴포넌트가 같이 쓰는 공용 규칙이다.
// 좌표는 모두 화면(루트 뷰) 기준 pt(iOS)·dp(Android) 이다.
//
// 누가 밀기를 갖나 (터치를 시작한 자리로 한 번 정한다)
// - 화면 좌우 가장자리 띠(EDGE_BAND) → 늘 탭 전환. 세부 컴포넌트가 화면 폭을 꽉 채워도 여기서는 탭을 바꾼다
// - 세부 컴포넌트(상세로 들어가는 카드·행, 자체 가로 제스처가 있는 달력 등)의 가장자리에서 COMPONENT_SLACK 안쪽까지는 배경으로 친다 → 탭 전환
// - 그보다 안쪽 깊은 곳 → 컴포넌트 (탭은 바뀌지 않고, 자체 가로 제스처가 있으면 그것이 받는다)
// - 배경 → 탭 전환
//
// 언제 탭을 바꾸나 (손바닥 오작동 방지)
// - 한 손가락으로, 가로로 SWITCH_DISTANCE 이상, 수평에서 MAX_SWIPE_ANGLE 안쪽으로 움직였을 때만. 그 전에는 아무 일도 없다
// - 방향이 가로로 정해지면(track) 응답자는 먼저 잡는다. Android 세로 리스트는 세로로 터치 슬롭(약 8dp)만 움직여도 가로 성분과
//   상관없이 터치를 가져가므로, 임계값까지 기다리면 엄지로 호를 그리며 민 손길을 놓친다. 탭은 여전히 임계값에서 바꾼다
// - 방향은 리스트 안 가로 밀기 공용 규칙(panAxis.ts, #144)으로 정한다. 10pt 를 넘게 움직였을 때 가로가 확실히 크지 않으면
//   (수평 30° 밖: 세로 우세·세로 먼저) 그 제스처는 끝까지 탭 전환이 아니다. 달력 넘김(45°)보다 좁혀 손바닥 비빔을 거른다
// - 두 손가락 이상이 닿으면 그 제스처는 무시한다

import { AXIS_DECISION_DISTANCE, decidePanAxis } from './panAxis';

export type GestureOwner = 'tab' | 'component';
/** next: 오른쪽 탭으로 (손가락을 왼쪽으로 민다), prev: 왼쪽 탭으로 */
export type SwipeDirection = 'next' | 'prev';
/**
 * wait: 방향을 아직 모른다, track: 가로로 정해졌지만 임계값 전이다 (응답자만 잡는다),
 * switch: 탭을 바꾼다, ignore: 이번 제스처는 탭 전환이 아니다
 */
export type SwipeDecision = 'wait' | 'track' | 'switch' | 'ignore';
export type Rect = { x: number; y: number; width: number; height: number };

/** 1pt(iOS)·1dp(Android) 는 약 1/160 inch 다 (Android 기준 밀도 160dpi, iPhone 1x 163ppi) */
const POINTS_PER_MM = 160 / 25.4;
/**
 * 엄지 접촉면 폭의 대용값 (mm). 엄지 접촉면 폭을 직접 잰 자료 대신, 한 손 엄지로 안정적으로 누르는 최소 목표 크기
 * 9.2mm 를 쓴다 (Parhi·Karlson·Bederson 2006, "Target size study for one-handed thumb use on small touchscreen devices").
 * 목표 크기는 접촉면 크기와 누를 때의 흔들림을 함께 담은 값이라 엄지 접촉면보다 조금 넉넉하다.
 * 엄지를 가장자리에 대고 밀기 시작하면 터치 좌표(접촉면 중심)는 가장자리에서 이 폭 안쪽에 찍힌다
 */
const THUMB_CONTACT_MM = 9.2;

/** 화면 좌우 가장자리 띠 폭 (58pt). 여기서 시작한 가로 밀기는 탭 전환이다. 실기기 체감으로 조정한다 */
export const EDGE_BAND = Math.round(THUMB_CONTACT_MM * POINTS_PER_MM);
/**
 * 세부 컴포넌트 가장자리에서 이만큼 안쪽까지는 배경으로 친다 (pt). 눈에 띄는 겹침이 아니라
 * 경계를 살짝 걸쳐 시작해도 탭이 바뀌는 '조금 여유' (엄지 접촉면 폭의 1/5 남짓, 약 2mm)
 */
export const COMPONENT_SLACK = 12;
/**
 * 탭을 바꾸는 가로 이동 (pt). 한 손으로 쥔 손바닥·엄지 뿌리가 화면 가장자리에 닿아 비벼지는 정도로는 넘지 않게
 * 엄지 접촉면 하나 폭(띠 폭과 같은 값에서 시작) 이상을 가로로 움직여야 '화면 전환 요구' 로 본다.
 * 띠 폭과 따로 실기기 체감으로 조정한다
 */
export const SWITCH_DISTANCE = 58;
/** 수평에서 이 각도(°) 안쪽이어야 가로가 세로보다 확실히 큰 것으로 본다 */
const MAX_SWIPE_ANGLE = 30;

/**
 * 터치를 시작한 자리로 이번 밀기의 주인을 정한다.
 * region 은 시작점을 품은 세부 컴포넌트의 화면 위 사각형이다 (모르면 null: 띠 밖은 컴포넌트가 갖는다).
 * stacked 는 위아래로 다른 행과 붙어 있는 행이다. 위·아래 변이 배경과 맞닿지 않아 여유를 두지 않는다
 */
export function startOwner(
  point: { x: number; y: number },
  region: Rect | null,
  windowWidth: number,
  { stacked = false }: { stacked?: boolean } = {},
): GestureOwner {
  if (point.x < EDGE_BAND || point.x > windowWidth - EDGE_BAND) {
    return 'tab';
  }
  if (region === null) {
    return 'component';
  }
  const vertical = stacked ? 0 : COMPONENT_SLACK;
  const deep =
    point.x >= region.x + COMPONENT_SLACK &&
    point.x <= region.x + region.width - COMPONENT_SLACK &&
    point.y >= region.y + vertical &&
    point.y <= region.y + region.height - vertical;
  return deep ? 'component' : 'tab';
}

/** 시작점에서 지금까지 움직인 거리(dx, dy)와 닿아 있는 손가락 수로 탭 전환을 판정한다 */
export function decideTabSwipe({
  dx,
  dy,
  touches,
}: {
  dx: number;
  dy: number;
  touches: number;
}): SwipeDecision {
  if (touches > 1) {
    return 'ignore';
  }
  // 시작점에서 지금까지의 이동으로 매번 본다. 한 번 세로로 기울면(ignore) 부르는 쪽이 그 제스처를 끝낸다
  const axis = decidePanAxis(dx, dy, { horizontalMaxAngle: MAX_SWIPE_ANGLE });
  if (axis === null) {
    return 'wait';
  }
  if (axis === 'vertical') {
    return 'ignore';
  }
  return Math.abs(dx) >= SWITCH_DISTANCE ? 'switch' : 'track';
}

// 덮기 밀기 (#216). 메인 탭은 이웃 탭 화면이 손가락을 따라 덮고, 놓을 때 바꿀지 정한다 (작업 이력 달 넘김 #153 은 위의
// SWITCH_DISTANCE 에서 바로 넘긴다). 멈추지 않고 이어 밀었으면 방향을 정하는 거리만 넘어도 바꾸고(인스타그램처럼 거의 터치 수준),
// 미는 중에 멈추거나 되돌렸거나 멈춘 채 떼면(swipeHesitation.ts) 망설인 것이라 화면 폭의 절반을 넘겨야 바꾼다.
// 손바닥·손가락이 스치는 아주 작은 움직임은 방향을 정하는 거리(10pt)를 넘지 못해 탭 밀기가 되지 않는다. 시작 자리는 가리지 않는다

/** 이어 밀 때 탭을 바꾸는 거리 (pt). 방향을 정하는 거리와 같다: 가로로 정해지면 바로 */
export const QUICK_SWITCH_DISTANCE = AXIS_DECISION_DISTANCE;
/** 망설인 뒤에 탭을 바꾸는 거리는 화면 폭의 이 비율이다 */
export const HESITANT_SWITCH_RATIO = 0.5;

/** 망설인 뒤에 탭을 바꾸는 거리 (pt). 화면 폭에 따라 다시 잰다 (393pt → 196pt) */
export function hesitantSwitchDistance(windowWidth: number): number {
  return Math.floor(windowWidth * HESITANT_SWITCH_RATIO);
}

/** 지금 탭을 바꾸는 거리 */
export function switchDistanceFor(hesitant: boolean, windowWidth: number) {
  return hesitant ? hesitantSwitchDistance(windowWidth) : QUICK_SWITCH_DISTANCE;
}

/** 놓을 때 탭을 바꾸는지. distance 는 시작점에서 가로로 간 거리 */
export function switchOnRelease({
  distance,
  hesitant,
  windowWidth,
}: {
  distance: number;
  hesitant: boolean;
  windowWidth: number;
}): boolean {
  return Math.abs(distance) >= switchDistanceFor(hesitant, windowWidth);
}

/** 덮기 밀기의 판정. 가로로 정해지면 놓을 때까지 따라가기만 한다 (미는 중에는 바꾸지 않는다) */
export function decideTabTrack({
  dx,
  dy,
  touches,
}: {
  dx: number;
  dy: number;
  touches: number;
}): 'wait' | 'track' | 'ignore' {
  const decision = decideTabSwipe({ dx, dy, touches });
  return decision === 'switch' ? 'track' : decision;
}

/** 손가락을 왼쪽으로 밀면(dx < 0) 오른쪽 탭으로 간다 */
export function swipeDirection(dx: number): SwipeDirection {
  return dx < 0 ? 'next' : 'prev';
}

/** 옮겨 갈 이웃 탭. 양 끝 탭에서 바깥쪽이면 null */
export function neighborIndex(
  index: number,
  count: number,
  direction: SwipeDirection,
): number | null {
  const next = direction === 'next' ? index + 1 : index - 1;
  return next >= 0 && next < count ? next : null;
}
