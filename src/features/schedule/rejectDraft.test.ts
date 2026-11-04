import { appStorage, writeJson } from '../../shared/storage/appStorage';
import {
  clearAllRejectDrafts,
  clearRejectDraft,
  loadRejectDraft,
  saveRejectDraft,
} from './rejectDraft';

describe('거절 사유 초안', () => {
  it('고른 사유와 직접 입력한 글을 같은 요청으로 다시 읽는다', () => {
    saveRejectDraft('request-1', { selected: 'other', otherText: '차량 고장' });

    expect(loadRejectDraft('request-1')).toEqual({
      selected: 'other',
      otherText: '차량 고장',
    });
    expect(loadRejectDraft('request-2')).toBeUndefined();
  });

  it('다른 사유로 바꿔도 직접 입력한 글은 남긴다 (화면과 같다)', () => {
    saveRejectDraft('request-1', {
      selected: 'distance',
      otherText: '차량 고장',
    });

    expect(loadRejectDraft('request-1')).toEqual({
      selected: 'distance',
      otherText: '차량 고장',
    });
  });

  // 고른 사유를 다시 눌러 풀어도 쓴 글은 남긴다 (#101)
  it('선택을 풀고 쓴 글만 남았으면 선택 없이 글을 남긴다', () => {
    saveRejectDraft('request-1', { selected: 'other', otherText: '차량 고장' });
    saveRejectDraft('request-1', { selected: null, otherText: '차량 고장' });

    expect(loadRejectDraft('request-1')).toEqual({
      selected: null,
      otherText: '차량 고장',
    });
  });

  it('아무것도 고르거나 쓰지 않았으면 지운다', () => {
    saveRejectDraft('request-1', { selected: 'schedule', otherText: '' });
    saveRejectDraft('request-1', { selected: null, otherText: '' });

    expect(loadRejectDraft('request-1')).toBeUndefined();
    expect(appStorage.getAllKeys()).toEqual([]);
  });

  it('제출하거나 화면을 나가면 지운다', () => {
    saveRejectDraft('request-1', { selected: 'schedule', otherText: '' });
    clearRejectDraft('request-1');

    expect(loadRejectDraft('request-1')).toBeUndefined();
  });

  it.each([
    ['없는 사유', { selected: 'weather', otherText: '' }],
    ['글이 문자열이 아님', { selected: 'other', otherText: 3 }],
    ['사유가 없음', { otherText: '' }],
    ['객체가 아님', 'other'],
  ])('모양이 다른 초안은 버린다: %s', (_name, value) => {
    writeJson('schedule.rejectDraft.request-1', value);

    expect(loadRejectDraft('request-1')).toBeUndefined();
    expect(appStorage.getAllKeys()).toEqual([]);
  });

  // #113: 공용 기기에서 다음 계정에 앞 계정이 고르던 사유가 열리지 않게 로그아웃·탈퇴·세션 만료 때 모두 지운다
  it('로그아웃하면 모든 요청의 초안을 지우고 다른 값은 남긴다', () => {
    saveRejectDraft('request-1', { selected: 'other', otherText: '차량 고장' });
    saveRejectDraft('request-2', { selected: 'schedule', otherText: '' });
    appStorage.set('work.reportDraft.w1', '{}');

    clearAllRejectDrafts();

    expect(loadRejectDraft('request-1')).toBeUndefined();
    expect(loadRejectDraft('request-2')).toBeUndefined();
    expect(appStorage.getAllKeys()).toEqual(['work.reportDraft.w1']);
  });
});
