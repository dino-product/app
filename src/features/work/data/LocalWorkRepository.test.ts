import { isApiError } from '../../../shared/api';
import { createLocalWorkRepository } from './LocalWorkRepository';
import { LOCAL_ORGANIZATION_NAME, makeLocalSeed } from './localSeed';
import { workDetailResponse } from './testing';
import type {
  AssignmentResponse,
  SubmitCompletionReportCommand,
  WorkDetailResponse,
  WorkStatusCode,
} from './types';

const MINUTE = 60 * 1000;
const at = (iso: string) => new Date(iso);

// 예정 2026-10-21 09:00~11:00 (서울) = 00:00Z~02:00Z
const START = '2026-10-21T00:00:00Z';
const END = '2026-10-21T02:00:00Z';

function work(
  workId: number,
  status: WorkStatusCode,
  {
    start = START,
    end = END,
    result = status === 'PENDING_ACCEPT' ? 'PENDING' : 'ACCEPTED',
    ...overrides
  }: Partial<WorkDetailResponse> & {
    start?: string;
    end?: string;
    result?: AssignmentResponse['result'];
  } = {},
): WorkDetailResponse {
  const base = workDetailResponse();
  const schedule = {
    ...base.schedule!,
    startTime: start,
    endTime: end,
  };
  return workDetailResponse({
    workId,
    name: `작업 ${workId}`,
    status,
    schedule,
    assignments: [{ ...base.assignments[0], schedule, result }],
    ...overrides,
  });
}

function setup(seed: WorkDetailResponse[], now = at('2026-10-21T00:00:00Z')) {
  const clock = { now };
  const repository = createLocalWorkRepository({
    seed,
    now: () => clock.now,
  });
  return { repository, clock };
}

const week = { from: '2026-10-18T15:00:00Z', to: '2026-10-25T15:00:00Z' };

const errorOf = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('성공하면 안 된다');
    },
    (error: unknown) => error,
  );

async function expectCode(
  promise: Promise<unknown>,
  status: number,
  code: string,
) {
  const error = await errorOf(promise);
  expect(isApiError(error, code)).toBe(true);
  expect(error).toMatchObject({ kind: 'http', status });
}

