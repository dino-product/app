import type { WorkStatus } from '../../../shared/design-system';
import type { RejectReasonKey } from '../../schedule/model';
import { WEEKDAYS } from '../../schedule/model';
import {
  emptyReport,
  formatSubmittedAt,
  type PaymentMethod,
  type ReportSubmission,
  type WorkDetail,
  type WorkReport,
} from '../model';
import type {
  AcceptWorkCommand,
  ActualPaymentMethod,
  AssignedWorkResponse,
  AssignmentNumberRequest,
  CompletionReportResponse,
  HistoryWork,
  Instant,
  MySchedule,
  MyScheduleResponse,
  Period,
  PlannedPaymentMethod,
  RejectionReason,
  RejectWorkCommand,
  RejectWorkRequest,
  ScheduledWork,
  ScheduledWorkResponse,
  SubmitCompletionReportCommand,
  SubmitCompletionReportRequest,
  WorkDetailResponse,
  WorkHistory,
  WorkHistoryResponse,
  WorkStatusCode,
} from './types';

// 백엔드 값 ↔ 화면 모델. 시각은 UTC 문자열을 기기 현지 시각으로 바꿔 보여 준다 (api-spec.md §1.8)

/** 비어 있는 값 자리 */
export const EMPTY_VALUE = '-';

const chipByStatus: Record<WorkStatusCode, WorkStatus> = {
  REGISTERED: 'registered',
  PENDING_ACCEPT: 'assigned',
  ACCEPTED: 'beforeWork',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
  // 디자인 시스템 칩 세트(Figma)에 취소가 없어 거절 칩 색을 쓰고 이름만 바꾼다 (Figma 미확인)
  CANCELED: 'rejected',
};

// 지연은 아직 끝나지 않은 작업에만 보인다. 늦게 완료한 작업은 완료, 취소는 지연이 아니다
const delayable: readonly WorkStatusCode[] = [
  'PENDING_ACCEPT',
  'ACCEPTED',
  'IN_PROGRESS',
];

/** 작업 상태 → 상태 칩. 상세·목록이 같이 쓴다 */
export function workStatusChip(
  status: WorkStatusCode,
  delayed: boolean,
): { status: WorkStatus; label?: string } {
  if (status === 'CANCELED') {
    return { status: chipByStatus.CANCELED, label: '취소' };
  }
  if (delayed && delayable.includes(status)) {
    return { status: 'delayed' };
  }
  return { status: chipByStatus[status] };
}

// 계획 결제 방식과 실제 결제 방식은 1:1 이다 (api-spec.md §4.3). 앱 화면의 결제 방식 하나로 둘 다 나타낸다
const plannedPaymentMethods: Record<PlannedPaymentMethod, PaymentMethod> = {
  ON_SITE_CARD: 'card',
  ON_SITE_CASH: 'cash',
  BANK_TRANSFER: 'transfer',
  INVOICE: 'invoice',
};

const actualPaymentMethods: Record<PaymentMethod, ActualPaymentMethod> = {
  card: 'CREDIT_CARD',
  cash: 'CASH',
  transfer: 'BANK_TRANSFER',
  invoice: 'INVOICE',
};

const fromActual = Object.fromEntries(
  Object.entries(actualPaymentMethods).map(([app, actual]) => [actual, app]),
) as Record<ActualPaymentMethod, PaymentMethod>;

export const toActualPaymentMethod = (method: PaymentMethod) =>
  actualPaymentMethods[method];

const rejectionReasons: Record<RejectReasonKey, RejectionReason> = {
  schedule: 'SCHEDULE_CONFLICT',
  otherWork: 'ALREADY_ASSIGNED',
  distance: 'LOCATION_TOO_FAR',
  mismatch: 'SCOPE_MISMATCH',
  other: 'OTHER',
};

