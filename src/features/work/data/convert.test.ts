import { emptyReport, type WorkReport } from '../model';
import {
  toActualPaymentMethod,
  toAssignmentNumberRequest,
  toMySchedule,
  toPendingWorks,
  toRejectionReason,
  toRejectWorkRequest,
  toSubmitCommand,
  toSubmitReportRequest,
  toWorkDetail,
  toWorkHistory,
  workStatusChip,
} from './convert';
import type {
  AssignedWorkResponse,
  ScheduledWorkResponse,
  WorkDetailResponse,
  WorkHistoryResponse,
} from './types';

// 서버는 UTC 로 주고 화면은 기기 현지 시각이다. 테스트는 서울 시간대(UTC+9)로 돈다 (jest/globalSetup.js)

// api-spec.md S1 의 기사 시점 예시 (작업전)
const response = (
  overrides: Partial<WorkDetailResponse> = {},
): WorkDetailResponse => ({
  workId: 10,
  name: '배관 누수 점검 및 교체',
  status: 'ACCEPTED',
  delayed: false,
  workType: { id: 3, name: '배관', color: null },
  registrar: null,
  registeredAt: '2026-10-18T01:00:00Z',
  customer: {
    name: '이정호',
    phone: '010-1234-5678',
    postalCode: '04043',
    address: '서울시 마포구 양화로 45',
    addressDetail: '3층 302호',
  },
  payment: { fee: 120000, method: 'ON_SITE_CARD' },
  schedule: {
    technician: { technicianId: 12, name: '김민수', technicianType: null },
    startTime: '2026-10-21T00:00:00Z',
    expectedDurationMinutes: 120,
    endTime: '2026-10-21T02:00:00Z',
  },
  plannedSchedule: null,
  assignments: [
    {
      assignmentNumber: 2,
      schedule: {
        technician: { technicianId: 12, name: null, technicianType: null },
        startTime: '2026-10-21T00:00:00Z',
        expectedDurationMinutes: 120,
        endTime: '2026-10-21T02:00:00Z',
      },
      assignedAt: '2026-10-20T08:50:00Z',
      assignedBy: 5,
      result: 'ACCEPTED',
      decidedAt: '2026-10-20T09:02:00Z',
      rejectionReason: null,
      rejectionNote: null,
      endReason: null,
      endedAt: null,
      endedBy: null,
    },
  ],
  startedAt: null,
  completedAt: null,
  cancellation: null,
  completionReport: null,
  sitePhotos: [
    { photoId: 'abc123', url: 'fake-photo://abc123' },
    { photoId: 'def456', url: 'https://cdn.example.com/def456.jpg' },
  ],
  completionReportRequests: [],
  completionReportRequestable: false,
  version: 3,
  ...overrides,
});

