import type { Rect, SwipeDirection } from '../../shared/gesture/tabSwipe';

// 작업 이력 목록을 좌우로 밀어 달을 옮긴다 (#153). 탭 전환과 같은 판정(useSwipeSwitch)·같은 영역 규칙(useTabSwipeRegion)을 쓴다.
// 월 넘김 판정 영역은 '목록 영역' — 리스트에서 화면에 보이는 머리(월 선택·요약 카드)를 뺀 아래쪽이다. 영역 규칙이 그 가장자리에서
// 조금(COMPONENT_SLACK) 안쪽부터만 월 넘김으로 보고, 가장자리 여유·화면 가장자리 띠·머리·배경에서 시작한 밀기는 탭 전환에 맡긴다.

/**
 * 월 넘김 판정 영역 (화면 좌표). list 는 리스트(스크롤 뷰) 사각형, header 는 리스트 머리 사각형이다.
 * 머리는 리스트와 함께 스크롤되므로 화면에 보이는 만큼만 뺀다. 머리를 잴 수 없으면 리스트 전체, 리스트를 잴 수 없으면 null
 */
export function rowsArea(list: Rect | null, header: Rect | null): Rect | null {
  if (list === null) {
    return null;
  }
  if (header === null) {
    return list;
  }
  const top = Math.max(list.y, header.y + header.height);
  const bottom = list.y + list.height;
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
