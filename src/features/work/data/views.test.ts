import { MissingAssignmentError } from './errors';
import {
  acceptCommandOf,
  confirmedOf,
  homeWeekLabel,
  monthPeriod,
  nextCurrentWorkChange,
  pendingOf,
  pickCurrentWork,
  toCompletedWork,
  toCurrentWork,
  toScheduleItem,
  weekPeriod,
} from './views';
import type { HistoryWork, ScheduledWork } from './types';

// 테스트는 서울 시간대(UTC+9)로 돈다 (jest/globalSetup.js)

const scheduled = (overrides: Partial<ScheduledWork> = {}): ScheduledWork => ({
  workId: 1,
  name: '보일러 점검',
  status: 'ACCEPTED',
  assignmentNumber: 1,
  // 서울 2026-10-21(수) 11:00~12:00
  startTime: '2026-10-21T02:00:00Z',
  endTime: '2026-10-21T03:00:00Z',
  customerAddress: '서울 송파구 올림픽로 88',
  customerAddressDetail: '2층',
  delayed: false,
  customerName: '이수연',
  organizationName: '한빛 설비',
  ...overrides,
});

describe('조회 구간', () => {
  it('weekPeriod: 그 날이 속한 주 월요일 0시부터 다음 월요일 0시까지 (현지)', () => {
    expect(weekPeriod(new Date(2026, 9, 25, 15, 30))).toEqual({
      from: new Date(2026, 9, 19).toISOString(),
      to: new Date(2026, 9, 26).toISOString(),
    });
  });

  it('monthPeriod: 그 달 1일 0시부터 다음 달 1일 0시까지', () => {
    expect(monthPeriod({ year: 2026, month: 11 })).toEqual({
      from: new Date(2026, 11, 1).toISOString(),
      to: new Date(2027, 0, 1).toISOString(),
    });
  });

  it('homeWeekLabel: 월~일 (예: 10. 19. – 10. 25.)', () => {
    expect(homeWeekLabel(new Date(2026, 9, 21))).toBe('10. 19. – 10. 25.');
  });
});

// #205 히어로 박스는 지금 시각에 진행 중인 작업만 보인다
describe('pickCurrentWork', () => {
  // 서울 2026-11-18(수) 19:00~20:00 작업전
  const evening = scheduled({
    workId: 7,
    startTime: '2026-11-18T10:00:00Z',
    endTime: '2026-11-18T11:00:00Z',
  });
  const at = (hour: number, minute: number, ms = 0) =>
    new Date(2026, 10, 18, hour, minute, 0, ms);

  it('18:40 에는 같은 날 19:00 에 시작하는 작업전이 있어도 없다 (메인화면 - 진행(무))', () => {
    expect(pickCurrentWork([evening], at(18, 40))).toBeUndefined();
  });

  it('예정 시작 10분 전(서버가 시작을 받기 시작하는 때)이어도 아직 진행 중이 아니다', () => {
    expect(pickCurrentWork([evening], at(18, 50))).toBeUndefined();
  });

  it('19:00 이 되면 그 작업이다', () => {
    expect(pickCurrentWork([evening], at(19, 0))?.workId).toBe(7);
  });

  it('예정 종료 시각까지는 그 작업이고, 지나면 없다', () => {
    expect(pickCurrentWork([evening], at(20, 0))?.workId).toBe(7);
    expect(pickCurrentWork([evening], at(20, 0, 1))).toBeUndefined();
  });

  it('작업중인 작업이 먼저이고, 시작 전이든 예정 종료가 지났든 완료 보고 전까지 남는다', () => {
    const started = scheduled({
      workId: 2,
      status: 'IN_PROGRESS',
      startTime: '2026-11-18T01:00:00Z',
      endTime: '2026-11-18T02:00:00Z',
    });

    expect(pickCurrentWork([evening, started], at(19, 30))?.workId).toBe(2);
    expect(pickCurrentWork([started], at(18, 40))?.workId).toBe(2);
  });

  it('진행 중인 작업전이 여럿이면 가장 이른 것, 응답 전·완료 작업은 고르지 않는다', () => {
    const works = [
      scheduled({
        workId: 1,
        status: 'PENDING_ACCEPT',
        startTime: '2026-11-18T09:00:00Z',
        endTime: '2026-11-18T12:00:00Z',
      }),
      scheduled({
        workId: 2,
        status: 'COMPLETED',
        startTime: '2026-11-18T09:00:00Z',
        endTime: '2026-11-18T12:00:00Z',
      }),
      evening,
      scheduled({
        workId: 3,
        startTime: '2026-11-18T09:30:00Z',
        endTime: '2026-11-18T10:30:00Z',
      }),
    ];

    expect(pickCurrentWork(works, at(19, 10))?.workId).toBe(3);
  });
});