describe('toWorkDetail', () => {
  it('작업 상세 응답을 화면 모델로 바꾼다', () => {
    expect(toWorkDetail(response())).toEqual({
      id: '10',
      title: '배관 누수 점검 및 교체',
      status: 'beforeWork',
      workStatus: 'ACCEPTED',
      registeredAt: '2026-10-18',
      date: '2026-10-21 (수)',
      timeRange: '오전 9:00 - 11:00',
      technician: '김민수',
      workType: '배관',
      customer: { name: '이정호', phone: '010-1234-5678' },
      address: '서울시 마포구 양화로 45 3층 302호',
      memo: '-',
      price: 120000,
      paymentMethod: 'card',
      requestImages: [
        'fake-photo://abc123',
        'https://cdn.example.com/def456.jpg',
      ],
      assignmentNumber: 2,
    });
  });

  it('시각은 UTC 를 기기 현지 시각으로 바꾼다 (UTC 날짜가 앞 날이어도 현지 날짜로)', () => {
    const work = toWorkDetail(
      response({
        registeredAt: '2026-10-17T16:00:00Z',
        schedule: {
          technician: null,
          startTime: '2026-10-20T15:30:00Z',
          expectedDurationMinutes: 60,
          endTime: '2026-10-20T16:30:00Z',
        },
      }),
    );

    // 2026-10-20T15:30Z 는 서울로 10월 21일 오전 0시 30분
    expect(work.date).toBe('2026-10-21 (수)');
    expect(work.timeRange).toBe('오전 12:30 - 1:30');
    expect(work.registeredAt).toBe('2026-10-18');
  });

  it('오전에서 오후로 넘어가는 시간은 끝 시각에도 오전·오후를 붙인다', () => {
    const work = toWorkDetail(
      response({
        schedule: {
          technician: null,
          startTime: '2026-10-21T02:30:00Z',
          expectedDurationMinutes: 240,
          endTime: '2026-10-21T06:30:00Z',
        },
      }),
    );

    expect(work.timeRange).toBe('오전 11:30 - 오후 3:30');
  });

  it.each<[WorkDetailResponse['status'], boolean, string]>([
    ['REGISTERED', false, 'registered'],
    ['PENDING_ACCEPT', false, 'assigned'],
    ['ACCEPTED', false, 'beforeWork'],
    ['IN_PROGRESS', false, 'inProgress'],
    ['COMPLETED', false, 'completed'],
    ['PENDING_ACCEPT', true, 'delayed'],
    ['ACCEPTED', true, 'delayed'],
    ['IN_PROGRESS', true, 'delayed'],
    // 늦게 완료한 작업도 완료로 보인다
    ['COMPLETED', true, 'completed'],
  ])('상태 %s (지연 %s) 는 %s 칩이다', (status, delayed, chip) => {
    const work = toWorkDetail(response({ status, delayed }));

    expect(work.status).toBe(chip);
    expect(work.statusLabel).toBeUndefined();
  });

  it('취소된 작업은 디자인 시스템에 취소 칩이 없어 거절 칩 색에 "취소" 로 보인다', () => {
    const work = toWorkDetail(response({ status: 'CANCELED', delayed: false }));

    expect(work.status).toBe('rejected');
    expect(work.statusLabel).toBe('취소');
  });

  it('비어 있는 값(작업유형·고객·결제·일정·기사 이름·배정)은 "-" 나 null 로 둔다', () => {
    const work = toWorkDetail(
      response({
        workType: null,
        customer: null,
        payment: null,
        schedule: null,
        assignments: [],
        sitePhotos: [],
      }),
    );

    expect(work).toMatchObject({
      workType: '-',
      customer: { name: '-', phone: '-' },
      address: '-',
      price: null,
      paymentMethod: null,
      date: '-',
      timeRange: '-',
      technician: '-',
      requestImages: [],
      assignmentNumber: null,
    });
  });

  it('dev 처럼 작업유형·기사 이름이 null 이거나 고객 항목 일부가 null 이어도 "-" 로 둔다', () => {
    const work = toWorkDetail(
      response({
        workType: { id: 3, name: null, color: null },
        customer: {
          name: null,
          phone: null,
          postalCode: null,
          address: '서울시 마포구 양화로 45',
          addressDetail: null,
        },
        payment: { fee: null, method: null },
        schedule: {
          technician: { technicianId: 12, name: null, technicianType: null },
          startTime: '2026-10-21T00:00:00Z',
          expectedDurationMinutes: 120,
          endTime: '2026-10-21T02:00:00Z',
        },
      }),
    );

    expect(work).toMatchObject({
      workType: '-',
      technician: '-',
      customer: { name: '-', phone: '-' },
      address: '서울시 마포구 양화로 45',
      price: null,
      paymentMethod: null,
    });
  });

  it.each([
    ['ON_SITE_CARD', 'card'],
    ['ON_SITE_CASH', 'cash'],
    ['BANK_TRANSFER', 'transfer'],
    ['INVOICE', 'invoice'],
  ] as const)('계획 결제 방식 %s 는 %s 다', (method, expected) => {
    expect(
      toWorkDetail(response({ payment: { fee: 1, method } })).paymentMethod,
    ).toBe(expected);
  });

  it('배정이 여럿이면 마지막(지금) 배정의 순번을 쓴다', () => {
    const [assignment] = response().assignments;

    const work = toWorkDetail(
      response({
        assignments: [
          { ...assignment, assignmentNumber: 1, result: 'WITHDRAWN' },
          { ...assignment, assignmentNumber: 3 },
        ],
      }),
    );

    expect(work.assignmentNumber).toBe(3);
  });

  it('완료 보고가 있으면 제출 내용과 현지 완료 시각을 읽기 전용 보고로 둔다', () => {
    const work = toWorkDetail(
      response({
        status: 'COMPLETED',
        completedAt: '2026-10-21T01:50:00Z',
        completionReport: {
          beforePhotos: [{ photoId: 'b1', url: 'fake-photo://b1' }],
          afterPhotos: [{ photoId: 'a1', url: 'fake-photo://a1' }],
          usedParts: '배관 1개',
          workNote: null,
          actualFee: 100000,
          actualPaymentMethod: 'CASH',
        },
      }),
    );

    expect(work.submission).toEqual({
      submittedAt: '2026-10-21 10:50',
      report: {
        beforePhotos: ['fake-photo://b1'],
        afterPhotos: ['fake-photo://a1'],
        memo: '',
        parts: '배관 1개',
        amount: '100000',
        paymentMethod: 'cash',
      },
    });
  });

  it('완료 보고의 비어 있는 금액·결제 방식은 빈 칸이다', () => {
    const work = toWorkDetail(
      response({
        status: 'COMPLETED',
        completedAt: null,
        completionReport: {
          beforePhotos: [],
          afterPhotos: [],
          usedParts: null,
          workNote: '확인',
          actualFee: null,
          actualPaymentMethod: null,
        },
      }),
    );

    expect(work.submission).toEqual({
      submittedAt: '-',
      report: { ...emptyReport, memo: '확인' },
    });
  });
});

