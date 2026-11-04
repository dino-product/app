import {
  appStorage,
  isRecord,
  readJson,
  writeJson,
} from '../../shared/storage/appStorage';
import {
  hasReportInput,
  paymentMethodLabels,
  PHOTO_LIMIT,
  type PaymentMethod,
  type WorkReport,
} from './model';

// 작성 중인 완료 보고 (#34). 전화·지도·카메라 앱에 다녀오는 사이 앱이 종료돼도 이어 쓰도록 작업 id 별로 기기에 둔다.
// 제출하거나 나가기로 확정하면(#24) 지운다. 사진은 촬영·앨범이 남긴 임시 파일의 경로만 남긴다.
// 다시 열 때 OS 가 그 파일을 지웠으면 썸네일이 회색 자리로 보이고 지울 수 있다 (#111, PhotoThumb)
const DRAFT_KEY_PREFIX = 'work.reportDraft.';
const draftKey = (workId: string) => `${DRAFT_KEY_PREFIX}${workId}`;

export function loadReportDraft(workId: string): WorkReport | undefined {
  return readJson(draftKey(workId), parseReport);
}

/** 입력이 하나도 없으면(공백만 쓴 메모 포함) 남길 것이 없어 지운다 */
export function saveReportDraft(workId: string, report: WorkReport) {
  if (hasReportInput(report)) {
    writeJson(draftKey(workId), report);
  } else {
    clearReportDraft(workId);
  }
}

/** 모든 완료 보고 초안을 지운다. 로그아웃·탈퇴·세션 만료 때 다음 계정에 앞 계정의 초안이 열리지 않게 한다 (#113) */
export function clearAllReportDrafts() {
  appStorage
    .getAllKeys()
    .filter(key => key.startsWith(DRAFT_KEY_PREFIX))
    .forEach(key => appStorage.remove(key));
}

export function clearReportDraft(workId: string) {
  appStorage.remove(draftKey(workId));
}

const isPhotos = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= PHOTO_LIMIT &&
  value.every(item => typeof item === 'string');

const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  typeof value === 'string' && Object.keys(paymentMethodLabels).includes(value);

function parseReport(value: unknown): WorkReport | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { beforePhotos, afterPhotos, memo, parts, amount, paymentMethod } =
    value;
  if (
    !isPhotos(beforePhotos) ||
    !isPhotos(afterPhotos) ||
    typeof memo !== 'string' ||
    typeof parts !== 'string' ||
    // 입력칸은 숫자만 담는다 (AmountInput)
    typeof amount !== 'string' ||
    !/^\d*$/.test(amount) ||
    (paymentMethod !== null && !isPaymentMethod(paymentMethod))
  ) {
    return undefined;
  }
  return { beforePhotos, afterPhotos, memo, parts, amount, paymentMethod };
}
