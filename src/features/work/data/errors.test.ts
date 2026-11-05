import { ApiError, ApiErrorMessage } from '../../../shared/api';
import {
  isMissingWork,
  isUnavailableWork,
  MissingAssignmentError,
  NoTechnicianOrganizationError,
  shouldRefetchAfter,
  UnsupportedWorkOperationError,
  workErrorMessage,
} from './errors';

const scheduleError = (status: number, code: string) =>
  new ApiError({ kind: 'http', status, code, message: '서버 문구' });

describe('isUnavailableWork', () => {
  it.each([
    ['SCHEDULE-001(404, 볼 수 없는 작업)', scheduleError(404, 'SCHEDULE-001')],
    ['SCHEDULE-004(403, 조직 구성원 아님)', scheduleError(403, 'SCHEDULE-004')],
    ['기사 발주사가 없음', new NoTechnicianOrganizationError()],
    ['지금 배정이 없음', new MissingAssignmentError()],
  ])('%s 는 볼 수 없는 작업이다', (_, error) => {
    expect(isUnavailableWork(error)).toBe(true);
  });

  it.each([
    ['서버 오류', scheduleError(500, 'COMMON-500')],
    ['네트워크', new ApiError({ kind: 'network', message: 'x' })],
    ['다른 오류', new Error('x')],
  ])('%s 는 다시 시도할 오류다', (_, error) => {
    expect(isUnavailableWork(error)).toBe(false);
  });
});

// #136 남은 초안을 지워도 되는지: 작업이 없다고 답한 것만. 소속 문제는 잠시일 수 있다
describe('isMissingWork', () => {
  it('SCHEDULE-001(404, 작업 없음) 은 없는 작업이다', () => {
    expect(isMissingWork(scheduleError(404, 'SCHEDULE-001'))).toBe(true);
  });

  it.each([
    ['SCHEDULE-004(403, 조직 구성원 아님)', scheduleError(403, 'SCHEDULE-004')],
    ['기사 발주사가 없음', new NoTechnicianOrganizationError()],
    ['지금 배정이 없음', new MissingAssignmentError()],
    ['서버 오류', scheduleError(500, 'COMMON-500')],
    ['네트워크', new ApiError({ kind: 'network', message: 'x' })],
  ])('%s 는 없는 작업이 아니다', (_, error) => {
    expect(isMissingWork(error)).toBe(false);
  });
});

describe('workErrorMessage', () => {
  it.each([
    [
      'SCHEDULE-017',
      '아직 시작할 수 없어요. 예정 시작 10분 전부터 시작할 수 있어요.',
    ],
    [
      'SCHEDULE-018',
      '예정 종료 시각이 지나 시작할 수 없어요. 사무실에 일정 변경을 요청해 주세요.',
    ],
    [
      'SCHEDULE-010',
      '배정이 바뀌었어요. 최신 정보를 다시 불러왔으니 확인해 주세요.',
    ],
    [
      'SCHEDULE-002',
      '작업 상태가 바뀌어 처리하지 못했어요. 최신 정보를 다시 불러왔으니 확인해 주세요.',
    ],
    ['SCHEDULE-001', '볼 수 없는 작업이에요.'],
    ['SCHEDULE-004', '볼 수 없는 작업이에요.'],
  ])('%s 는 그 상황 문구다', (code, message) => {
    expect(workErrorMessage(scheduleError(409, code))).toBe(message);
  });

  // 상태가 맞지 않음(-002)은 어떤 명령이었는지에 따라 다르게 알린다
  it.each([
    ['accept', '이미 처리됐거나 바뀐 요청이라 수락하지 못했어요.'],
    ['reject', '이미 처리됐거나 바뀐 요청이라 거절하지 못했어요.'],
    ['start', '수락한 작업(작업전)만 시작할 수 있어요.'],
    ['submit', '작업중인 작업만 완료 보고를 낼 수 있어요.'],
  ] as const)('%s 의 SCHEDULE-002 는 그 상황 문구다', (command, message) => {
    expect(workErrorMessage(scheduleError(409, 'SCHEDULE-002'), command)).toBe(
      `${message} 최신 정보를 다시 불러왔으니 확인해 주세요.`,
    );
  });

  it('네트워크·타임아웃은 토대의 문구다', () => {
    expect(
      workErrorMessage(
        new ApiError({ kind: 'network', message: ApiErrorMessage.network }),
      ),
    ).toBe(ApiErrorMessage.network);
    expect(
      workErrorMessage(
        new ApiError({ kind: 'timeout', message: ApiErrorMessage.timeout }),
      ),
    ).toBe(ApiErrorMessage.timeout);
  });

  it('그 밖의 서버 오류는 서버 문구를 보여 준다', () => {
    expect(workErrorMessage(scheduleError(500, 'COMMON-500'))).toBe(
      '서버 문구',
    );
  });

  it('아직 지원하지 않는 기능과 알 수 없는 오류', () => {
    expect(
      workErrorMessage(new UnsupportedWorkOperationError('getMySchedule')),
    ).toBe('아직 지원하지 않는 기능이에요.');
    expect(workErrorMessage(new Error('boom'))).toBe(
      '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
  });
});

describe('shouldRefetchAfter', () => {
  it('배정이 바뀌었거나(-010) 상태가 맞지 않으면(-002) 최신 정보를 다시 받는다', () => {
    expect(shouldRefetchAfter(scheduleError(409, 'SCHEDULE-010'))).toBe(true);
    expect(shouldRefetchAfter(scheduleError(409, 'SCHEDULE-002'))).toBe(true);
  });

  it('그 밖의 실패는 화면을 그대로 둔다', () => {
    expect(shouldRefetchAfter(scheduleError(409, 'SCHEDULE-017'))).toBe(false);
    expect(
      shouldRefetchAfter(new ApiError({ kind: 'network', message: 'x' })),
    ).toBe(false);
  });
});