describe('workStatusChip', () => {
  it('목록도 같은 칩을 쓴다', () => {
    expect(workStatusChip('PENDING_ACCEPT', false)).toEqual({
      status: 'assigned',
    });
    expect(workStatusChip('CANCELED', true)).toEqual({
      status: 'rejected',
      label: '취소',
    });
  });
});

describe('toActualPaymentMethod', () => {
  it.each([
    ['card', 'CREDIT_CARD'],
    ['cash', 'CASH'],
    ['transfer', 'BANK_TRANSFER'],
    ['invoice', 'INVOICE'],
  ] as const)('%s 는 %s 로 보낸다', (method, expected) => {
    expect(toActualPaymentMethod(method)).toBe(expected);
  });
});

describe('toRejectionReason', () => {
  it.each([
    ['schedule', 'SCHEDULE_CONFLICT'],
    ['otherWork', 'ALREADY_ASSIGNED'],
    ['distance', 'LOCATION_TOO_FAR'],
    ['mismatch', 'SCOPE_MISMATCH'],
    ['other', 'OTHER'],
  ] as const)('앱 사유 %s 는 %s 다', (key, reason) => {
    expect(toRejectionReason(key)).toBe(reason);
  });
});

describe('toSubmitCommand', () => {
  const report: WorkReport = {
    beforePhotos: ['file://b1.jpg'],
    afterPhotos: ['file://a1.jpg', 'file://a2.jpg'],
    memo: '  배관 교체 완료  ',
    parts: '   ',
    amount: '75000',
    paymentMethod: 'card',
  };

  it('완료 보고 입력을 제출 Command 로 바꾼다 (공백만 쓴 칸은 null, 앞뒤 공백은 뗀다)', () => {
    expect(toSubmitCommand(10, 2, report)).toEqual({
      workId: 10,
      assignmentNumber: 2,
      beforePhotos: ['file://b1.jpg'],
      afterPhotos: ['file://a1.jpg', 'file://a2.jpg'],
      usedParts: null,
      workNote: '배관 교체 완료',
      actualFee: 75000,
      actualPaymentMethod: 'CREDIT_CARD',
    });
  });

  it('금액·결제 방식이 비어 있으면 null 로 보낸다', () => {
    expect(
      toSubmitCommand(10, 2, { ...report, amount: '', paymentMethod: null }),
    ).toMatchObject({ actualFee: null, actualPaymentMethod: null });
  });
});

// 기사 작업 API (#155). 필드·enum 은 백엔드 웹 DTO(MyScheduleResponse·WorkHistoryResponse·*Request) 그대로다

// MyScheduleResponse.ScheduledWork 예시 (10/21 09:00~11:00 KST, 작업전)
const scheduled = (
  overrides: Partial<ScheduledWorkResponse> = {},
): ScheduledWorkResponse => ({
  workId: 10,
  name: '보일러 점검',
  status: 'ACCEPTED',
  assignmentNumber: 1,
  startTime: '2026-10-21T00:00:00Z',
  endTime: '2026-10-21T02:00:00Z',
  customerName: '홍길동',
  customerAddress: '서울시 중구 세종대로 110',
  customerAddressDetail: '3층',
  customerLocation: { latitude: 37.566535, longitude: 126.977969 },
  delayed: false,
  ...overrides,
});

