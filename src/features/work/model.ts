import type { WorkStatus } from '../../shared/design-system';
import type { WorkStatusCode } from './data/status';

// 작업 수행 화면의 데이터 모양. API 가 붙으면 응답을 이 타입으로 변환해 넣는다.

export type CurrentWork = {
  id: string;
  title: string;
  timeRange: string;
  customerName: string;
  address: string;
};

export type ScheduleItem = {
  id: string;
  /** 작업 날짜 YYYY-MM-DD. 블록 보기에서 고른 날의 일정만 고를 때 쓴다 (#94) */
  dateKey: string;
  title: string;
  status: WorkStatus;
  timeRange: string;
  dayLabel: string;
  company: string;
  customerName: string;
  address: string;
};

/** WGS84 위도·경도 */
export type GeoPoint = { latitude: number; longitude: number };

export type WorkDetail = {
  id: string;
  title: string;
  status: WorkStatus;
  /** 칩 이름을 상태 이름 대신 쓸 때 (취소 작업은 디자인 시스템에 칩이 없어 거절 칩 색에 '취소') */
  statusLabel?: string;
  /** 서버의 작업 상태. 완료 보고는 작업중(IN_PROGRESS)일 때만 쓸 수 있다 (칩은 지연을 겹쳐 보여 따로 둔다) */
  workStatus: WorkStatusCode;
  registeredAt: string;
  date: string;
  timeRange: string;
  technician: string;
  workType: string;
  customer: { name: string; phone: string };
  address: string;
  /** 현장 좌표 (서버가 주소에서 구한 값). 없으면 null 이고 지도 자리는 회색으로 둔다 */
  location: GeoPoint | null;
  memo: string;
  /** 정해지지 않았으면 null */
  price: number | null;
  /** 등록 때 정한 결제 방식. 정해지지 않았으면 null */
  paymentMethod: PaymentMethod | null;
  requestImages: string[];
  /** 수락·거절·시작·완료 보고에 함께 보내는 지금 배정의 순번. 배정이 없으면 null */
  assignmentNumber: number | null;
  /** 완료 보고를 제출했으면 그 내용. 있으면 보고 영역을 읽기 전용으로 그린다 */
  submission?: ReportSubmission;
};

/** 작업 전·후 단계별 최대 장수. 백엔드 CompletionReport 의 MAX_PHOTO_COUNT 와 같다 */
export const PHOTO_LIMIT = 6;

// 백엔드 ActualPaymentMethod 의 CREDIT_CARD, CASH, BANK_TRANSFER, INVOICE 에 대응한다
export type PaymentMethod = 'card' | 'cash' | 'transfer' | 'invoice';

// Figma 결제 방식 드롭다운 목록. 선언 순서가 목록 순서다
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  card: '현장 카드',
  cash: '현장 현금',
  transfer: '계좌 이체',
  invoice: '청구서 발행(후불)',
};

export type WorkReport = {
  beforePhotos: string[];
  afterPhotos: string[];
  memo: string;
  parts: string;
  /** 숫자만 담은 문자열 */
  amount: string;
  paymentMethod: PaymentMethod | null;
};

export const emptyReport: WorkReport = {
  beforePhotos: [],
  afterPhotos: [],
  memo: '',
  parts: '',
  amount: '',
  paymentMethod: null,
};

export type ReportSubmission = {
  /** "YYYY-MM-DD HH:mm" */
  submittedAt: string;
  report: WorkReport;
};

export type SubmitResult =
  | { kind: 'submitted'; at: string }
  | { kind: 'canceled'; reason: string; at: string };

/**
 * 결제 금액(0 보다 큼)과 결제 방식만 필수다. 작업 전·후 사진, 수행 메모·사용 부품은 비워도 낼 수 있다.
 * 백엔드 완료 보고 요청은 배정 순번 말고는 모두 비워 보낼 수 있고 Figma 는 메모·부품에만 '(선택)' 을 달아,
 * 사진·금액은 사용자가 정했다 (#150)
 */
export function canSubmitReport(report: WorkReport): boolean {
  return Number(report.amount) > 0 && report.paymentMethod !== null;
}

/**
 * 하나라도 입력했는지 (화면을 닫으면 사라질 입력). 공백만 쓴 메모·부품은 빈 것으로 본다.
 * base 는 아무것도 쓰지 않은 보고다: 계획값으로 미리 채운 금액은 그대로면 입력이 아니다
 */
export function hasReportInput(
  report: WorkReport,
  base: WorkReport = emptyReport,
): boolean {
  return (
    report.beforePhotos.length > 0 ||
    report.afterPhotos.length > 0 ||
    report.memo.trim() !== '' ||
    report.parts.trim() !== '' ||
    report.amount !== base.amount ||
    report.paymentMethod !== base.paymentMethod
  );
}

/**
 * 아무것도 쓰지 않은 완료 보고: 결제 금액을 작업의 계획값으로 미리 채운다 (계획값이 없으면 빈 칸).
 * 결제 방식은 계획값이 있어도 고르지 않은 채로 둔다. 기사가 직접 고르는 것이 제출을 여는 계기다 (#150)
 */
export function reportFromPlan(work: Pick<WorkDetail, 'price'>): WorkReport {
  return {
    ...emptyReport,
    amount: work.price === null ? '' : String(work.price),
  };
}

const groupThousands = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function formatWon(value: number): string {
  return `${groupThousands(String(value))}원`;
}

/** 결제 금액 입력칸에 보일 값. 저장 값(숫자만)에 쉼표만 넣는다 */
export function formatAmount(digits: string): string {
  return groupThousands(digits);
}

export function formatPrice(price: number | null): string {
  return price === null ? '- 원' : formatWon(price);
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 제출 결과 모달의 시각 표기 (예: 10.01 15:15) */
export function formatResultTime(date: Date): string {
  return `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())} ${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;
}

/** 제출 후 상세의 제출 시각 표기 (예: 2026-12-19 11:32) */
export function formatSubmittedAt(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 그 날이 속한 주의 월요일~일요일 0시. 내 작업 블록 보기의 날짜 칸 (Figma 3463:17452 는 월요일 시작) */
export function mondayWeek(date: Date): Date[] {
  // getDay 는 일요일이 0 이라 일요일은 6일 전 월요일의 주에 든다
  const sinceMonday = (date.getDay() + 6) % 7;
  return Array.from(
    { length: 7 },
    (_, i) =>
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() - sinceMonday + i,
      ),
  );
}
