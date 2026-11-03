import { workStatusLabels } from '../../shared/design-system';
import { WEEKDAYS } from '../schedule/model';

// 작업 이력 화면의 데이터 모양과 표기. API 가 붙으면 응답을 이 타입으로 변환해 넣는다.

export type CompletedWork = {
  id: string;
  title: string;
  /** 작업한 날 YYYY-MM-DD */
  dateKey: string;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
  company: string;
  customerName: string;
  address: string;
};

/** month 는 Date 처럼 0(1월)부터 */
export type YearMonth = { year: number; month: number };

const pad2 = (value: number) => String(value).padStart(2, '0');

export function monthOf(date: Date): YearMonth {
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function isBeforeMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year * 12 + a.month < b.year * 12 + b.month;
}

/** 그 달에 완료한 작업. 최근에 완료한 작업이 위에 온다 */
export function completedInMonth(
  works: readonly CompletedWork[],
  { year, month }: YearMonth,
): CompletedWork[] {
  const prefix = `${year}-${pad2(month + 1)}-`;
  // 날짜와 시각이 모두 0 을 채운 숫자라 문자열 비교로 시간순이 된다
  const order = (work: CompletedWork) => `${work.dateKey} ${work.start}`;
  return works
    .filter(work => work.dateKey.startsWith(prefix))
    .sort((a, b) => order(b).localeCompare(order(a)));
}

/** YYYY-MM-DD 를 그 날 0시로 */
export const parseDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** 목록 행의 날짜·시간 (예: 2026.09.26 (토) 08:00 - 09:00) */
export function formatWorkTime(work: CompletedWork): string {
  const date = parseDate(work.dateKey);
  return `${work.dateKey.replaceAll('-', '.')} (${WEEKDAYS[date.getDay()]}) ${
    work.start
  } - ${work.end}`;
}

const parseTime = (time: string) => time.split(':').map(Number);
const periodOf = (hour: number) => (hour < 12 ? '오전' : '오후');
const spokenClock = (hour: number, minute: number) =>
  `${hour % 12 || 12}시${minute ? ` ${minute}분` : ''}`;

/** 스크린리더용 시간 범위 (예: 오전 8시부터 9시). 끝 시각은 오전·오후가 바뀔 때만 붙인다 */
export function spokenTimeRange(start: string, end: string): string {
  const [startHour, startMinute] = parseTime(start);
  const [endHour, endMinute] = parseTime(end);
  const endPeriod =
    periodOf(endHour) === periodOf(startHour) ? '' : `${periodOf(endHour)} `;
  return `${periodOf(startHour)} ${spokenClock(
    startHour,
    startMinute,
  )}부터 ${endPeriod}${spokenClock(endHour, endMinute)}`;
}

/** 행 하나를 버튼 하나로 읽을 때의 레이블 */
export function completedWorkA11yLabel(work: CompletedWork): string {
  const date = parseDate(work.dateKey);
  const day = `${date.getFullYear()}년 ${
    date.getMonth() + 1
  }월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`;
  return [
    work.title,
    workStatusLabels.completed,
    `${day} ${spokenTimeRange(work.start, work.end)}`,
    work.company,
    work.customerName,
    work.address,
  ].join(', ');
}