describe('toMySchedule', () => {
  // 10/20 00:00 ~ 10/27 00:00 KST
  const week = { from: '2026-10-19T15:00:00Z', to: '2026-10-26T15:00:00Z' };

  it('내 일정 행을 포트의 행으로 바꾸고 발주사 이름을 붙인다 (고객 이름은 서버 값)', () => {
    expect(
      toMySchedule(
        { works: [scheduled()] },
        { works: [] },
        week,
        '오르빗 설비',
      ),
    ).toEqual({
      works: [
        {
          workId: 10,
          name: '보일러 점검',
          status: 'ACCEPTED',
          assignmentNumber: 1,
          startTime: '2026-10-21T00:00:00Z',
          endTime: '2026-10-21T02:00:00Z',
          customerAddress: '서울시 중구 세종대로 110',
          customerAddressDetail: '3층',
          delayed: false,
          customerName: '홍길동',
          organizationName: '오르빗 설비',
        },
      ],
    });
  });

  it('비어 있는 고객 값·발주사 이름은 null 로 둔다', () => {
    const [work] = toMySchedule(
      {
        works: [
          scheduled({
            customerName: null,
            customerAddress: null,
            customerAddressDetail: null,
            customerLocation: null,
          }),
        ],
      },
      { works: [] },
      week,
      null,
    ).works;

    expect(work).toMatchObject({
      customerName: null,
      customerAddress: null,
      customerAddressDetail: null,
      organizationName: null,
    });
  });

  // 백엔드 내 일정은 배정됨(수락 대기)을 빼고, 응답 필요가 날짜와 관계없이 따로 준다
  it('응답 필요 가운데 구간과 겹치는 것만 더해 시작 시각·작업 id 순으로 합친다', () => {
    const pending = (workId: number, startTime: string, endTime: string) =>
      scheduled({ workId, status: 'PENDING_ACCEPT', startTime, endTime });

    const { works } = toMySchedule(
      {
        works: [
          scheduled({ workId: 30, startTime: '2026-10-22T00:00:00Z' }),
          scheduled({ workId: 12, startTime: '2026-10-22T00:00:00Z' }),
        ],
      },
      {
        works: [
          // 구간 앞에서 끝남 [from 과 같은 끝은 겹치지 않는다]
          pending(1, '2026-10-19T13:00:00Z', '2026-10-19T15:00:00Z'),
          // 구간 앞에서 시작해 구간 안에서 끝남
          pending(2, '2026-10-19T14:00:00Z', '2026-10-19T16:00:00Z'),
          pending(11, '2026-10-22T00:00:00Z', '2026-10-22T01:00:00Z'),
          // 구간 끝에서 시작 (to 는 제외)
          pending(3, '2026-10-26T15:00:00Z', '2026-10-26T16:00:00Z'),
        ],
      },
      week,
      '오르빗 설비',
    );

    expect(works.map(work => [work.workId, work.status])).toEqual([
      [2, 'PENDING_ACCEPT'],
      [11, 'PENDING_ACCEPT'],
      [12, 'ACCEPTED'],
      [30, 'ACCEPTED'],
    ]);
  });

  // 두 조회 사이에 수락하면 같은 작업이 양쪽에 올 수 있다
  it('두 응답에 같은 작업이 있으면 확정 일정 쪽 하나만 둔다', () => {
    const { works } = toMySchedule(
      { works: [scheduled({ status: 'ACCEPTED' })] },
      { works: [scheduled({ status: 'PENDING_ACCEPT' })] },
      week,
      null,
    );

    expect(works).toHaveLength(1);
    expect(works[0].status).toBe('ACCEPTED');
  });
});

describe('toPendingWorks', () => {
  it('응답 필요 행을 서버 순서(시작 시각 순) 그대로 옮기고 발주사 이름을 붙인다 (날짜로 거르지 않는다)', () => {
    const { works } = toPendingWorks(
      {
        works: [
          scheduled({ workId: 2, status: 'PENDING_ACCEPT' }),
          scheduled({
            workId: 1,
            status: 'PENDING_ACCEPT',
            startTime: '2027-03-01T00:00:00Z',
            endTime: '2027-03-01T01:00:00Z',
          }),
        ],
      },
      '오르빗 설비',
    );

    expect(works.map(work => [work.workId, work.organizationName])).toEqual([
      [2, '오르빗 설비'],
      [1, '오르빗 설비'],
    ]);
  });
});

