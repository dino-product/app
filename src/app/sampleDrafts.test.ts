import {
  loadRejectDraft,
  saveRejectDraft,
} from '../features/schedule/rejectDraft';
import { emptyReport } from '../features/work/model';
import { loadReportDraft, saveReportDraft } from '../features/work/reportDraft';
import { appStorage } from '../shared/storage/appStorage';
import {
  clearSampleDraftsOnce,
  SAMPLE_DRAFTS_CLEARED_KEY,
} from './sampleDrafts';

const report = { ...emptyReport, memo: '배관 교체' };
const reject = { selected: 'schedule' as const, otherText: '' };

describe('clearSampleDraftsOnce (#136)', () => {
  it('표식이 없으면 완료 보고·거절 사유 초안을 모두 지우고 표식을 남긴다 (다른 값은 그대로다)', () => {
    saveReportDraft('101', report);
    saveReportDraft('1', report);
    saveRejectDraft('104', reject);
    appStorage.set('navigation.state', '{}');

    clearSampleDraftsOnce();

    expect(loadReportDraft('101')).toBeUndefined();
    expect(loadReportDraft('1')).toBeUndefined();
    expect(loadRejectDraft('104')).toBeUndefined();
    expect(appStorage.getAllKeys().sort()).toEqual(
      ['navigation.state', SAMPLE_DRAFTS_CLEARED_KEY].sort(),
    );
  });

  it('표식이 있으면 지우지 않는다: 두 번째 실행에서 새로 쓴 초안은 남는다', () => {
    clearSampleDraftsOnce();
    saveReportDraft('7', report);
    saveRejectDraft('8', reject);

    clearSampleDraftsOnce();

    expect(loadReportDraft('7')).toEqual(report);
    expect(loadRejectDraft('8')).toEqual(reject);
  });

  // 로그아웃·탈퇴의 초안 검사(키 이름에 Draft 가 든 값)에 표식이 섞이지 않는다
  it('표식 키는 초안 키가 아니다', () => {
    expect(SAMPLE_DRAFTS_CLEARED_KEY).not.toContain('Draft');
  });
});
