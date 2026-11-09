import { monthStep, rowsArea } from './monthSwipe';

// 화면 위 작업 이력 리스트(상단 바 아래부터 탭 바 위까지)
const LIST = { x: 0, y: 100, width: 390, height: 600 };

describe('rowsArea — 월 넘김 판정 영역 (목록 영역)', () => {
  // 리스트 위에 겹쳐 그린 상단 바(#148). 보이면 리스트 맨 위 50 을 덮고, 숨으면 그만큼 위로 올라간다
  const BAR = { x: 0, y: 100, width: 390, height: 50 };
  const HIDDEN_BAR = { ...BAR, y: 50 };

  it('리스트에서 그 위를 덮은 것(상단 바·머리)이 보이는 만큼을 뺀 아래쪽이다', () => {
    // 맨 위: 상단 바 아래에 머리(월 선택·요약 카드)가 220
    const header = { x: 0, y: 150, width: 390, height: 220 };

    expect(rowsArea(LIST, [BAR, header])).toEqual({
      x: 0,
      y: 370,
      width: 390,
      height: 330,
    });
  });

  it('머리가 스크롤로 다 올라가도 보이는 상단 바 아래부터다 (상단 바 빈 곳 터치는 리스트로 통과한다)', () => {
    const header = { x: 0, y: -300, width: 390, height: 220 };

    expect(rowsArea(LIST, [BAR, header])).toEqual({
      x: 0,
      y: 150,
      width: 390,
      height: 550,
    });
  });

  it('상단 바가 숨고 머리도 올라가면 리스트 전체다', () => {
    const header = { x: 0, y: -300, width: 390, height: 220 };

    expect(rowsArea(LIST, [HIDDEN_BAR, header])).toEqual(LIST);
  });

  it('스크롤해 머리가 일부만 보이면 보이는 만큼만 뺀다', () => {
    const header = { x: 0, y: -60, width: 390, height: 220 };

    expect(rowsArea(LIST, [HIDDEN_BAR, header])).toEqual({
      x: 0,
      y: 160,
      width: 390,
      height: 540,
    });
  });

  it('덮은 것을 잴 수 없으면 빼지 않고, 리스트를 잴 수 없으면 모른다', () => {
    expect(rowsArea(LIST, [null, null])).toEqual(LIST);
    expect(rowsArea(LIST, [])).toEqual(LIST);
    expect(rowsArea(null, [BAR])).toBeNull();
  });

  it('덮은 것이 리스트를 다 덮으면 높이 0 이다 (월을 넘기지 않는다)', () => {
    const header = { x: 0, y: 100, width: 390, height: 900 };

    expect(rowsArea(LIST, [header])?.height).toBe(0);
  });
});

describe('monthStep — 밀기 방향으로 옮길 달', () => {
  it('왼쪽으로 밀면(next) 다음 달, 오른쪽으로 밀면(prev) 이전 달', () => {
    expect(monthStep('next', true)).toBe(1);
    expect(monthStep('prev', true)).toBe(-1);
    expect(monthStep('prev', false)).toBe(-1);
  });

  it('다음 달로 갈 수 없으면(이번 달) 왼쪽 밀기는 아무 일도 없다', () => {
    expect(monthStep('next', false)).toBeNull();
  });
});
