import type {
  AssignmentResponse,
  PhotoResponse,
  ScheduleResponse,
  WorkDetailResponse,
  WorkStatusCode,
} from './types';

// 로컬 작업 저장소의 처음 데이터 (전에 화면을 채우던 Figma 예시 데이터를 서버 작업 상세 응답 모양으로 옮겼다).
// 어느 날 어느 시각에 열어도 같은 흐름을 볼 수 있게 지금 시각을 기준으로 만든다:
// 지금 시작할 수 있는 오늘의 작업 하나, 뒤이은 작업, 내일과 닷새 뒤 응답 필요 요청, 두 달 남짓의 완료 이력

/** 로컬 저장소 작업의 발주사 (목록 행의 업체명) */
export const LOCAL_ORGANIZATION_NAME = '한빛 설비';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const technician = {
  technicianId: 12,
  name: '김현수',
  technicianType: null,
};

const fakePhoto = (id: string): PhotoResponse => ({
  photoId: id,
  url: `fake-photo://${id}`,
});

type SeedWork = {
  workId: number;
  name: string;
  status: WorkStatusCode;
  start: number;
  minutes: number;
  workType: string;
  customer: { name: string; phone: string; address: string; detail?: string };
  payment: WorkDetailResponse['payment'];
};

const iso = (ms: number) => new Date(ms).toISOString();

function toResponse({
  workId,
  name,
  status,
  start,
  minutes,
  workType,
  customer,
  payment,
}: SeedWork): WorkDetailResponse {
  const schedule: ScheduleResponse = {
    technician,
    startTime: iso(start),
    expectedDurationMinutes: minutes,
    endTime: iso(start + minutes * MINUTE),
  };
  const assignedAt = start - 2 * DAY;
  const assignment: AssignmentResponse = {
    assignmentNumber: 1,
    schedule,
    assignedAt: iso(assignedAt),
    assignedBy: 5,
    result: status === 'PENDING_ACCEPT' ? 'PENDING' : 'ACCEPTED',
    decidedAt: status === 'PENDING_ACCEPT' ? null : iso(assignedAt + HOUR),
    rejectionReason: null,
    rejectionNote: null,
    endReason: null,
    endedAt: null,
    endedBy: null,
  };
  const completedAt = start + (minutes - 5) * MINUTE;
  const completed = status === 'COMPLETED';
  return {
    workId,
    name,
    status,
    delayed: false,
    workType: { id: workId, name: workType, color: null },
    registrar: null,
    registeredAt: iso(start - 3 * DAY),
    customer: {
      name: customer.name,
      phone: customer.phone,
      postalCode: null,
      address: customer.address,
      addressDetail: customer.detail ?? null,
    },
    payment,
    schedule,
    plannedSchedule: null,
    assignments: [assignment],
    startedAt: completed ? iso(start) : null,
    completedAt: completed ? iso(completedAt) : null,
    cancellation: null,
    completionReport: completed
      ? {
          beforePhotos: [
            fakePhoto(`${workId}-before-1`),
            fakePhoto(`${workId}-before-2`),
          ],
          afterPhotos: [fakePhoto(`${workId}-after-1`)],
          usedParts: '배수 호스 1개',
          workNote: '작업 완료 후 정상 작동 확인',
          actualFee: 75000,
          actualPaymentMethod: 'CREDIT_CARD',
        }
      : null,
    sitePhotos: [fakePhoto(`${workId}-site-1`), fakePhoto(`${workId}-site-2`)],
    completionReportRequests: [],
    completionReportRequestable: false,
    version: 1,
  };
}

const neighbor = {
  name: '정다은',
  phone: '010-3456-7890',
  address: '서울 용산구 이태원로 202',
};

const historyTitles = [
  '에어컨 청소',
  '도어록 교체',
  '배수구 막힘',
  '수전 교체',
];
// 오늘부터 며칠 전에 완료했는지. 두 달 남짓 이어지고, 그 앞 달부터는 비어 있어 빈 상태를 볼 수 있다
const HISTORY_DAYS_AGO = [0, 0, 1, 3, 6, 9, 13, 18, 24, 31, 38, 45, 52];

export function makeLocalSeed(now: Date): WorkDetailResponse[] {
  // 10분 단위로 내려 시각이 깔끔하게 보이게 한다. 진행할 작업은 20분 전에 시작해 지금 시작할 수 있다
  const base = Math.floor(now.getTime() / (10 * MINUTE)) * 10 * MINUTE;
  const current = base - 20 * MINUTE;
  const requestDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 5,
  );
  const at = (hour: number) =>
    new Date(
      requestDay.getFullYear(),
      requestDay.getMonth(),
      requestDay.getDate(),
      hour,
    ).getTime();

  const upcoming: SeedWork[] = [
    {
      workId: 101,
      name: '보일러 점검',
      status: 'ACCEPTED',
      start: current,
      minutes: 60,
      workType: '보일러',
      customer: {
        name: '이수연',
        phone: '010-2345-6789',
        address: '서울 송파구 올림픽로 88',
      },
      payment: { fee: 75000, method: 'ON_SITE_CARD' },
    },
    // 계획 금액·결제 방식이 없는 작업 (완료 보고가 빈 칸으로 열린다)
    {
      workId: 102,
      name: '세탁기 설치',
      status: 'ACCEPTED',
      start: current + 2 * HOUR,
      minutes: 60,
      workType: '세탁기',
      customer: neighbor,
      payment: null,
    },
    {
      workId: 103,
      name: '세탁기 설치',
      status: 'ACCEPTED',
      start: current + DAY,
      minutes: 60,
      workType: '세탁기',
      customer: neighbor,
      payment: null,
    },
    // 내일 수락 대기 요청 (홈 이번 주 일정에서 열면 수락·거절하는 요청 상세로 간다)
    {
      workId: 106,
      name: '도어록 교체',
      status: 'PENDING_ACCEPT',
      start: current + DAY + 3 * HOUR,
      minutes: 60,
      workType: '도어락',
      customer: {
        name: '박민지',
        phone: '010-1234-5678',
        address: '서울 강남구 역삼동 123-4',
        detail: '101호',
      },
      payment: { fee: 75000, method: 'ON_SITE_CARD' },
    },
    {
      workId: 104,
      name: '에어컨 필터 교체',
      status: 'PENDING_ACCEPT',
      start: at(14),
      minutes: 60,
      workType: '에어컨',
      customer: neighbor,
      payment: { fee: 50000, method: 'ON_SITE_CASH' },
    },
    {
      workId: 105,
      name: '에어컨 필터 교체',
      status: 'PENDING_ACCEPT',
      start: at(16),
      minutes: 60,
      workType: '에어컨',
      customer: neighbor,
      payment: { fee: 50000, method: 'BANK_TRANSFER' },
    },
  ];

  // 완료 작업은 지금보다 앞에 끝나도록 지금에서 거꾸로 센다
  const history: SeedWork[] = HISTORY_DAYS_AGO.map((days, i) => ({
    workId: 1 + i,
    name: historyTitles[i % historyTitles.length],
    status: 'COMPLETED',
    start: base - days * DAY - (3 + (i % 2) * 2) * HOUR,
    minutes: 60,
    workType: '설비',
    customer: neighbor,
    payment: { fee: 75000, method: 'ON_SITE_CARD' },
  }));

  return [...upcoming, ...history].map(toResponse);
}
