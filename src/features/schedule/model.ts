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

/** 응답 필요 요청. 카드에 보이는 날짜는 dateKey 로 만든다 (formatCardDay) */
export type PendingRequest = ConfirmedSchedule;

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

/**
 * 일정 카드 시간 줄의 날짜 (YYYY-MM-DD). 오늘이면 '오늘 · 9. 19. (토)', 아니면 '9. 20. (일)' 이다.
 * Figma 내 일정 카드와 작업 홈 일정 카드가 같은 표기를 쓴다
 */
export function formatCardDay(dateKey: string, today: Date): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const label = `${month}. ${day}. (${WEEKDAYS[date.getDay()]})`;
  return dateKey === toDateKey(today) ? `오늘 · ${label}` : label;
}

export function formatMonthTitle(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** delta 주 앞뒤의 같은 요일 */
export function addWeeks(date: Date, delta: number): Date {
  return addDays(date, delta * 7);
}

/** 그 날이 속한 주의 일요일 0시 */
export function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

/** 그 날이 속한 주의 일요일~토요일 */
export function weekDays(date: Date): Date[] {
  const sunday = startOfWeek(date);
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

/** 날짜(YYYY-MM-DD)별 일정 개수. 달력의 일정 점 개수에 쓴다 */
export function countByDate(
  items: readonly { dateKey: string }[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const { dateKey } of items) {
    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
  }
  return counts;
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

/** 거절 사유 화면에서 고르고 쓴 것. 기타 글은 다른 사유로 바꿔도 남긴다 */
export type RejectReasonDraft = {
  selected: RejectReasonKey | null;
  otherText: string;
};

/** 서버로 보낼 거절. 메모는 기타일 때만 (서버 규칙) */
export type Rejection = { key: RejectReasonKey; note: string | null };

/** 기타 사유 최대 글자 수 (백엔드 Rejection.MAX_NOTE_LENGTH) */
export const REJECTION_NOTE_MAX_LENGTH = 255;

export type RejectionValidation =
  | ({ ok: true } & Rejection)
  | { ok: false; error: 'select' | 'otherText' };

/** 기타는 앞뒤 공백을 뗀 글이 있어야 하고 그 글을 메모로 보낸다. 다른 사유는 메모를 보내지 않는다 */
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
      ? { ok: true, key, note: text }
      : { ok: false, error: 'otherText' };
  }
  return { ok: true, key, note: null };
}
