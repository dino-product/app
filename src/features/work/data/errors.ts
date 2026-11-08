import { isApiError } from '../../../shared/api';

// 작업 데이터 오류. 화면은 HTTP 상태보다 code 로 나눈다 (ScheduleErrorCode, api-spec.md §2.4)

export const WorkErrorCode = {
  /** 404 작업 없음 (다른 조직·기사가 볼 수 없는 작업 포함) */
  notFound: 'SCHEDULE-001',
  /** 409 지금 상태에서 할 수 없음 (같은 요청 재전송은 성공) */
  invalidState: 'SCHEDULE-002',
  /** 400 요청 값 오류 (id·구간·길이 등) */
  invalidInput: 'SCHEDULE-003',
  /** 403 그 조직의 활성 구성원이 아님 */
  notMember: 'SCHEDULE-004',
  /** 403 그 순번의 배정이 없거나 본인 배정이 아님 */
  notAssignee: 'SCHEDULE-009',
  /** 409 배정이 바뀜 → 상세를 다시 받아 순번을 갱신한다 */
  assignmentChanged: 'SCHEDULE-010',
  /** 409 예정 시작 10분 전보다 이름 */
  tooEarlyToStart: 'SCHEDULE-017',
  /** 409 예정 종료가 지남 */
  startTimePassed: 'SCHEDULE-018',
  /** 409 같은 작업을 동시에 바꾼 다른 요청과 저장이 겹침. 서버가 한 번 다시 처리하고도 겹쳤다 (HM-371) → 다시 조회 뒤 재시도 */
  workChanged: 'SCHEDULE-016',
  /** 400 업로드를 마치지 않았거나 쓸 수 없는 사진 (올린 지 1일이 지나 저장소가 지운 사진 포함) → 사진을 새로 올린다 */
  photoNotUploaded: 'SCHEDULE-022',
} as const;

/**
 * 완료 보고 사진을 올리지 못함. unreadable: 기기 파일을 읽지 못함(OS 가 임시 파일을 지움 등),
 * failed: 저장소 PUT 이 거부·네트워크 오류·제한 시간 초과. 업로드 주소 발급 실패는 서버 오류(ApiError) 그대로다
 */
export class PhotoUploadError extends Error {
  readonly reason: 'unreadable' | 'failed';

  constructor(reason: 'unreadable' | 'failed') {
    super(
      reason === 'unreadable'
        ? '완료 보고 사진 파일을 읽지 못했다'
        : '완료 보고 사진을 저장소에 올리지 못했다',
    );
    this.name = 'PhotoUploadError';
    this.reason = reason;
  }
}

/** 소속 목록에 활성 기사 소속이 없어 작업 API 경로의 발주사를 정하지 못함 */
export class NoTechnicianOrganizationError extends Error {
  constructor() {
    super('활성 기사 소속이 없다');
    this.name = 'NoTechnicianOrganizationError';
  }
}

/** 작업에 지금 배정(순번)이 없어 기사 명령을 보낼 수 없음. 기사에게 보이는 작업에는 늘 있어 볼 수 없는 작업으로 본다 */
export class MissingAssignmentError extends Error {
  constructor() {
    super('지금 배정이 없다');
    this.name = 'MissingAssignmentError';
  }
}

/** 다시 시도해도 볼 수 없는 작업 (404 SCHEDULE-001, 403 SCHEDULE-004, 기사 소속 없음, 배정 없음) */
export function isUnavailableWork(error: unknown): boolean {
  return (
    error instanceof NoTechnicianOrganizationError ||
    error instanceof MissingAssignmentError ||
    isApiError(error, WorkErrorCode.notFound) ||
    isApiError(error, WorkErrorCode.notMember)
  );
}

/**
 * 작업이 없다고 답했다 (404 SCHEDULE-001, 로컬 저장소도 같은 오류). 볼 수 없는 작업 가운데 이것만 기기에 남은 초안을 지운다 (#136).
 * 소속 문제(403 SCHEDULE-004·기사 소속 없음)는 소속이 잠시 비활성일 수 있어 지우지 않는다
 */
export function isMissingWork(error: unknown): boolean {
  return isApiError(error, WorkErrorCode.notFound);
}

/** 서버의 작업이 화면과 달라졌다(배정·상태가 바뀜, 동시 변경과 겹침). 화면의 조회를 새로 받는다 */
export function shouldRefetchAfter(error: unknown): boolean {
  return (
    isApiError(error, WorkErrorCode.assignmentChanged) ||
    isApiError(error, WorkErrorCode.invalidState) ||
    isApiError(error, WorkErrorCode.workChanged)
  );
}

const REFRESHED = '최신 정보를 다시 불러왔으니 확인해 주세요.';

const messages: Partial<Record<string, string>> = {
  [WorkErrorCode.tooEarlyToStart]:
    '아직 시작할 수 없어요. 예정 시작 10분 전부터 시작할 수 있어요.',
  [WorkErrorCode.startTimePassed]:
    '예정 종료 시각이 지나 시작할 수 없어요. 사무실에 일정 변경을 요청해 주세요.',
  [WorkErrorCode.assignmentChanged]: `배정이 바뀌었어요. ${REFRESHED}`,
  [WorkErrorCode.invalidState]: `작업 상태가 바뀌어 처리하지 못했어요. ${REFRESHED}`,
  [WorkErrorCode.workChanged]: `같은 작업이 동시에 바뀌어 처리하지 못했어요. ${REFRESHED}`,
  [WorkErrorCode.photoNotUploaded]:
    '올린 사진을 쓸 수 없어 다시 올려야 해요. 다시 제출해 주세요.',
};

const photoUploadMessages: Record<PhotoUploadError['reason'], string> = {
  unreadable: '사진 파일을 읽지 못했어요. 그 사진을 지우고 다시 추가해 주세요.',
  failed: '사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/** 기사 명령 (상태가 맞지 않음 문구를 명령마다 다르게 쓴다) */
export type WorkCommand = 'accept' | 'reject' | 'start' | 'submit';

// 서버 상태가 그 명령을 받을 수 없다(-002). 같은 요청 재전송은 성공하므로 상태가 실제로 다르다는 뜻이다
const invalidStateMessages: Record<WorkCommand, string> = {
  accept: `이미 처리됐거나 바뀐 요청이라 수락하지 못했어요. ${REFRESHED}`,
  reject: `이미 처리됐거나 바뀐 요청이라 거절하지 못했어요. ${REFRESHED}`,
  start: `수락한 작업(작업전)만 시작할 수 있어요. ${REFRESHED}`,
  submit: `작업중인 작업만 완료 보고를 낼 수 있어요. ${REFRESHED}`,
};

export const UNAVAILABLE_WORK_MESSAGE = '볼 수 없는 작업이에요.';
const UNKNOWN_MESSAGE = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';

/** 사용자에게 보일 문구. 상황별 코드는 정한 문구, 그 밖의 서버·네트워크 오류는 ApiError 문구. command 는 변경 실패일 때 */
export function workErrorMessage(
  error: unknown,
  command?: WorkCommand,
): string {
  if (isUnavailableWork(error)) {
    return UNAVAILABLE_WORK_MESSAGE;
  }
  if (error instanceof PhotoUploadError) {
    return photoUploadMessages[error.reason];
  }
  if (command && isApiError(error, WorkErrorCode.invalidState)) {
    return invalidStateMessages[command];
  }
  if (isApiError(error)) {
    return (error.code && messages[error.code]) || error.message;
  }
  return UNKNOWN_MESSAGE;
}
