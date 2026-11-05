import { clearAllRejectDrafts } from '../features/schedule/rejectDraft';
import { clearAllReportDrafts } from '../features/work/reportDraft';
import { appStorage } from '../shared/storage/appStorage';

// 예시(더미) 작업으로 작업 화면을 채우던 빌드(TestFlight 0.0 (3) 까지)를 쓴 기기에는 예시 작업 id(1~13, 101~106)를 가리키는
// 작성 중 초안(완료 보고·거절 사유, #34)이 남아 있다 (#136). 그 화면을 열 때만 지우면 로그아웃 때까지 남아,
// 기사 작업 API(#112)로 바꾼 뒤 같은 id 의 실제 작업 보고 칸에 채워질 수 있다.
// 지금 운영 저장소에는 실제 작업이 없어 남은 초안은 모두 예시의 것이다. 켤 때 한 번 모두 지우고 표식을 남겨 다음부터는 지우지 않는다

/** 예시 초안을 지운 기기의 표식. 로그아웃·탈퇴가 지우는 초안 키(…Draft…)와 겹치지 않는다 */
export const SAMPLE_DRAFTS_CLEARED_KEY = 'app.sampleWorkCleared';

export function clearSampleDraftsOnce() {
  if (appStorage.getBoolean(SAMPLE_DRAFTS_CLEARED_KEY)) {
    return;
  }
  clearAllReportDrafts();
  clearAllRejectDrafts();
  appStorage.set(SAMPLE_DRAFTS_CLEARED_KEY, true);
}
