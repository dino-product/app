import {
  barTravel,
  COLLAPSE_AFTER,
  COLLAPSE_INITIAL,
  COLLAPSE_MS,
  COLLAPSED_BAR_HEIGHT,
  collapseEasing,
  collapseKeyframes,
  EXPANDED_BAR_HEIGHT,
  EXPANDED_MONTH_ROW,
  monthTravel,
  nextCollapseState,
  visibleBar,
  wantsCollapsed,
  type CollapseState,
} from './headerCollapse';

// 내용이 충분히 긴 리스트 (스크롤 뷰 600, 내용 2000)
const at = (offset: number, contentHeight = 2000) => ({
  offset,
  contentHeight,
  viewportHeight: 600,
});
const EXPANDED: CollapseState = COLLAPSE_INITIAL;
const COLLAPSED: CollapseState = { collapsed: true, running: false };

describe('wantsCollapsed — 스크롤 위치가 바라는 상태 (#175)', () => {
  it('맨 위에서 기준값(12)까지는 펼친 채이고, 넘으면 접는다', () => {
    expect(COLLAPSE_AFTER).toBe(12);
    expect(wantsCollapsed(at(0), false)).toBe(false);
    expect(wantsCollapsed(at(12), false)).toBe(false);
    expect(wantsCollapsed(at(12.5), false)).toBe(true);
    expect(wantsCollapsed(at(800), false)).toBe(true);
  });

  it('접힌 뒤에는 맨 위(0)에 닿아야 펼친다. 그 사이로 올라와도 접힌 채다', () => {
    expect(wantsCollapsed(at(300), true)).toBe(true);
    expect(wantsCollapsed(at(12), true)).toBe(true);
    expect(wantsCollapsed(at(1), true)).toBe(true);
    expect(wantsCollapsed(at(0), true)).toBe(false);
  });

  it('맨 위에서 더 당긴 위치(iOS 바운스·당겨서 새로고침)는 맨 위다', () => {
    expect(wantsCollapsed(at(-40), true)).toBe(false);
    expect(wantsCollapsed(at(-40), false)).toBe(false);
  });

  // 내용이 짧으면 기준값 넘게 스크롤할 수 없다. 끝을 넘어 끌리는 바운스로 접히지 않고, 접혀 있었으면 펼친다
  it('기준값 넘게 스크롤할 수 없는 짧은 내용이면 늘 펼친다', () => {
    expect(wantsCollapsed(at(20, 612), false)).toBe(false);
    expect(wantsCollapsed(at(8, 612), true)).toBe(false);
    expect(wantsCollapsed(at(0, 300), true)).toBe(false);
    // 13 만큼 스크롤할 수 있으면 접을 수 있다
    expect(wantsCollapsed(at(13, 613), false)).toBe(true);
  });
});

describe('nextCollapseState — 원자적 전환 (#175)', () => {
  it('바라는 상태가 지금과 다르면 그쪽으로 전환을 시작한다', () => {
    expect(nextCollapseState(EXPANDED, at(300))).toEqual({
      collapsed: true,
      running: true,
    });
    expect(nextCollapseState(COLLAPSED, at(0))).toEqual({
      collapsed: false,
      running: true,
    });
  });

  it('바라는 상태와 같으면 같은 상태를 그대로 돌려준다', () => {
    expect(nextCollapseState(EXPANDED, at(5))).toBe(EXPANDED);
    expect(nextCollapseState(COLLAPSED, at(5))).toBe(COLLAPSED);
  });

  it('전환 중에는 반대 조건이 되어도 그대로 둔다 (시작한 전환은 끝까지 간다)', () => {
    const collapsing: CollapseState = { collapsed: true, running: true };
    const expanding: CollapseState = { collapsed: false, running: true };

    expect(nextCollapseState(collapsing, at(0))).toBe(collapsing);
    expect(nextCollapseState(expanding, at(300))).toBe(expanding);
  });
});

