import {
  completedInMonth,
  completedWorkA11yLabel,
  formatWorkTime,
  isBeforeMonth,
  monthOf,
  spokenTimeRange,
  type CompletedWork,
} from './model';

const base = {
  title: '세탁기 설치',
  start: '08:00',
  end: '09:00',
  company: '한빛 설비',
  customerName: '정다은',
  address: '서울 용산구 이태원로 202',
};

const works: CompletedWork[] = [
  { ...base, id: 'a', dateKey: '2026-09-03' },
  { ...base, id: 'b', dateKey: '2026-09-26', start: '08:00', end: '09:00' },
  { ...base, id: 'c', dateKey: '2026-10-01' },
  { ...base, id: 'd', dateKey: '2026-09-26', start: '13:00', end: '14:00' },
  { ...base, id: 'e', dateKey: '2025-09-30' },
  { ...base, id: 'f', dateKey: '2026-08-31' },
];

describe('completedInMonth', () => {
  it('고른 달에 완료한 작업만 고르고 최근 순(날짜·시작 시각 내림차순)으로 둔다', () => {
    const result = completedInMonth(works, { year: 2026, month: 8 });

    expect(result.map(work => work.id)).toEqual(['d', 'b', 'a']);
  });

  it('다른 해의 같은 달은 넣지 않는다', () => {
    const result = completedInMonth(works, { year: 2025, month: 8 });

    expect(result.map(work => work.id)).toEqual(['e']);
  });

  it('완료한 작업이 없는 달은 빈 목록이다', () => {
    expect(completedInMonth(works, { year: 2026, month: 0 })).toEqual([]);
  });

  it('받은 목록의 순서는 바꾸지 않는다', () => {
    const before = works.map(work => work.id);

    completedInMonth(works, { year: 2026, month: 8 });

    expect(works.map(work => work.id)).toEqual(before);
  });
});

describe('달 비교', () => {
  it('monthOf 는 그 날의 연·월(0부터)이다', () => {
    expect(monthOf(new Date(2026, 11, 31))).toEqual({ year: 2026, month: 11 });
  });

  it('isBeforeMonth 는 앞선 달일 때만 true 다 (연도가 다르면 연도로)', () => {
    const now = { year: 2026, month: 0 };

    expect(isBeforeMonth({ year: 2025, month: 11 }, now)).toBe(true);
    expect(isBeforeMonth({ year: 2026, month: 0 }, now)).toBe(false);
    expect(isBeforeMonth({ year: 2026, month: 1 }, now)).toBe(false);
    expect(isBeforeMonth({ year: 2025, month: 0 }, now)).toBe(true);
  });
});

describe('표기', () => {
  it('formatWorkTime 은 "YYYY.MM.DD (요일) HH:mm - HH:mm" 이다', () => {
    expect(formatWorkTime({ ...base, id: 'x', dateKey: '2026-09-26' })).toBe(
      '2026.09.26 (토) 08:00 - 09:00',
    );
  });

  it('spokenTimeRange 는 오전·오후를 붙여 읽고, 끝 시각은 같은 오전·오후면 생략한다', () => {
    expect(spokenTimeRange('08:00', '09:00')).toBe('오전 8시부터 9시');
    expect(spokenTimeRange('11:30', '13:00')).toBe(
      '오전 11시 30분부터 오후 1시',
    );
    expect(spokenTimeRange('12:00', '12:45')).toBe('오후 12시부터 12시 45분');
    expect(spokenTimeRange('00:00', '01:00')).toBe('오전 12시부터 1시');
  });

  it('completedWorkA11yLabel 은 제목, 완료, 날짜·시간, 발주사, 고객, 주소 순서로 읽는다', () => {
    expect(
      completedWorkA11yLabel({ ...base, id: 'x', dateKey: '2026-09-28' }),
    ).toBe(
      '세탁기 설치, 완료, 2026년 9월 28일 월요일 오전 8시부터 9시, 한빛 설비, 정다은, 서울 용산구 이태원로 202',
    );
  });
});