// WorkHistoryResponse.AssignedWork 예시 (완료)
const assignedWork = (
  overrides: Partial<AssignedWorkResponse> = {},
): AssignedWorkResponse => ({
  workId: 10,
  name: '보일러 점검',
  status: 'COMPLETED',
  current: true,
  assignmentNumber: 1,
  startTime: '2026-10-21T00:00:00Z',
  endTime: '2026-10-21T02:00:00Z',
  result: 'ACCEPTED',
  endReason: null,
  workType: { id: 3, name: '점검', color: '#7C5CFF' },
  startedAt: '2026-10-21T00:05:00Z',
  completedAt: '2026-10-21T01:50:00Z',
  ...overrides,
});

describe('toWorkHistory', () => {
  const history = (
    overrides: Partial<WorkHistoryResponse> = {},
  ): WorkHistoryResponse => ({
    technicianId: 3,
    works: [
      assignedWork(),
      assignedWork({ workId: 9, endReason: 'RESCHEDULED' }),
    ],
    statistics: { assigned: 2, completed: 2, rejected: 0, cancelled: 0 },
    totalCompleted: 42,
    ...overrides,
  });

  it('이력 행·구간 통계·누적 완료를 옮기고 발주사 이름을 붙인다 (고객 값은 서버에 없어 null)', () => {
    expect(toWorkHistory(history(), '오르빗 설비')).toEqual({
      works: [
        {
          workId: 10,
          name: '보일러 점검',
          status: 'COMPLETED',
          current: true,
          assignmentNumber: 1,
          startTime: '2026-10-21T00:00:00Z',
          endTime: '2026-10-21T02:00:00Z',
          result: 'ACCEPTED',
          endReason: null,
          customerName: null,
          customerAddress: null,
          customerAddressDetail: null,
          organizationName: '오르빗 설비',
        },
        expect.objectContaining({ workId: 9, endReason: 'RESCHEDULED' }),
      ],
      statistics: { assigned: 2, completed: 2, rejected: 0, cancelled: 0 },
      totalCompleted: 42,
    });
  });

  it('완료한 작업이 없으면 빈 목록, 누적 완료 0 이다', () => {
    expect(
      toWorkHistory(
        history({
          works: [],
          statistics: { assigned: 0, completed: 0, rejected: 0, cancelled: 0 },
          totalCompleted: 0,
        }),
        null,
      ),
    ).toEqual({
      works: [],
      statistics: { assigned: 0, completed: 0, rejected: 0, cancelled: 0 },
      totalCompleted: 0,
    });
  });
});

describe('기사 명령 요청 본문', () => {
  it('수락·시작은 배정 순번만 보낸다 (AssignmentNumberRequest)', () => {
    expect(
      toAssignmentNumberRequest({ workId: 10, assignmentNumber: 2 }),
    ).toEqual({ assignmentNumber: 2 });
  });

  it('거절은 순번·사유·메모를 보낸다 (RejectWorkRequest)', () => {
    expect(
      toRejectWorkRequest({
        workId: 10,
        assignmentNumber: 2,
        reason: 'OTHER',
        note: '차량 고장',
      }),
    ).toEqual({ assignmentNumber: 2, reason: 'OTHER', note: '차량 고장' });
    expect(
      toRejectWorkRequest({
        workId: 10,
        assignmentNumber: 2,
        reason: 'LOCATION_TOO_FAR',
        note: null,
      }),
    ).toEqual({ assignmentNumber: 2, reason: 'LOCATION_TOO_FAR', note: null });
  });

  it('완료 보고는 올린 사진의 파일 식별자를 순서대로 담는다 (SubmitCompletionReportRequest)', () => {
    expect(
      toSubmitReportRequest(
        {
          workId: 10,
          assignmentNumber: 2,
          beforePhotos: ['file://b1.jpg'],
          afterPhotos: ['file://a1.jpg', 'file://a2.jpg'],
          usedParts: null,
          workNote: '배관 교체 완료',
          actualFee: 75000,
          actualPaymentMethod: 'CREDIT_CARD',
        },
        { beforePhotoIds: ['b-1'], afterPhotoIds: ['a-1', 'a-2'] },
      ),
    ).toEqual({
      assignmentNumber: 2,
      beforePhotoIds: ['b-1'],
      afterPhotoIds: ['a-1', 'a-2'],
      usedParts: null,
      workNote: '배관 교체 완료',
      actualFee: 75000,
      actualPaymentMethod: 'CREDIT_CARD',
    });
  });
});
