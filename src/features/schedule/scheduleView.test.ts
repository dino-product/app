import { appStorage } from '../../shared/storage/appStorage';
import { clearAllRejectDrafts } from './rejectDraft';
import {
  loadScheduleView,
  saveScheduleView,
  SCHEDULE_VIEW_KEY,
} from './scheduleView';

describe('내 일정 보기 저장 (#222)', () => {
  it('저장 키는 schedule.calendarView 다', () => {
    saveScheduleView('month');

    expect(appStorage.getString('schedule.calendarView')).toBe('month');
    expect(SCHEDULE_VIEW_KEY).toBe('schedule.calendarView');
  });

  it('저장한 적이 없으면(처음 설치) 주간 보기다', () => {
    expect(loadScheduleView()).toBe('week');
  });

  it.each(['week', 'month'] as const)(
    '%s 보기를 저장하면 다음에 그 보기를 읽는다',
    view => {
      saveScheduleView(view);

      expect(loadScheduleView()).toBe(view);
    },
  );

  it('모르는 값(앱 업데이트 전 이름 등)은 주간 보기로 읽고 지운다', () => {
    appStorage.set(SCHEDULE_VIEW_KEY, 'year');

    expect(loadScheduleView()).toBe('week');
    expect(appStorage.contains(SCHEDULE_VIEW_KEY)).toBe(false);
  });

  it('글자가 아닌 값으로 깨졌으면 주간 보기로 읽고 지운다', () => {
    appStorage.set(SCHEDULE_VIEW_KEY, true);

    expect(loadScheduleView()).toBe('week');
    expect(appStorage.contains(SCHEDULE_VIEW_KEY)).toBe(false);
  });

  // 같은 schedule. 접두어의 거절 사유 초안은 로그아웃 때 지운다. 보기는 기기 화면 설정이라 남는다
  it('거절 사유 초안을 모두 지워도 보기는 남는다', () => {
    saveScheduleView('month');

    clearAllRejectDrafts();

    expect(loadScheduleView()).toBe('month');
  });
});
