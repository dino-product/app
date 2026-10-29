import {
  addMonths,
  formatDateHeader,
  formatMonthTitle,
  isSameDay,
  monthGrid,
  toDateKey,
  validateRejection,
  weekDays,
} from './model';

describe('날짜 계산', () => {
  it('toDateKey 는 YYYY-MM-DD 로 만든다', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('formatDateHeader 는 "YYYY년 M월 D일 (요일)" 로 만든다', () => {
    expect(formatDateHeader(new Date(2026, 11, 31))).toBe(
      '2026년 12월 31일 (목)',
    );
  });

  it('formatMonthTitle 은 "YYYY년 M월" 로 만든다', () => {
    expect(formatMonthTitle(2026, 11)).toBe('2026년 12월');
  });

  it('weekDays 는 그 날이 속한 일요일~토요일 7일을 돌려준다', () => {
    const days = weekDays(new Date(2026, 11, 15));

    expect(days.map(toDateKey)).toEqual([
      '2026-12-13',
      '2026-12-14',
      '2026-12-15',
      '2026-12-16',
      '2026-12-17',
      '2026-12-18',
      '2026-12-19',
    ]);
  });

  it('monthGrid 는 그 달을 덮는 주 단위 격자를 만들고 다른 달 날짜를 표시한다', () => {
    const grid = monthGrid(2026, 11);

    expect(grid).toHaveLength(5);
    expect(grid.every(week => week.length === 7)).toBe(true);
    expect(toDateKey(grid[0][0].date)).toBe('2026-11-29');
    expect(grid[0][0].inMonth).toBe(false);
    expect(toDateKey(grid[0][2].date)).toBe('2026-12-01');
    expect(grid[0][2].inMonth).toBe(true);
    expect(toDateKey(grid[4][6].date)).toBe('2027-01-02');
  });

  it('monthGrid 는 6주에 걸치는 달도 다룬다', () => {
    // 2026년 8월 1일은 토요일, 31일은 월요일
    expect(monthGrid(2026, 7)).toHaveLength(6);
  });

  it('addMonths 는 해를 넘나든다', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('isSameDay 는 시각을 무시하고 날짜만 비교한다', () => {
    expect(
      isSameDay(new Date(2026, 11, 15, 9), new Date(2026, 11, 15, 23)),
    ).toBe(true);
    expect(isSameDay(new Date(2026, 11, 15), new Date(2026, 11, 16))).toBe(
      false,
    );
  });
});

describe('validateRejection', () => {
  it('사유를 고르지 않으면 select 오류다', () => {
    expect(validateRejection(null, '')).toEqual({ ok: false, error: 'select' });
  });

  it('기타를 골랐는데 내용이 비어 있으면 otherText 오류다', () => {
    expect(validateRejection('other', '   ')).toEqual({
      ok: false,
      error: 'otherText',
    });
  });

  it('기타는 입력한 내용을, 나머지는 사유 문구를 돌려준다', () => {
    expect(validateRejection('other', ' 개인 사정 ')).toEqual({
      ok: true,
      reason: '개인 사정',
    });
    expect(validateRejection('distance', '')).toEqual({
      ok: true,
      reason: '작업 위치가 너무 멉니다',
    });
  });
});
