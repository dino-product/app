import {
  appStorage,
  isRecord,
  readJson,
  writeJson,
} from '../../shared/storage/appStorage';
import {
  rejectReasons,
  type RejectReasonDraft,
  type RejectReasonKey,
} from './model';

// 거절 사유 화면에서 고르던 것 (#34). 앱이 종료돼도 같은 요청의 화면을 다시 열면 이어 고르도록 요청 id 별로 기기에 둔다.
// 제출하거나 화면을 나가면 지운다
const draftKey = (requestId: string) => `schedule.rejectDraft.${requestId}`;

export function loadRejectDraft(
  requestId: string,
): RejectReasonDraft | undefined {
  return readJson(draftKey(requestId), parseDraft);
}

/** 고른 사유도 쓴 글도 없으면 남길 것이 없어 지운다 */
export function saveRejectDraft(requestId: string, draft: RejectReasonDraft) {
  if (draft.selected === null && draft.otherText === '') {
    clearRejectDraft(requestId);
  } else {
    writeJson(draftKey(requestId), draft);
  }
}

export function clearRejectDraft(requestId: string) {
  appStorage.remove(draftKey(requestId));
}

const isReasonKey = (value: unknown): value is RejectReasonKey =>
  rejectReasons.some(reason => reason.key === value);

function parseDraft(value: unknown): RejectReasonDraft | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { selected, otherText } = value;
  if (
    (selected !== null && !isReasonKey(selected)) ||
    typeof otherText !== 'string'
  ) {
    return undefined;
  }
  return { selected, otherText };
}
