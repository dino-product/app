import type { Rect, SwipeDirection } from '../../shared/gesture/tabSwipe';

// 작업 이력 목록을 좌우로 밀어 달을 옮긴다 (#153). 탭 전환과 같은 판정(useSwipeSwitch)·같은 영역 규칙(useTabSwipeRegion)을 쓴다.
// 월 넘김 판정 영역은 '목록 영역' — 리스트에서 그 위를 덮은 것(겹쳐 그린 상단 바와 그 안의 월 선택 #175, 리스트 머리인 요약 카드)이
// 화면에 보이는 만큼을 뺀 아래쪽이다. 영역 규칙이 그 가장자리에서 조금(COMPONENT_SLACK) 안쪽부터만 월 넘김으로 보고,
// 가장자리 여유·화면 가장자리 띠·머리·상단 바에서 시작한 밀기는 탭 전환에 맡긴다.
// 상단 바는 빈 곳의 터치를 아래 리스트로 통과시키므로(box-none) 보이는 동안은 그 자리도 빼야 한다.

/**
 * 월 넘김 판정 영역 (화면 좌표). list 는 리스트(스크롤 뷰) 사각형, covers 는 리스트 위쪽을 덮는 것들(상단 바·리스트 머리)이다.
 * 덮는 것들은 스크롤·자동 숨김으로 위로 올라가므로 아래 끝이 가장 낮은 것까지 뺀다. 잴 수 없는 것은 빼지 않고,
 * 리스트를 잴 수 없으면 null
 */
export function rowsArea(
  list: Rect | null,
  covers: readonly (Rect | null)[],
): Rect | null {
  if (list === null) {
    return null;
  }
  const bottom = list.y + list.height;
  const top = covers.reduce(
    (lowest, cover) =>
      cover === null ? lowest : Math.max(lowest, cover.y + cover.height),
    list.y,
  );
  return {
    x: list.x,
    y: Math.min(top, bottom),
    width: list.width,
    height: Math.max(0, bottom - top),
  };
}

/** 밀기 방향으로 옮길 달 수. 왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 이전 달. 다음 달로 갈 수 없으면(이번 달) null */
export function monthStep(
  direction: SwipeDirection,
  canGoNext: boolean,
): -1 | 1 | null {
  if (direction === 'prev') {
    return -1;
  }
  return canGoNext ? 1 : null;
}
