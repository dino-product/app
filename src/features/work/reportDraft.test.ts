import { appStorage, writeJson } from '../../shared/storage/appStorage';
import { emptyReport, type WorkReport } from './model';
import {
  clearAllReportDrafts,
  clearReportDraft,
  loadReportDraft,
  saveReportDraft,
} from './reportDraft';

const report: WorkReport = {
  beforePhotos: ['file:///before-1.jpg'],
  afterPhotos: [],
  memo: '배수 호스 교체',
  parts: '',
  amount: '75000',
  paymentMethod: 'card',
};

describe('완료 보고 초안', () => {
  it('저장한 초안을 같은 작업으로 다시 읽는다', () => {
    saveReportDraft('w1', report);

    expect(loadReportDraft('w1')).toEqual(report);
  });

  it('작업마다 따로 둔다', () => {
    saveReportDraft('w1', report);

    expect(loadReportDraft('w2')).toBeUndefined();
  });

  it('입력이 모두 비면 초안을 지운다', () => {
    saveReportDraft('w1', report);
    saveReportDraft('w1', { ...emptyReport, memo: '  ' });

    expect(loadReportDraft('w1')).toBeUndefined();
    expect(appStorage.getAllKeys()).toEqual([]);
  });

  it('제출하거나 나가기로 확정하면 지운다', () => {
    saveReportDraft('w1', report);
    clearReportDraft('w1');

    expect(loadReportDraft('w1')).toBeUndefined();
  });

  it.each([
    ['사진 목록이 아님', { ...report, beforePhotos: 'a.jpg' }],
    ['사진 경로가 문자열이 아님', { ...report, afterPhotos: [1] }],
    ['사진이 한도보다 많음', { ...report, beforePhotos: Array(7).fill('a') }],
    ['메모가 문자열이 아님', { ...report, memo: null }],
    ['부품이 없음', { ...report, parts: undefined }],
    ['금액에 숫자 아닌 글자', { ...report, amount: '7,500' }],
    ['없는 결제 방식', { ...report, paymentMethod: 'coupon' }],
    ['객체가 아님', ['memo']],
  ])('모양이 다른 초안은 버린다: %s', (_name, value) => {
    writeJson('work.reportDraft.w1', value);

    expect(loadReportDraft('w1')).toBeUndefined();
    expect(appStorage.getAllKeys()).toEqual([]);
  });

  // #113: 공용 기기에서 다음 계정에 앞 계정이 쓰던 보고가 열리지 않게 로그아웃·탈퇴·세션 만료 때 모두 지운다
  it('로그아웃하면 모든 작업의 초안을 지우고 다른 값은 남긴다', () => {
    saveReportDraft('w1', report);
    saveReportDraft('w2', report);
    appStorage.set('schedule.rejectDraft.r1', '{}');

    clearAllReportDrafts();

    expect(loadReportDraft('w1')).toBeUndefined();
    expect(loadReportDraft('w2')).toBeUndefined();
    expect(appStorage.getAllKeys()).toEqual(['schedule.rejectDraft.r1']);
  });
});
