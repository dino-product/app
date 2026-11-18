import { workDetail } from '../mockData';
import {
  detailWithResponses,
  pendingWithResponses,
  scheduleWithResponses,
  type RespondingWork,
} from './responding';
import type { MySchedule, ScheduledWork } from './types';

const row = (
  workId: number,
  startTime: string,
  overrides: Partial<ScheduledWork> = {},
): ScheduledWork => ({
  workId,
  name: `작업 ${workId}`,
  status: 'ACCEPTED',
  assignmentNumber: 1,
  startTime,
  endTime: startTime.replace('T00', 'T01'),
  customerAddress: null,
  customerAddressDetail: null,
  delayed: false,
  customerName: null,
  organizationName: null,
  ...overrides,
});
const request = (workId: number, startTime: string) =>
  row(workId, startTime, { status: 'PENDING_ACCEPT' });
const week = { from: '2026-10-18T15:00:00Z', to: '2026-10-25T15:00:00Z' };
const ids = (schedule: MySchedule) => schedule.works.map(work => work.workId);

describe('응답 필요에 얹기', () => {
  const pending: MySchedule = {
    works: [
      request(10, '2026-10-21T00:00:00Z'),
      request(11, '2026-10-22T00:00:00Z'),
    ],
  };

  it('보내는 응답이 없으면 받은 값 그대로다 (같은 객체)', () => {
    expect(pendingWithResponses(pending, [])).toBe(pending);
  });

  it('수락·거절을 보낸 요청은 빠진다', () => {
    const responses: RespondingWork[] = [
      { kind: 'accept', workId: 10 },
      { kind: 'reject', workId: 11 },
    ];
    expect(ids(pendingWithResponses(pending, responses))).toEqual([]);
  });

  it('목록에 없는 요청의 응답이면 받은 값 그대로다', () => {
    expect(
      pendingWithResponses(pending, [{ kind: 'accept', workId: 99 }]),
    ).toBe(pending);
  });
});

describe('내 일정에 얹기', () => {
  const schedule: MySchedule = {
    works: [
      request(10, '2026-10-21T00:00:00Z'),
      row(12, '2026-10-22T00:00:00Z'),
    ],
  };

  it('보내는 응답이 없으면 받은 값 그대로다 (같은 객체)', () => {
    expect(scheduleWithResponses(schedule, week, [])).toBe(schedule);
  });

  it('수락을 보낸 요청이 있으면 작업전(수락됨)이 된다', () => {
    const result = scheduleWithResponses(schedule, week, [
      { kind: 'accept', workId: 10 },
    ]);
    expect(result.works.map(work => [work.workId, work.status])).toEqual([
      [10, 'ACCEPTED'],
      [12, 'ACCEPTED'],
    ]);
  });

  it('없으면(운영 API) 응답 필요의 행을 겹치는 구간에만 시작 시각·작업 id 순으로 넣는다', () => {
    const accepted = (workId: number, startTime: string): RespondingWork => ({
      kind: 'accept',
      workId,
      request: request(workId, startTime),
    });
    const onlyConfirmed: MySchedule = {
      works: [row(12, '2026-10-22T00:00:00Z')],
    };

    const result = scheduleWithResponses(onlyConfirmed, week, [
      accepted(13, '2026-10-22T00:00:00Z'),
      accepted(9, '2026-10-21T00:00:00Z'),
      accepted(14, '2026-11-02T00:00:00Z'),
    ]);

    expect(result.works.map(work => [work.workId, work.status])).toEqual([
      [9, 'ACCEPTED'],
      [12, 'ACCEPTED'],
      [13, 'ACCEPTED'],
    ]);
  });

  it('거절을 보낸 요청은 빠진다', () => {
    expect(
      ids(
        scheduleWithResponses(schedule, week, [{ kind: 'reject', workId: 10 }]),
      ),
    ).toEqual([12]);
  });
});

describe('상세에 얹기', () => {
  const assigned = {
    ...workDetail,
    id: '10',
    status: 'assigned' as const,
    workStatus: 'PENDING_ACCEPT' as const,
  };

  it('수락을 보낸 작업은 작업전(수락됨)이다', () => {
    expect(
      detailWithResponses(assigned, 10, [{ kind: 'accept', workId: 10 }]),
    ).toMatchObject({ status: 'beforeWork', workStatus: 'ACCEPTED' });
  });

  it('지연 칩은 그대로 둔다', () => {
    expect(
      detailWithResponses({ ...assigned, status: 'delayed' }, 10, [
        { kind: 'accept', workId: 10 },
      ]),
    ).toMatchObject({ status: 'delayed', workStatus: 'ACCEPTED' });
  });

  it('다른 작업의 응답이나 거절이면 받은 값 그대로다', () => {
    expect(
      detailWithResponses(assigned, 10, [
        { kind: 'accept', workId: 11 },
        { kind: 'reject', workId: 10 },
      ]),
    ).toBe(assigned);
  });
});
