import type { CompletedWork, YearMonth } from '../../history/model';
import {
  formatCardDay,
  type ConfirmedSchedule,
  type PendingRequest,
} from '../../schedule/model';
import { mondayWeek, type CurrentWork, type ScheduleItem } from '../model';
import {
  EMPTY_VALUE,
  joinAddress,
  localDateKey,
  localTime,
  workStatusChip,
} from './convert';
import { MissingAssignmentError } from './errors';
import type {
  AcceptWorkCommand,
  HistoryWork,
  Period,
  ScheduledWork,
  WorkStatusCode,
} from './types';

// 저장소의 목록 결과 → 화면 행, 화면이 묻는 조회 구간. 날짜는 기기 현지 날짜다

const DAY_MS = 24 * 60 * 60 * 1000;
/** 서버 조회 구간 최대 길이 (31일) */
const MAX_PERIOD_MS = 31 * DAY_MS;

const atMidnight = (year: number, month: number, day: number) =>
  new Date(year, month, day);

// 일광 절약 시간이 끝나는 달은 31일에 한 시간이 더해져 서버 한도를 넘으므로 31일로 자른다
function period(from: Date, to: Date): Period {
  const end = Math.min(to.getTime(), from.getTime() + MAX_PERIOD_MS);
  return { from: from.toISOString(), to: new Date(end).toISOString() };
}

/** 그 날이 속한 주(월~일). 내 작업 홈의 이번 주 일정 */
export function weekPeriod(date: Date): Period {
  const [monday] = mondayWeek(date);
  return period(
    monday,
    atMidnight(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7),
  );
}

/** 그 달 (month 는 0부터). 내 일정 달력·작업 이력 */
export function monthPeriod({ year, month }: YearMonth): Period {
  return period(atMidnight(year, month, 1), atMidnight(year, month + 1, 1));
}

const shortDate = (date: Date) => `${date.getMonth() + 1}. ${date.getDate()}.`;

/** 내 작업 홈 일정 줄의 주 (예: 9. 14. – 9. 20.) */
export function homeWeekLabel(today: Date): string {
  const week = mondayWeek(today);
  return `${shortDate(week[0])} – ${shortDate(week[6])}`;
}

const timeRange = (work: { startTime: string; endTime: string }) =>
  `${localTime(work.startTime)} - ${localTime(work.endTime)}`;

const addressOf = (work: {
  customerAddress: string | null;
  customerAddressDetail: string | null;
}) =>
  joinAddress(work.customerAddress, work.customerAddressDetail) ?? EMPTY_VALUE;

// 예정 시간 안인 작업전: 예정 시작부터 예정 종료 정각까지 (서버가 시작을 받는 끝도 예정 종료 정각이다)
const isScheduledAt = (work: ScheduledWork, now: number) =>
  work.status === 'ACCEPTED' &&
  Date.parse(work.startTime) <= now &&
  now <= Date.parse(work.endTime);

/**
 * 홈 상단 히어로의 작업: 지금 시각에 진행 중인 작업만 (#205). 둘 다 가장 이른 것.
 * - 작업중(기사가 시작함): 시각과 관계없이 완료 보고 전까지 (예정 종료가 지나도 남는다)
 * - 없으면 예정 시작 ≤ 지금 ≤ 예정 종료인 작업전 ('메인화면 - 시작 가능'). 시작 전이면 오늘 작업이어도 없다 ('메인화면 - 진행(무)')
 */