describe('LocalWorkRepository 내 일정', () => {
  it('구간과 겹치는 본인 작업(수락대기·수락됨·작업중·완료)을 시작 시각 순으로 준다', async () => {
    const { repository } = setup([
      work(3, 'ACCEPTED', {
        start: '2026-10-22T00:00:00Z',
        end: '2026-10-22T01:00:00Z',
      }),
      work(1, 'PENDING_ACCEPT'),
      work(2, 'IN_PROGRESS'),
      work(4, 'COMPLETED', {
        start: '2026-10-19T00:00:00Z',
        end: '2026-10-19T01:00:00Z',
      }),
      work(5, 'REGISTERED'),
      work(6, 'CANCELED'),
      // 구간 밖
      work(7, 'ACCEPTED', {
        start: '2026-11-01T00:00:00Z',
        end: '2026-11-01T01:00:00Z',
      }),
    ]);

    const { works } = await repository.getMySchedule(week);

    expect(works.map(item => item.workId)).toEqual([4, 1, 2, 3]);
    expect(works[1]).toEqual({
      workId: 1,
      name: '작업 1',
      status: 'PENDING_ACCEPT',
      assignmentNumber: 1,
      startTime: START,
      endTime: END,
      customerAddress: '서울시 마포구 양화로 45',
      customerAddressDetail: '3층 302호',
      delayed: false,
      customerName: '이정호',
      organizationName: LOCAL_ORGANIZATION_NAME,
    });
  });

  it('조회 시각에 예정 종료가 지났는데 끝나지 않았으면 지연이다', async () => {
    const { repository } = setup(
      [
        work(1, 'ACCEPTED'),
        work(2, 'COMPLETED', { completedAt: '2026-10-21T01:00:00Z' }),
      ],
      at(END),
    );

    const { works } = await repository.getMySchedule(week);

    expect(works.map(item => [item.workId, item.delayed])).toEqual([
      [1, true],
      [2, false],
    ]);
  });

  it.each([
    [
      '31일을 넘는 구간',
      { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:01Z' },
    ],
    ['끝이 시작보다 이르거나 같은 구간', { from: START, to: START }],
  ])('%s 은 SCHEDULE-003 이다', async (_, period) => {
    const { repository } = setup([]);

    await expectCode(repository.getMySchedule(period), 400, 'SCHEDULE-003');
  });
});

describe('LocalWorkRepository 작업 상세', () => {
  it('화면 모델로 준다', async () => {
    const { repository } = setup([work(1, 'ACCEPTED')]);

    await expect(repository.getWorkDetail(1)).resolves.toMatchObject({
      id: '1',
      status: 'beforeWork',
      assignmentNumber: 1,
    });
  });

  it('없는 작업은 SCHEDULE-001(404) 이다', async () => {
    const { repository } = setup([work(1, 'ACCEPTED')]);

    await expectCode(repository.getWorkDetail(99), 404, 'SCHEDULE-001');
  });
});

describe('LocalWorkRepository 수락', () => {
  it('배정됨 → 작업전', async () => {
    const { repository } = setup([work(1, 'PENDING_ACCEPT')]);

    await repository.acceptWork({ workId: 1, assignmentNumber: 1 });

    expect((await repository.getWorkDetail(1)).status).toBe('beforeWork');
    expect((await repository.getMySchedule(week)).works[0].status).toBe(
      'ACCEPTED',
    );
  });

  it('같은 배정에 다시 보내면 바꾸지 않고 성공한다 (이미 시작한 작업도)', async () => {
    const { repository } = setup([
      work(1, 'PENDING_ACCEPT'),
      work(2, 'IN_PROGRESS'),
    ]);

    await repository.acceptWork({ workId: 1, assignmentNumber: 1 });
    await repository.acceptWork({ workId: 1, assignmentNumber: 1 });
    await repository.acceptWork({ workId: 2, assignmentNumber: 1 });

    expect((await repository.getWorkDetail(2)).status).toBe('inProgress');
  });

  it('그 순번의 배정이 없으면 SCHEDULE-009, 지난 배정이면 SCHEDULE-010', async () => {
    const base = work(1, 'PENDING_ACCEPT');
    const { repository } = setup([
      {
        ...base,
        assignments: [
          { ...base.assignments[0], assignmentNumber: 1, result: 'WITHDRAWN' },
          { ...base.assignments[0], assignmentNumber: 2 },
        ],
      },
    ]);

    await expectCode(
      repository.acceptWork({ workId: 1, assignmentNumber: 3 }),
      403,
      'SCHEDULE-009',
    );
    await expectCode(
      repository.acceptWork({ workId: 1, assignmentNumber: 1 }),
      409,
      'SCHEDULE-010',
    );
    await expectCode(
      repository.acceptWork({ workId: 1, assignmentNumber: 0 }),
      400,
      'SCHEDULE-003',
    );
  });

  it('없는 작업은 SCHEDULE-001', async () => {
    const { repository } = setup([]);

    await expectCode(
      repository.acceptWork({ workId: 1, assignmentNumber: 1 }),
      404,
      'SCHEDULE-001',
    );
  });
});

describe('LocalWorkRepository 거절', () => {
  it('배정됨 → 대기함으로 돌아가 목록·상세에서 사라지고, 다시 보내면 SCHEDULE-001', async () => {
    const { repository } = setup([work(1, 'PENDING_ACCEPT')]);
    const command = {
      workId: 1,
      assignmentNumber: 1,
      reason: 'SCHEDULE_CONFLICT' as const,
      note: null,
    };

    await repository.rejectWork(command);

    expect((await repository.getMySchedule(week)).works).toEqual([]);
    await expectCode(repository.getWorkDetail(1), 404, 'SCHEDULE-001');
    await expectCode(repository.rejectWork(command), 404, 'SCHEDULE-001');
  });

  it('기타는 메모와 함께 받는다', async () => {
    const { repository } = setup([work(1, 'PENDING_ACCEPT')]);

    await repository.rejectWork({
      workId: 1,
      assignmentNumber: 1,
      reason: 'OTHER',
      note: 'x'.repeat(255),
    });

    expect((await repository.getMySchedule(week)).works).toEqual([]);
  });

  it.each([
    ['기타인데 메모가 없음', 'OTHER', null],
    ['기타인데 메모가 공백뿐', 'OTHER', '   '],
    ['기타 메모가 255자를 넘음', 'OTHER', 'x'.repeat(256)],
    ['기타가 아닌데 메모를 보냄', 'LOCATION_TOO_FAR', '멀어요'],
  ] as const)('%s 이면 SCHEDULE-003', async (_, reason, note) => {
    const { repository } = setup([work(1, 'PENDING_ACCEPT')]);

    await expectCode(
      repository.rejectWork({ workId: 1, assignmentNumber: 1, reason, note }),
      400,
      'SCHEDULE-003',
    );
    expect((await repository.getMySchedule(week)).works).toHaveLength(1);
  });

  it('이미 수락한 작업은 SCHEDULE-002', async () => {
    const { repository } = setup([work(1, 'ACCEPTED')]);

    await expectCode(
      repository.rejectWork({
        workId: 1,
        assignmentNumber: 1,
        reason: 'SCOPE_MISMATCH',
        note: null,
      }),
      409,
      'SCHEDULE-002',
    );
  });
});

describe('LocalWorkRepository 시작', () => {
  const start = (repository: ReturnType<typeof setup>['repository']) =>
    repository.startWork({ workId: 1, assignmentNumber: 1 });

  it('예정 시작 10분 전부터 시작할 수 있다 → 작업중', async () => {
    const { repository } = setup(
      [work(1, 'ACCEPTED')],
      new Date(Date.parse(START) - 10 * MINUTE),
    );

    await start(repository);

    expect((await repository.getWorkDetail(1)).status).toBe('inProgress');
  });

  it('예정 종료 정각까지 시작할 수 있다', async () => {
    const { repository } = setup([work(1, 'ACCEPTED')], at(END));

    await start(repository);

    expect((await repository.getMySchedule(week)).works[0].status).toBe(
      'IN_PROGRESS',
    );
  });

  it('10분 전보다 이르면 SCHEDULE-017 이고 상태는 그대로다', async () => {
    const { repository } = setup(
      [work(1, 'ACCEPTED')],
      new Date(Date.parse(START) - 10 * MINUTE - 1),
    );

    await expectCode(start(repository), 409, 'SCHEDULE-017');
    expect((await repository.getWorkDetail(1)).status).toBe('beforeWork');
  });

  it('예정 종료가 지났으면 SCHEDULE-018', async () => {
    const { repository } = setup(
      [work(1, 'ACCEPTED')],
      new Date(Date.parse(END) + 1),
    );

    await expectCode(start(repository), 409, 'SCHEDULE-018');
  });

  it('수락 전이면 SCHEDULE-002, 이미 시작했으면 다시 보내도 성공한다', async () => {
    const { repository } = setup([
      work(1, 'PENDING_ACCEPT'),
      work(2, 'IN_PROGRESS', { startedAt: START }),
    ]);

    await expectCode(start(repository), 409, 'SCHEDULE-002');
    await expect(
      repository.startWork({ workId: 2, assignmentNumber: 1 }),
    ).resolves.toBeUndefined();
  });

  it('시작 시각을 남긴다 (다시 시작해도 바뀌지 않는다)', async () => {
    const { repository, clock } = setup([work(1, 'ACCEPTED')], at(START));

    await start(repository);
    clock.now = new Date(Date.parse(START) + 5 * MINUTE);
    await start(repository);
    const submit: SubmitCompletionReportCommand = {
      workId: 1,
      assignmentNumber: 1,
      beforePhotos: ['b'],
      afterPhotos: ['a'],
      usedParts: null,
      workNote: null,
      actualFee: 0,
      actualPaymentMethod: 'CASH',
    };
    await repository.submitCompletionReport(submit);

    // 완료 보고의 제출 시각은 지금 시각이다
    expect((await repository.getWorkDetail(1)).submission?.submittedAt).toBe(
      '2026-10-21 09:05',
    );
  });
});

describe('LocalWorkRepository 완료 보고', () => {
  const report: SubmitCompletionReportCommand = {
    workId: 1,
    assignmentNumber: 1,
    beforePhotos: ['file://b1.jpg'],
    afterPhotos: ['file://a1.jpg'],
    usedParts: '배관 1개',
    workNote: '교체 완료',
    actualFee: 120000,
    actualPaymentMethod: 'CREDIT_CARD',
  };

  it('작업중 → 완료, 제출 내용이 상세에 남고 이력에 더해진다', async () => {
    const { repository } = setup(
      [work(1, 'IN_PROGRESS', { startedAt: START })],
      at('2026-10-21T01:30:00Z'),
    );

    await repository.submitCompletionReport(report);

    const detail = await repository.getWorkDetail(1);
    expect(detail.status).toBe('completed');
    expect(detail.submission).toEqual({
      submittedAt: '2026-10-21 10:30',
      report: {
        beforePhotos: ['file://b1.jpg'],
        afterPhotos: ['file://a1.jpg'],
        memo: '교체 완료',
        parts: '배관 1개',
        amount: '120000',
        paymentMethod: 'card',
      },
    });
    const history = await repository.getWorkHistory(week);
    expect(history.works.map(item => item.workId)).toEqual([1]);
    expect(history.totalCompleted).toBe(1);
  });

  it('같은 내용을 다시 보내면 성공하고, 다른 내용이면 SCHEDULE-002', async () => {
    const { repository } = setup([
      work(1, 'IN_PROGRESS', { startedAt: START }),
    ]);

    await repository.submitCompletionReport(report);
    await repository.submitCompletionReport(report);

    await expectCode(
      repository.submitCompletionReport({ ...report, actualFee: 1 }),
      409,
      'SCHEDULE-002',
    );
  });

  it('시작하지 않은 작업은 SCHEDULE-002', async () => {
    const { repository } = setup([work(1, 'ACCEPTED')]);

    await expectCode(
      repository.submitCompletionReport(report),
      409,
      'SCHEDULE-002',
    );
  });

  it.each<[string, Partial<SubmitCompletionReportCommand>]>([
    ['작업 전 사진이 6장을 넘음', { beforePhotos: Array(7).fill('p') }],
    ['작업 후 사진이 6장을 넘음', { afterPhotos: Array(7).fill('p') }],
    ['수행 메모가 255자를 넘음', { workNote: 'x'.repeat(256) }],
    ['사용 부품이 255자를 넘음', { usedParts: 'x'.repeat(256) }],
    ['금액이 음수', { actualFee: -1 }],
  ])('%s 이면 SCHEDULE-003', async (_, patch) => {
    const { repository } = setup([
      work(1, 'IN_PROGRESS', { startedAt: START }),
    ]);

    await expectCode(
      repository.submitCompletionReport({ ...report, ...patch }),
      400,
      'SCHEDULE-003',
    );
    expect((await repository.getWorkDetail(1)).status).toBe('inProgress');
  });
});

describe('LocalWorkRepository 작업 이력', () => {
  it('구간과 겹치는 완료 작업을 최근 먼저 주고, 구간 통계와 누적 완료 수를 센다', async () => {
    const day = (n: number) => ({
      start: `2026-10-${n}T00:00:00Z`,
      end: `2026-10-${n}T01:00:00Z`,
      completedAt: `2026-10-${n}T00:50:00Z`,
    });
    const { repository } = setup([
      work(1, 'COMPLETED', day(19)),
      work(2, 'COMPLETED', day(22)),
      work(3, 'ACCEPTED', day(20)),
      work(4, 'COMPLETED', day(11)),
    ]);

    const history = await repository.getWorkHistory(week);

    expect(history.works.map(item => item.workId)).toEqual([2, 1]);
    expect(history.works[0]).toEqual({
      workId: 2,
      name: '작업 2',
      status: 'COMPLETED',
      current: true,
      assignmentNumber: 1,
      startTime: '2026-10-22T00:00:00Z',
      endTime: '2026-10-22T01:00:00Z',
      result: 'ACCEPTED',
      endReason: null,
      customerName: '이정호',
      customerAddress: '서울시 마포구 양화로 45',
      customerAddressDetail: '3층 302호',
      organizationName: LOCAL_ORGANIZATION_NAME,
    });
    expect(history.statistics).toEqual({
      assigned: 2,
      completed: 2,
      rejected: 0,
      cancelled: 0,
    });
    expect(history.totalCompleted).toBe(3);
  });

  it('구간이 31일을 넘으면 SCHEDULE-003', async () => {
    const { repository } = setup([]);

    await expectCode(
      repository.getWorkHistory({
        from: '2026-09-01T00:00:00Z',
        to: '2026-10-15T00:00:00Z',
      }),
      400,
      'SCHEDULE-003',
    );
  });
});

describe('LocalWorkRepository.reset', () => {
  it('처음 데이터로 돌아간다', async () => {
    const { repository } = setup([work(1, 'PENDING_ACCEPT')]);
    await repository.acceptWork({ workId: 1, assignmentNumber: 1 });

    repository.reset();

    expect((await repository.getWorkDetail(1)).status).toBe('assigned');
  });

  it('돌려준 값을 바꿔도 저장된 상태는 그대로다', async () => {
    const { repository } = setup([work(1, 'PENDING_ACCEPT')]);

    (await repository.getMySchedule(week)).works[0].status = 'COMPLETED';

    expect((await repository.getMySchedule(week)).works[0].status).toBe(
      'PENDING_ACCEPT',
    );
  });
});

describe('makeLocalSeed', () => {
  const now = new Date(2026, 9, 21, 14, 37);
  const seed = makeLocalSeed(now);
  const repository = createLocalWorkRepository({ seed, now: () => now });

  it('작업 id 가 겹치지 않는다', () => {
    const ids = seed.map(item => item.workId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('오늘 진행할 작업(보일러 점검)은 지금 시작할 수 있다', async () => {
    const boiler = seed.find(item => item.name === '보일러 점검');

    await repository.startWork({
      workId: boiler!.workId,
      assignmentNumber: 1,
    });

    expect((await repository.getWorkDetail(boiler!.workId)).status).toBe(
      'inProgress',
    );
  });

  it('응답 필요 요청 셋(내일 하나, 닷새 뒤 둘)과 완료 이력이 있다', () => {
    expect(seed.filter(item => item.status === 'PENDING_ACCEPT')).toHaveLength(
      3,
    );
    expect(
      seed.filter(item => item.status === 'COMPLETED').length,
    ).toBeGreaterThan(10);
    // 완료 작업은 모두 지금보다 앞에 끝났다
    expect(
      seed
        .filter(item => item.status === 'COMPLETED')
        .every(item => Date.parse(item.completedAt!) <= now.getTime()),
    ).toBe(true);
  });
});
