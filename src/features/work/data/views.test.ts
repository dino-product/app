import { MissingAssignmentError } from './errors';
import {
  acceptCommandOf,
  confirmedOf,
  homeWeekLabel,
  monthPeriod,
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

describe('pickCurrentWork', () => {
  const now = new Date(2026, 9, 21, 10, 55);

  it('작업중인 작업이 먼저다', () => {
    const works = [
      scheduled({ workId: 1 }),
      scheduled({
        workId: 2,
        status: 'IN_PROGRESS',
        startTime: '2026-10-20T02:00:00Z',
      }),
    ];

    expect(pickCurrentWork(works, now)?.workId).toBe(2);
  });

  it('없으면 오늘 아직 끝나지 않은 작업전 중 가장 이른 것', () => {
    const works = [
      // 오늘 이미 끝남
      scheduled({
        workId: 1,
        startTime: '2026-10-20T23:00:00Z',
        endTime: '2026-10-21T00:00:00Z',
      }),
      scheduled({
        workId: 2,
        startTime: '2026-10-21T05:00:00Z',
        endTime: '2026-10-21T06:00:00Z',
      }),
      scheduled({ workId: 3 }),
      // 내일
      scheduled({
        workId: 4,
        startTime: '2026-10-22T00:00:00Z',
        endTime: '2026-10-22T01:00:00Z',
      }),
      // 응답 전·완료
      scheduled({ workId: 5, status: 'PENDING_ACCEPT' }),
      scheduled({ workId: 6, status: 'COMPLETED' }),
    ];

    expect(pickCurrentWork(works, now)?.workId).toBe(3);
  });

  it('오늘 할 작업이 없으면 없다', () => {
    expect(
      pickCurrentWork(
        [
          scheduled({
            startTime: '2026-10-22T00:00:00Z',
            endTime: '2026-10-22T01:00:00Z',
          }),
        ],
        now,
      ),
    ).toBeUndefined();
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
