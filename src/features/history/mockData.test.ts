import { toDateKey } from '../schedule/model';
import { makeHistoryMock } from './mockData';
import { completedInMonth, monthOf } from './model';

describe('makeHistoryMock', () => {
  it.each([
    { when: '달 첫날', today: new Date(2026, 8, 1) },
    { when: '달 말', today: new Date(2026, 8, 28) },
    { when: '새해 첫날', today: new Date(2027, 0, 1) },
  ])(
    '$when에 열어도 이번 달에 완료 작업이 있고 오늘 뒤의 날짜는 없다',
    ({ today }) => {
      const works = makeHistoryMock(today);

      expect(completedInMonth(works, monthOf(today)).length).toBeGreaterThan(0);
      expect(works.every(work => work.dateKey <= toDateKey(today))).toBe(true);
    },
  );

  it('완료 작업이 없는 지난 달도 있어 빈 상태를 볼 수 있다', () => {
    const today = new Date(2026, 8, 28);
    const works = makeHistoryMock(today);

    expect(completedInMonth(works, { year: 2026, month: 5 })).toEqual([]);
  });

  it('작업 id 는 겹치지 않는다', () => {
    const works = makeHistoryMock(new Date(2026, 8, 28));

    expect(new Set(works.map(work => work.id)).size).toBe(works.length);
  });
});
