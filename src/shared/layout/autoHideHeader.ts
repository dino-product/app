// 탭 첫 화면 상단 바의 자동 숨김 판단 (#148). 스크롤 위치가 바뀔 때마다 숨길지만 정하는 순수 함수이고,
// 상단 바를 옮기는 애니메이션은 useAutoHideHeader 가 UI 스레드에서 돌린다.
//
// - 맨 위 근처(상단 바 높이 이내)에서는 늘 보인다.
// - 그 아래에서 아래로 DIRECTION_SLOP 넘게 스크롤하면 숨고, 숨은 뒤 위로 DIRECTION_SLOP 넘게 스크롤하면
//   맨 위까지 가지 않아도 다시 보인다. 기준(anchor)은 지금 방향으로 가장 멀리 간 위치다.
// - 내용 범위 밖(iOS 바운스·당겨서 새로고침의 음수 위치, 맨 아래 바운스)은 범위 끝으로 본다.
//   끝을 넘어 끌렸다 되돌아오는 움직임을 방향 전환으로 읽어 깜빡이지 않게 한다.

/** 방향을 바꾼 것으로 보는 거리 (pt). 손가락 떨림·관성이 멈출 때의 작은 되돌림은 무시한다 */
export const DIRECTION_SLOP = 10;

export type AutoHideState = {
  hidden: boolean;
  /** 지금 방향으로 가장 멀리 간 위치. 숨은 동안은 가장 아래, 보이는 동안은 가장 위 */
  anchor: number;
};

/** 보이는 상태. 위치는 아직 모른다: 다음에 받은 위치를 기준으로 삼는다 (리스트가 바뀐 뒤에도 쓴다) */
export const AUTO_HIDE_INITIAL: AutoHideState = {
  hidden: false,
  anchor: Number.POSITIVE_INFINITY,
};

export type ScrollMetrics = {
  /** 스크롤 위치 (contentOffset.y) */
  offset: number;
  contentHeight: number;
  /** 스크롤 뷰 높이 (layoutMeasurement.height) */
  viewportHeight: number;
};

/**
 * 스크롤 위치가 바뀌었을 때 상단 바를 숨길지 정한다. 바뀐 것이 없으면 같은 상태를 돌려준다.
 * topZone: 이 위치보다 위에서는 늘 보인다 (상단 바 높이)
 */
export function nextAutoHideState(
  state: AutoHideState,
  { offset, contentHeight, viewportHeight }: ScrollMetrics,
  topZone: number,
): AutoHideState {
  const end = Math.max(0, contentHeight - viewportHeight);
  const y = Math.min(Math.max(offset, 0), end);
  if (y < topZone) {
    return keep(state, false, y);
  }
  if (state.hidden) {
    if (y >= state.anchor) {
      return keep(state, true, y);
    }
    return state.anchor - y >= DIRECTION_SLOP
      ? { hidden: false, anchor: y }
      : state;
  }
  if (y <= state.anchor) {
    return keep(state, false, y);
  }
  return y - state.anchor >= DIRECTION_SLOP
    ? { hidden: true, anchor: y }
    : state;
}

const keep = (state: AutoHideState, hidden: boolean, anchor: number) =>
  state.hidden === hidden && state.anchor === anchor
    ? state
    : { hidden, anchor };