describe('nextCurrentWorkChange', () => {
  const evening = scheduled({
    workId: 7,
    startTime: '2026-11-18T10:00:00Z',
    endTime: '2026-11-18T11:00:00Z',
  });
  const at = (hour: number, minute: number) =>
    new Date(2026, 10, 18, hour, minute).getTime();

  it('시작 전이면 예정 시작 시각이다 (18:40 → 19:00)', () => {
    expect(nextCurrentWorkChange([evening], at(18, 40))).toBe(at(19, 0));
  });

  it('진행 중이면 예정 종료 바로 뒤다', () => {
    expect(nextCurrentWorkChange([evening], at(19, 0))).toBe(at(20, 0) + 1);
  });

  it('여러 작업 중 가장 이른 경계다', () => {
    const later = scheduled({
      workId: 8,
      startTime: '2026-11-18T10:30:00Z',
      endTime: '2026-11-18T12:00:00Z',
    });

    expect(nextCurrentWorkChange([later, evening], at(19, 10))).toBe(
      at(19, 30),
    );
  });

  it('작업중인 작업이 있으면 시각으로는 바뀌지 않아 없다', () => {
    const started = scheduled({ workId: 2, status: 'IN_PROGRESS' });

    expect(nextCurrentWorkChange([evening, started], at(18, 40))).toBe(
      undefined,
    );
  });

  it('남은 경계가 없으면(모두 끝났거나 작업전이 아니면) 없다', () => {
    const pending = scheduled({
      workId: 3,
      status: 'PENDING_ACCEPT',
      startTime: '2026-11-18T12:00:00Z',
      endTime: '2026-11-18T13:00:00Z',
    });

    expect(nextCurrentWorkChange([evening, pending], at(21, 0))).toBe(
      undefined,
    );
  });
});

describe('화면 행으로', () => {
  const today = new Date(2026, 9, 21);

  it('진행할 작업 카드', () => {
    expect(toCurrentWork(scheduled())).toEqual({
      id: '1',
      title: '보일러 점검',
      timeRange: '11:00 - 12:00',
      customerName: '이수연',
      address: '서울 송파구 올림픽로 88 2층',
    });
  });

  it('이번 주 일정 카드: 오늘이면 "오늘 · " 을 붙인다', () => {
    expect(toScheduleItem(scheduled(), today)).toEqual({
      id: '1',
      dateKey: '2026-10-21',
      title: '보일러 점검',
      status: 'beforeWork',
      timeRange: '11:00 - 12:00',
      dayLabel: '오늘 · 10. 21. (수)',
      company: '한빛 설비',
      customerName: '이수연',
      address: '서울 송파구 올림픽로 88 2층',
    });
    expect(
      toScheduleItem(
        scheduled({
          startTime: '2026-10-22T02:00:00Z',
          endTime: '2026-10-22T03:00:00Z',
        }),
        today,
      ).dayLabel,
    ).toBe('10. 22. (목)');
  });

  it('비어 있는 고객·주소·발주사는 "-"', () => {
    expect(
      toScheduleItem(
        scheduled({
          customerName: null,
          customerAddress: null,
          customerAddressDetail: null,
          organizationName: null,
        }),
        today,
      ),
    ).toMatchObject({ customerName: '-', address: '-', company: '-' });
  });

  it('지연된 작업은 지연 칩이다', () => {
    expect(toScheduleItem(scheduled({ delayed: true }), today).status).toBe(
      'delayed',
    );
  });

  it('확정 일정은 수락 뒤(작업전·작업중·완료), 응답 필요는 수락 대기다', () => {
    const works = [
      scheduled({ workId: 1, status: 'PENDING_ACCEPT' }),
      scheduled({ workId: 2, status: 'ACCEPTED' }),
      scheduled({ workId: 3, status: 'IN_PROGRESS' }),
      scheduled({ workId: 4, status: 'COMPLETED' }),
    ];

    expect(confirmedOf(works).map(item => item.id)).toEqual(['2', '3', '4']);
    expect(pendingOf(works)).toEqual([
      {
        id: '1',
        dateKey: '2026-10-21',
        title: '보일러 점검',
        status: 'assigned',
        timeRange: '11:00 - 12:00',
        company: '한빛 설비',
        customerName: '이수연',
        address: '서울 송파구 올림픽로 88 2층',
      },
    ]);
  });

  it('여러 달 조회에 같은 작업이 겹쳐 와도 한 번만 둔다', () => {
    expect(confirmedOf([scheduled(), scheduled()])).toHaveLength(1);
  });

  it('완료 작업 행', () => {
    const work: HistoryWork = {
      workId: 9,
      name: '에어컨 청소',
      status: 'COMPLETED',
      current: true,
      assignmentNumber: 1,
      startTime: '2026-10-21T04:00:00Z',
      endTime: '2026-10-21T05:00:00Z',
      result: 'ACCEPTED',
      endReason: null,
      customerName: '정다은',
      customerAddress: '서울 용산구 이태원로 202',
      customerAddressDetail: null,
      organizationName: '한빛 설비',
    };

    expect(toCompletedWork(work)).toEqual({
      id: '9',
      title: '에어컨 청소',
      dateKey: '2026-10-21',
      start: '13:00',
      end: '14:00',
      company: '한빛 설비',
      customerName: '정다은',
      address: '서울 용산구 이태원로 202',
    });
  });
});

describe('acceptCommandOf', () => {
  it('응답 필요 목록의 요청이면 그 작업 id 와 지금 배정 순번으로 수락 Command 를 만든다', () => {
    expect(
      acceptCommandOf(
        [
          scheduled({
            workId: 7,
            status: 'PENDING_ACCEPT',
            assignmentNumber: 3,
          }),
        ],
        '7',
      ),
    ).toEqual({ workId: 7, assignmentNumber: 3 });
  });

  // 화면이 들고 있던 목록과 그사이 바뀐 목록이 어긋난 경우 (이미 처리된 요청)
  it('목록에 없는 요청이면 배정 순번을 몰라 볼 수 없는 작업 오류다', () => {
    expect(() =>
      acceptCommandOf(
        [scheduled({ workId: 7, status: 'PENDING_ACCEPT' })],
        '8',
      ),
    ).toThrow(MissingAssignmentError);
  });
});
