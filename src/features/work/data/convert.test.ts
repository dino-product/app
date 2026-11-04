import { emptyReport, type WorkReport } from '../model';
import {
  toActualPaymentMethod,
  toRejectionReason,
  toSubmitCommand,
  toWorkDetail,
  workStatusChip,
} from './convert';
import type { WorkDetailResponse } from './types';

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
