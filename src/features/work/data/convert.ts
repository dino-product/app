import type { WorkStatus } from '../../../shared/design-system';
import type { RejectReasonKey } from '../../schedule/model';
import { WEEKDAYS } from '../../schedule/model';
import {
  emptyReport,
  formatSubmittedAt,
  type GeoPoint,
  type PaymentMethod,
  type ReportSubmission,
  type WorkDetail,
  type WorkReport,
} from '../model';
import type {
  ActualPaymentMethod,
  CompletionReportResponse,
  Instant,
  LocationResponse,
  PlannedPaymentMethod,
  RejectionReason,
  SubmitCompletionReportCommand,
  WorkDetailResponse,
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

/** 서버 현장 좌표 → 화면 좌표. 없거나 숫자가 아니면 null (예전 서버는 필드가 없다) */
function toGeoPoint(
  location: LocationResponse | null | undefined,
): GeoPoint | null {
  if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return null;
  }
  return { latitude: location.latitude, longitude: location.longitude };
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
 * 작업 상세 응답 → 화면 모델. 백엔드에 작업 메모가 없어 메모는 비어 있다.
 * 사진 url 은 그대로 둔다: 가짜 주소(fake-photo://, #112 G4)는 썸네일이 회색 자리로 그린다
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
    location: toGeoPoint(customer?.location),
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

/** 완료 보고 입력 → 제출 Command. 사진은 지금은 기기 URI 를 식별자로 보낸다 (업로드 API 없음, #112 G3) */
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
