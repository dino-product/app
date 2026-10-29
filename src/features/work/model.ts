import type { WorkStatus } from '../../shared/design-system';

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
  title: string;
  status: WorkStatus;
  timeRange: string;
  dayLabel: string;
  company: string;
  customerName: string;
  address: string;
};

export type WorkDetail = {
  id: string;
  title: string;
  status: WorkStatus;
  registeredAt: string;
  date: string;
  timeRange: string;
  technician: string;
  workType: string;
  customer: { name: string; phone: string };
  address: string;
  memo: string;
  price: number;
  requestImages: string[];
};

export const PHOTO_LIMIT = 5;

export type PaymentMethod = 'card' | 'cash' | 'transfer';

// Figma 에는 선택 박스만 있어 선택지는 임시값이다 (API 스펙 확정 시 교체)
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  card: '카드',
  cash: '현금',
  transfer: '계좌이체',
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

export type SubmitResult =
  | { kind: 'submitted'; at: string }
  | { kind: 'canceled'; reason: string; at: string };

/** 작업 전·후 사진과 결제 금액·방식은 필수, 수행 메모·사용 부품은 선택 */
export function canSubmitReport(report: WorkReport): boolean {
  return (
    report.beforePhotos.length > 0 &&
    report.afterPhotos.length > 0 &&
    Number(report.amount) > 0 &&
    report.paymentMethod !== null
  );
}

export function formatWon(value: number): string {
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 제출 결과 모달의 시각 표기 (예: 10.01 15:15) */
export function formatResultTime(date: Date): string {
  return `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())} ${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;
}
