import { appStorage } from '../../shared/storage/appStorage';

/** 내 일정 날짜 보기: 주간 줄 / 펼친 달력(월간) */
export type ScheduleCalendarView = 'week' | 'month';

// 마지막으로 고른 내 일정 보기 (#222). 홈 일정 보기(#147, work.homeView)와 같은 방식으로 기기에 남겨,
// 다른 탭·화면에 갔다 오거나 앱을 다시 열어도 그 보기로 연다. 고른 날·보이는 달은 남기지 않는다(다시 열면 오늘).
// 계정 데이터가 아니라 이 기기의 화면 설정이라 로그아웃·탈퇴·세션 만료에도 지우지 않는다.
// 로그아웃 때 지우는 거절 사유 초안(schedule.rejectDraft.*)과 접두어가 겹치지 않는다
export const SCHEDULE_VIEW_KEY = 'schedule.calendarView';

/** 처음 설치(저장한 보기 없음)면 주간 보기로 연다 (Figma 3754:6269 기본) */
const DEFAULT_VIEW: ScheduleCalendarView = 'week';

const isScheduleCalendarView = (
  value: unknown,
): value is ScheduleCalendarView => value === 'week' || value === 'month';

/** 저장한 보기. 없으면 주간, 깨졌으면(모르는 값·글자가 아닌 값) 지우고 주간 */
export function loadScheduleView(): ScheduleCalendarView {
  const saved = appStorage.getString(SCHEDULE_VIEW_KEY);
  if (isScheduleCalendarView(saved)) {
    return saved;
  }
  if (appStorage.contains(SCHEDULE_VIEW_KEY)) {
    appStorage.remove(SCHEDULE_VIEW_KEY);
  }
  return DEFAULT_VIEW;
}

export function saveScheduleView(view: ScheduleCalendarView): void {
  appStorage.set(SCHEDULE_VIEW_KEY, view);
}