describe('전환 시간·곡선·키프레임 (#175 짧은 페이드)', () => {
  it('260ms, cubic-bezier(0.2, 0, 0, 1) 감속 곡선이다', () => {
    expect(COLLAPSE_MS).toBe(260);
    // 빠르게 출발해 부드럽게 멈춘다: 절반 시간에 이미 대부분 간다
    expect(collapseEasing(0)).toBe(0);
    expect(collapseEasing(0.5)).toBeGreaterThan(0.8);
    expect(collapseEasing(1)).toBe(1);
  });

  it('제목은 진행도 33% 안에 투명도 0·위로 6 이 되고 그 뒤는 그대로다', () => {
    expect(collapseKeyframes.titleOpacity).toEqual({
      inputRange: [0, 0.33, 1],
      outputRange: [1, 0, 0],
    });
    expect(collapseKeyframes.titleTranslateY).toEqual({
      inputRange: [0, 0.33, 1],
      outputRange: [0, -6, -6],
    });
  });

  // 진행도는 곡선을 거친 값이다. 감속 곡선이라 시간의 33% 에 진행도는 33% 를 이미 넘는다
  it('전환 시간의 33% 시점에 제목 투명도는 이미 0 이다', () => {
    const progressAtThird = collapseEasing(0.33);
    const fadeEnd = collapseKeyframes.titleOpacity.inputRange[1];

    expect(progressAtThird).toBeGreaterThanOrEqual(fadeEnd);
    expect(collapseKeyframes.titleOpacity.outputRange[1]).toBe(0);
  });

  it('화살표는 진행도 35% 안에 투명도 0, 안쪽으로 8, 크기 ×0.5 가 된다', () => {
    expect(collapseKeyframes.arrowOpacity).toEqual({
      inputRange: [0, 0.35, 1],
      outputRange: [1, 0, 0],
    });
    expect(collapseKeyframes.arrowScale).toEqual({
      inputRange: [0, 0.35, 1],
      outputRange: [1, 0.5, 0.5],
    });
    // ◀ 는 오른쪽(+), ▶ 는 왼쪽(-)으로 월 글자 쪽을 향해 들어간다
    expect(collapseKeyframes.prevArrowTranslateX).toEqual({
      inputRange: [0, 0.35, 1],
      outputRange: [0, 8, 8],
    });
    expect(collapseKeyframes.nextArrowTranslateX).toEqual({
      inputRange: [0, 0.35, 1],
      outputRange: [0, -8, -8],
    });
  });

  it('월 글자는 전환 내내 20 → 18 (×0.9) 로 줄고, 바 회색 배경·그림자는 전환 내내 나타난다', () => {
    expect(collapseKeyframes.monthTextScale).toEqual({
      inputRange: [0, 1],
      outputRange: [1, 0.9],
    });
    expect(collapseKeyframes.barTintOpacity).toEqual({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });
  });
});

// Figma 작업이력 (기본) 3753:4890 · (스크롤) 50833:6839. 상태 표시줄(60) 아래 기준
describe('접힘 거리 (#175)', () => {
  it('바 높이는 펼침 108(요약 카드 위 끝), 접힘 68 이다', () => {
    expect(EXPANDED_BAR_HEIGHT).toBe(108);
    expect(COLLAPSED_BAR_HEIGHT).toBe(68);
  });

  it('바 배경은 아래 끝이 펼친 바 높이에서 68 로 올라간다', () => {
    expect(barTravel(EXPANDED_BAR_HEIGHT)).toBe(-40);
    // 큰 글자로 펼친 바가 높아지면 그만큼 더 올라간다
    expect(barTravel(150)).toBe(-82);
  });

  // 기본 월 줄은 위 56·높이 28 (가운데 70), 접힌 월 글자(18 / 1.4)는 위 19 (가운데 31.6)
  it('월 줄은 가운데가 접힌 월 글자의 가운데(31.6)에 오도록 올라간다', () => {
    expect(EXPANDED_MONTH_ROW).toEqual({ y: 56, height: 28 });
    expect(monthTravel(EXPANDED_MONTH_ROW)).toBeCloseTo(-38.4, 5);
    expect(monthTravel({ y: 70, height: 40 })).toBeCloseTo(-58.4, 5);
  });
});

describe('visibleBar — 탭·월 밀기 판정에 쓰는 바 자리 (#175)', () => {
  const BAR = { x: 0, y: 47, width: 390, height: 108 };

  it('펼친 동안은 잰 바 그대로, 접힌 동안은 위에서 68 까지다', () => {
    expect(visibleBar(BAR, false)).toBe(BAR);
    expect(visibleBar(BAR, true)).toEqual({ ...BAR, height: 68 });
  });

  it('잴 수 없으면 모른다', () => {
    expect(visibleBar(null, true)).toBeNull();
  });
});
