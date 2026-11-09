import { Easing } from 'react-native';
import type { Rect } from '../../shared/gesture/tabSwipe';
import type { ScrollMetrics } from '../../shared/layout/autoHideHeader';

// 작업 이력 상단 바 접힘 (#175, Figma 작업이력 (기본) 3753:4890 → (스크롤) 50833:6839).
// 맨 위에서는 제목 '작업 이력' 과 ◀ 월 ▶ 이 보이고, 조금이라도 내리면 제목이 짧은 페이드로 사라지고 월 글자가 바로
// 위(접힌 바)로 올라가 흡수된다. 스크롤 양에 따라 중간에 멈추지 않는 원자적 전환이다: 진행도 하나(0 펼침, 1 접힘)를
// 정해진 시간·곡선으로 끝까지 돌리고, 각 부분은 그 진행도를 키프레임으로 보간한다. 펼침은 같은 곡선으로 진행도를 1 → 0 으로
// 돌린다 (접힘의 시간축을 뒤집은 것: 제목은 마지막에 나타난다). 이 파일은 판단·값만 두고, 애니메이션은 useHeaderCollapse 가 돌린다.
// 사용자가 HTML 시안 6가지 중 고른 '짧은 페이드' 의 키프레임 그대로다.

/** 이 위치(pt)보다 아래로 내리면 접는다. 펼치는 것은 맨 위(0)에 닿았을 때뿐이다 */
export const COLLAPSE_AFTER = 12;
/** 접힘·펼침 시간 (ms) */
export const COLLAPSE_MS = 260;
/** cubic-bezier(0.2, 0, 0, 1): 빠르게 출발해 부드럽게 멈춘다 */
export const collapseEasing = Easing.bezier(0.2, 0, 0, 1);

// Figma 값 (상태 표시줄 60 아래 기준). 펼친 바: 제목 위 8 · 높이 34, 사이 14, 월 줄 높이 28, 요약 카드까지 24
/** 기본 글자 크기에서 펼친 바 높이 (요약 카드 위 끝). 큰 글자에서는 잰 높이를 쓴다 */
export const EXPANDED_BAR_HEIGHT = 108;
/** 기본 글자 크기에서 펼친 바 안의 월 줄 자리 (Figma 위 116 - 60, 높이 28). 큰 글자에서는 잰 자리를 쓴다 */
export const EXPANDED_MONTH_ROW = { y: 56, height: 28 };
/** 접힌 바 높이 (Figma 128 - 상태 표시줄 60) */
export const COLLAPSED_BAR_HEIGHT = 68;
/** 접힌 월 글자(Body/S/SemiBold 18 / 1.4)의 가운데: 위 19 + 25.2 / 2 */
const COLLAPSED_MONTH_CENTER = 19 + (18 * 1.4) / 2;

type Keyframes = { inputRange: number[]; outputRange: number[] };

/** 진행도(0 펼침 → 1 접힘)에 맞춘 각 부분의 값. Animated 의 interpolate 설정으로 그대로 넘긴다 */
export const collapseKeyframes = {
  // 제목은 앞 33% 안에 사라지고 그 뒤로는 0 이다 (중간 장면에 반투명한 제목이 남지 않는다)
  titleOpacity: { inputRange: [0, 0.33, 1], outputRange: [1, 0, 0] },
  titleTranslateY: { inputRange: [0, 0.33, 1], outputRange: [0, -6, -6] },
  // 화살표는 앞 35% 안에 월 글자 쪽으로 8 들어가며 반으로 줄어 사라진다
  arrowOpacity: { inputRange: [0, 0.35, 1], outputRange: [1, 0, 0] },
  arrowScale: { inputRange: [0, 0.35, 1], outputRange: [1, 0.5, 0.5] },
  prevArrowTranslateX: { inputRange: [0, 0.35, 1], outputRange: [0, 8, 8] },
  nextArrowTranslateX: { inputRange: [0, 0.35, 1], outputRange: [0, -8, -8] },
  // 월 글자 Body/M 20 → Body/S 18
  monthTextScale: { inputRange: [0, 1], outputRange: [1, 18 / 20] },
  // 접힌 바의 회색 배경(Background/3)·그림자
  barTintOpacity: { inputRange: [0, 1], outputRange: [0, 1] },
} satisfies Record<string, Keyframes>;

/** 바 배경 아래 끝이 펼친 바 높이에서 접힌 바 높이로 올라가는 거리 (음수) */
export const barTravel = (expandedHeight: number) =>
  COLLAPSED_BAR_HEIGHT - expandedHeight;

/** 월 줄(바 안의 위치)의 가운데가 접힌 월 글자의 가운데로 올라가는 거리 (음수) */
export const monthTravel = ({ y, height }: { y: number; height: number }) =>
  COLLAPSED_MONTH_CENTER - (y + height / 2);

/** 스크롤 위치가 바라는 상태. 기준값과 맨 위 사이에서는 지금 상태를 그대로 둔다 */
export function wantsCollapsed(
  { offset, contentHeight, viewportHeight }: ScrollMetrics,
  collapsed: boolean,
): boolean {
  // 기준값 넘게 스크롤할 수 없는 짧은 내용은 접지 않는다 (끝을 넘어 끌리는 바운스로 접히지 않게)
  if (contentHeight - viewportHeight <= COLLAPSE_AFTER) {
    return false;
  }
  if (offset > COLLAPSE_AFTER) {
    return true;
  }
  return offset <= 0 ? false : collapsed;
}

export type CollapseState = {
  /** 접혔는지. 전환 중이면 향하는 상태다 */
  collapsed: boolean;
  /** 전환 중인지. 전환은 끝까지 가고, 끝난 뒤 다시 판단한다 */
  running: boolean;
};

export const COLLAPSE_INITIAL: CollapseState = {
  collapsed: false,
  running: false,
};

/**
 * 스크롤 위치가 바뀌었을 때(또는 전환이 끝났을 때) 다음 상태. 전환 중이면 그대로 두고, 바라는 상태가 다르면 전환을 시작한다.
 * 바뀐 것이 없으면 같은 상태를 돌려준다
 */
export function nextCollapseState(
  state: CollapseState,
  metrics: ScrollMetrics,
): CollapseState {
  if (state.running) {
    return state;
  }
  const collapsed = wantsCollapsed(metrics, state.collapsed);
  return collapsed === state.collapsed ? state : { collapsed, running: true };
}

/**
 * 탭·월 밀기 판정에 쓰는 바 자리. 바 뷰는 펼친 크기 그대로 두고 그리는 것만 줄이므로, 접힌 동안은 접힌 바 높이까지만이다.
 * 그 아래(펼친 바가 차지하던 자리)는 터치가 리스트로 통과한다
 */
export function visibleBar(rect: Rect | null, collapsed: boolean): Rect | null {
  if (rect === null || !collapsed) {
    return rect;
  }
  return { ...rect, height: Math.min(rect.height, COLLAPSED_BAR_HEIGHT) };
}
