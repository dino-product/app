import type { WorkStatus } from '../../shared/design-system';

// 스케줄 화면의 데이터 모양과 날짜 계산. API 가 붙으면 응답을 이 타입으로 변환해 넣는다.

export type ConfirmedSchedule = {
  id: string;
  /** YYYY-MM-DD */
  dateKey: string;
  title: string;
  status: WorkStatus;
  timeRange: string;
  company: string;
  customerName: string;
  address: string;
};

export type PendingRequest = ConfirmedSchedule & {
  /** 카드에 보이는 날짜 (예: 9/20) */
  dateLabel: string;
};

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

const pad2 = (value: number) => String(value).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

export function formatDateHeader(date: Date): string {
  return `${date.getFullYear()}년 ${
    date.getMonth() + 1
  }월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

export function formatMonthTitle(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** 그 날이 속한 주의 일요일~토요일 */
export function weekDays(date: Date): Date[] {
  const sunday = addDays(date, -date.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

export type MonthCell = { date: Date; inMonth: boolean };

/** 그 달을 덮는 주 단위 격자 (일요일 시작, 앞뒤 달 날짜 포함) */
export function monthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = addDays(first, -first.getDay());
  const weeks = Math.ceil((first.getDay() + last.getDate()) / 7);

  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (__, d) => {
      const date = addDays(start, w * 7 + d);
      return { date, inMonth: date.getMonth() === month };
    }),
  );
}

export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export type RejectReasonKey =
  | 'schedule'
  | 'otherWork'
  | 'distance'
  | 'mismatch'
  | 'other';

export const rejectReasons: readonly { key: RejectReasonKey; label: string }[] =
  [
    { key: 'schedule', label: '일정이 맞지 않습니다' },
    { key: 'otherWork', label: '이미 다른 작업이 있습니다' },
    { key: 'distance', label: '작업 위치가 너무 멉니다' },
    { key: 'mismatch', label: '작업 내용이 맞지 않습니다' },
    { key: 'other', label: '기타' },
  ];

export type RejectionValidation =
  | { ok: true; reason: string }
  | { ok: false; error: 'select' | 'otherText' };

export function validateRejection(
  key: RejectReasonKey | null,
  otherText: string,
): RejectionValidation {
  if (key === null) {
    return { ok: false, error: 'select' };
  }
  if (key === 'other') {
    const text = otherText.trim();
    return text
      ? { ok: true, reason: text }
      : { ok: false, error: 'otherText' };
  }
  const reason = rejectReasons.find(item => item.key === key);
  return { ok: true, reason: reason ? reason.label : key };
}