/** 거절 사유 화면의 선택지 → 백엔드 거절 사유 */
export const toRejectionReason = (key: RejectReasonKey) =>
  rejectionReasons[key];

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 현지 날짜 YYYY-MM-DD */
export function localDateKey(instant: Instant): string {
  const date = new Date(instant);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

/** 현지 시각 HH:mm */
export function localTime(instant: Instant): string {
  const date = new Date(instant);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

const period = (date: Date) => (date.getHours() < 12 ? '오전' : '오후');
const clock12 = (date: Date) =>
  `${date.getHours() % 12 || 12}:${pad2(date.getMinutes())}`;

/** 상세의 시간 (예: 오전 10:00 - 11:30). 끝 시각은 오전·오후가 바뀔 때만 붙인다 */
function detailTimeRange(start: Instant, end: Instant): string {
  const from = new Date(start);
  const to = new Date(end);
  const toPeriod = period(to) === period(from) ? '' : `${period(to)} `;
  return `${period(from)} ${clock12(from)} - ${toPeriod}${clock12(to)}`;
}

function detailDate(instant: Instant): string {
  return `${localDateKey(instant)} (${WEEKDAYS[new Date(instant).getDay()]})`;
}

/** 고객 기본주소와 상세주소를 한 줄로. 둘 다 없으면 null */
export function joinAddress(
  address: string | null,
  detail: string | null,
): string | null {
  return [address, detail].filter(Boolean).join(' ') || null;
}

function toSubmission(
  report: CompletionReportResponse,
  completedAt: Instant | null,
): ReportSubmission {
  return {
    submittedAt:
      completedAt === null
        ? EMPTY_VALUE
        : formatSubmittedAt(new Date(completedAt)),
    report: {
      beforePhotos: report.beforePhotos.map(photo => photo.url),
      afterPhotos: report.afterPhotos.map(photo => photo.url),
      memo: report.workNote ?? '',
      parts: report.usedParts ?? '',
      amount: report.actualFee === null ? '' : String(report.actualFee),
      paymentMethod:
        report.actualPaymentMethod === null
          ? null
          : fromActual[report.actualPaymentMethod],
    },
  };
}

/**
 * 작업 상세 응답 → 화면 모델. 백엔드에 작업 메모가 없어 메모는 비어 있다 (#112 G16).
 * 사진 url 은 그대로 둔다: 서버가 서명한 내려받기 주소라 10분 뒤 만료되고, 상세를 다시 받으면 새 주소가 온다
 */
export function toWorkDetail(response: WorkDetailResponse): WorkDetail {
  const { customer, payment, schedule, assignments } = response;
  const chip = workStatusChip(response.status, response.delayed);
  const current = assignments[assignments.length - 1];
  const work: WorkDetail = {
    id: String(response.workId),
    title: response.name,
    status: chip.status,
    workStatus: response.status,
    registeredAt: localDateKey(response.registeredAt),
    date: schedule ? detailDate(schedule.startTime) : EMPTY_VALUE,
    timeRange: schedule
      ? detailTimeRange(schedule.startTime, schedule.endTime)
      : EMPTY_VALUE,
    technician: schedule?.technician?.name ?? EMPTY_VALUE,
    workType: response.workType?.name ?? EMPTY_VALUE,
    customer: {
      name: customer?.name ?? EMPTY_VALUE,
      phone: customer?.phone ?? EMPTY_VALUE,
    },
    address:
      joinAddress(customer?.address ?? null, customer?.addressDetail ?? null) ??
      EMPTY_VALUE,
    memo: EMPTY_VALUE,
    price: payment?.fee ?? null,
    paymentMethod: payment?.method
      ? plannedPaymentMethods[payment.method]
      : null,
    requestImages: response.sitePhotos.map(photo => photo.url),
    assignmentNumber: current ? current.assignmentNumber : null,
  };
  if (chip.label !== undefined) {
    work.statusLabel = chip.label;
  }
  if (response.completionReport) {
    work.submission = toSubmission(
      response.completionReport,
      response.completedAt,
    );
  }
  return work;
}

const blankToNull = (value: string) => value.trim() || null;

/** 완료 보고 입력 → 제출 Command. 사진은 기기 URI 그대로 두고, HTTP 저장소가 올린 뒤 파일 식별자로 바꿔 보낸다 */
export function toSubmitCommand(
  workId: number,
  assignmentNumber: number,
  report: WorkReport = emptyReport,
): SubmitCompletionReportCommand {
  return {
    workId,
    assignmentNumber,
    beforePhotos: report.beforePhotos,
    afterPhotos: report.afterPhotos,
    usedParts: blankToNull(report.parts),
    workNote: blankToNull(report.memo),
    actualFee: report.amount === '' ? null : Number(report.amount),
    actualPaymentMethod:
      report.paymentMethod === null
        ? null
        : toActualPaymentMethod(report.paymentMethod),
  };
}

const time = (instant: Instant) => Date.parse(instant);

// 반열림 구간 [from, to) 와 일정 [start, end) 가 겹치는지 (백엔드 내 일정 조회와 같은 기준)
const overlaps = (work: ScheduledWorkResponse, { from, to }: Period) =>
  time(work.startTime) < time(to) && time(work.endTime) > time(from);

const byStart = (a: ScheduledWorkResponse, b: ScheduledWorkResponse) =>
  time(a.startTime) - time(b.startTime) || a.workId - b.workId;

function toScheduledWork(
  work: ScheduledWorkResponse,
  organizationName: string | null,
): ScheduledWork {
  return {
    workId: work.workId,
    name: work.name,
    status: work.status,
    assignmentNumber: work.assignmentNumber,
    startTime: work.startTime,
    endTime: work.endTime,
    customerAddress: work.customerAddress,
    customerAddressDetail: work.customerAddressDetail,
    delayed: work.delayed,
    customerName: work.customerName,
    organizationName,
  };
}

/**
 * 내 일정(구간의 확정 일정) + 응답 필요(날짜와 관계없는 수락 대기) → 포트의 내 일정.
 * 백엔드 내 일정은 수락 대기를 빼므로 응답 필요 가운데 구간과 겹치는 것만 더해 시작 시각·작업 id 순으로 합친다.
 * 두 조회 사이에 수락해 같은 작업이 양쪽에 오면 확정 일정 쪽을 둔다. 발주사 이름은 경로의 발주사(소속 목록) 이름이다
 */
export function toMySchedule(
  confirmed: MyScheduleResponse,
  pending: MyScheduleResponse,
  range: Period,
  organizationName: string | null,
): MySchedule {
  const confirmedIds = new Set(confirmed.works.map(work => work.workId));
  const works = [
    ...confirmed.works,
    ...pending.works.filter(
      work => !confirmedIds.has(work.workId) && overlaps(work, range),
    ),
  ].sort(byStart);
  return {
    works: works.map(work => toScheduledWork(work, organizationName)),
  };
}

/** 응답 필요(my-schedule/pending) → 포트의 목록. 서버가 날짜와 관계없이 시작 시각·작업 id 순으로 준 그대로다 */
export function toPendingWorks(
  pending: MyScheduleResponse,
  organizationName: string | null,
): MySchedule {
  return {
    works: pending.works.map(work => toScheduledWork(work, organizationName)),
  };
}

function toHistoryWork(
  work: AssignedWorkResponse,
  organizationName: string | null,
): HistoryWork {
  return {
    workId: work.workId,
    name: work.name,
    status: work.status,
    current: work.current,
    assignmentNumber: work.assignmentNumber,
    startTime: work.startTime,
    endTime: work.endTime,
    result: work.result,
    endReason: work.endReason,
    // 이력 행에는 고객 정보가 없다 (#112 G14)
    customerName: null,
    customerAddress: null,
    customerAddressDetail: null,
    organizationName,
  };
}

/** 작업 이력 응답 → 포트의 작업 이력. 순서(최근 먼저)·통계·누적 완료는 서버 그대로다 */
export function toWorkHistory(
  response: WorkHistoryResponse,
  organizationName: string | null,
): WorkHistory {
  return {
    works: response.works.map(work => toHistoryWork(work, organizationName)),
    statistics: { ...response.statistics },
    totalCompleted: response.totalCompleted,
  };
}

/** 수락·시작 요청 본문. 화면에서 본 배정 순번만 보낸다 */
export const toAssignmentNumberRequest = ({
  assignmentNumber,
}: AcceptWorkCommand): AssignmentNumberRequest => ({ assignmentNumber });

/** 거절 요청 본문 */
export const toRejectWorkRequest = ({
  assignmentNumber,
  reason,
  note,
}: RejectWorkCommand): RejectWorkRequest => ({
  assignmentNumber,
  reason,
  note,
});

/** 완료 보고 제출 본문. 사진은 기기 URI 를 올리고 받은 파일 식별자다 (보고의 순서 그대로) */
export function toSubmitReportRequest(
  command: SubmitCompletionReportCommand,
  photoIds: { beforePhotoIds: string[]; afterPhotoIds: string[] },
): SubmitCompletionReportRequest {
  return {
    assignmentNumber: command.assignmentNumber,
    beforePhotoIds: photoIds.beforePhotoIds,
    afterPhotoIds: photoIds.afterPhotoIds,
    usedParts: command.usedParts,
    workNote: command.workNote,
    actualFee: command.actualFee,
    actualPaymentMethod: command.actualPaymentMethod,
  };
}
