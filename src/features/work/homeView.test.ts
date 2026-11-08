import { appStorage } from '../../shared/storage/appStorage';
import { HOME_VIEW_KEY, loadHomeView, saveHomeView } from './homeView';

describe('홈 일정 보기 저장 (#147)', () => {
  it('저장한 적이 없으면(처음 설치) 블록 보기다', () => {
    expect(loadHomeView()).toBe('block');
  });

  it.each(['list', 'block'] as const)(
    '%s 보기를 저장하면 다음에 그 보기를 읽는다',
    view => {
      saveHomeView(view);

      expect(loadHomeView()).toBe(view);
    },
  );

  it('모르는 값(앱 업데이트 전 이름 등)은 블록 보기로 읽고 지운다', () => {
    appStorage.set(HOME_VIEW_KEY, 'grid');

    expect(loadHomeView()).toBe('block');
    expect(appStorage.contains(HOME_VIEW_KEY)).toBe(false);
  });

  it('글자가 아닌 값으로 깨졌으면 블록 보기로 읽고 지운다', () => {
    appStorage.set(HOME_VIEW_KEY, 1);

    expect(loadHomeView()).toBe('block');
    expect(appStorage.contains(HOME_VIEW_KEY)).toBe(false);
  });
});