export function pickCurrentWork(
  works: readonly ScheduledWork[],
  now: Date,
): ScheduledWork | undefined {
  const byStart = [...works].sort(
    (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
  );
  const inProgress = byStart.find(work => work.status === 'IN_PROGRESS');
  if (inProgress) {
    return inProgress;
  }
  return byStart.find(work => isScheduledAt(work, now.getTime()));
}

/**
 * now 뒤에 pickCurrentWork 의 답이 시각 때문에 바뀔 수 있는 가장 이른 시각 (ms, now 보다 크다):
 * 작업전의 예정 시작, 예정 종료 바로 뒤. 작업중인 작업이 있으면 시각으로는 바뀌지 않아 없다
 */
export function nextCurrentWorkChange(
  works: readonly ScheduledWork[],
  now: number,
): number | undefined {
  if (works.some(work => work.status === 'IN_PROGRESS')) {
    return undefined;
  }
  const boundaries = works
    .filter(work => work.status === 'ACCEPTED')
    .flatMap(work => [Date.parse(work.startTime), Date.parse(work.endTime) + 1])
    .filter(at => at > now);
  return boundaries.length > 0 ? Math.min(...boundaries) : undefined;
}

export function toCurrentWork(work: ScheduledWork): CurrentWork {
  return {
    id: String(work.workId),
    title: work.name,
    timeRange: timeRange(work),
    customerName: work.customerName ?? EMPTY_VALUE,
    address: addressOf(work),
  };
}

export function toScheduleItem(work: ScheduledWork, today: Date): ScheduleItem {
  return {
    id: String(work.workId),
    dateKey: localDateKey(work.startTime),
    title: work.name,
    status: workStatusChip(work.status, work.delayed).status,
    timeRange: timeRange(work),
    // 내 일정 카드와 같은 표기 ('오늘 · 9. 19. (토)')
    dayLabel: formatCardDay(localDateKey(work.startTime), today),
    company: work.organizationName ?? EMPTY_VALUE,
    customerName: work.customerName ?? EMPTY_VALUE,
    address: addressOf(work),
  };
}

function toConfirmedSchedule(work: ScheduledWork): ConfirmedSchedule {
  return {
    id: String(work.workId),
    dateKey: localDateKey(work.startTime),
    title: work.name,
    status: workStatusChip(work.status, work.delayed).status,
    timeRange: timeRange(work),
    company: work.organizationName ?? EMPTY_VALUE,
    customerName: work.customerName ?? EMPTY_VALUE,
    address: addressOf(work),
  };
}

// 여러 구간(달)을 합치면 경계에 걸친 작업이 두 번 온다
function uniqueWith(
  works: readonly ScheduledWork[],
  statuses: readonly WorkStatusCode[],
) {
  const seen = new Set<number>();
  return works.filter(work => {
    if (!statuses.includes(work.status) || seen.has(work.workId)) {
      return false;
    }
    seen.add(work.workId);
    return true;
  });
}

/** 확정 일정: 수락한 뒤의 작업 (작업전·작업중·완료) */
export function confirmedOf(
  works: readonly ScheduledWork[],
): ConfirmedSchedule[] {
  return uniqueWith(works, ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED']).map(
    toConfirmedSchedule,
  );
}

/** 응답 필요: 수락을 기다리는 요청 */
export function pendingOf(works: readonly ScheduledWork[]): PendingRequest[] {
  return uniqueWith(works, ['PENDING_ACCEPT']).map(toConfirmedSchedule);
}

export function toCompletedWork(work: HistoryWork): CompletedWork {
  return {
    id: String(work.workId),
    title: work.name,
    dateKey: localDateKey(work.startTime),
    start: localTime(work.startTime),
    end: localTime(work.endTime),
    company: work.organizationName ?? EMPTY_VALUE,
    customerName: work.customerName ?? EMPTY_VALUE,
    address: addressOf(work),
  };
}

/** 응답 필요 목록의 요청을 수락하는 Command. 목록에 없으면(그사이 처리됨) 보낼 배정 순번을 몰라 볼 수 없는 작업 오류다 */
export function acceptCommandOf(
  works: readonly ScheduledWork[],
  id: string,
): AcceptWorkCommand {
  const work = works.find(item => String(item.workId) === id);
  if (!work) {
    throw new MissingAssignmentError();
  }
  return { workId: work.workId, assignmentNumber: work.assignmentNumber };
}
