import { appStorage } from '../../shared/storage/appStorage';

/** 홈 일정 보기: 이번 주 목록 / 날짜 칸으로 고른 날 (블록) */
export type ScheduleView = 'list' | 'block';

// 마지막으로 고른 홈 일정 보기 (#147). 기사마다 선호가 달라 기기에 남겨 다음에 켤 때도 그 보기로 연다.
// 계정 데이터가 아니라 이 기기의 화면 설정이라 로그아웃·탈퇴·세션 만료에도 지우지 않는다 (AuthProvider 는 초안·보던 화면만 지운다)
export const HOME_VIEW_KEY = 'work.homeView';

/** 처음 설치(저장한 보기 없음)면 블록 보기로 연다 */
const DEFAULT_VIEW: ScheduleView = 'block';

const isScheduleView = (value: unknown): value is ScheduleView =>
  value === 'list' || value === 'block';

/** 저장한 보기. 없으면 블록 보기, 깨졌으면(모르는 값·글자가 아닌 값) 지우고 블록 보기 */
export function loadHomeView(): ScheduleView {
  const saved = appStorage.getString(HOME_VIEW_KEY);
  if (isScheduleView(saved)) {
    return saved;
  }
  if (appStorage.contains(HOME_VIEW_KEY)) {
    appStorage.remove(HOME_VIEW_KEY);
  }
  return DEFAULT_VIEW;
}

export function saveHomeView(view: ScheduleView): void {
  appStorage.set(HOME_VIEW_KEY, view);
}
