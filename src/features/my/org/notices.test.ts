import { ApiError } from '../../../shared/api';
import {
  alreadyMemberNotice,
  cancelFailure,
  invalidCodeNotice,
  lookupFailureNotice,
  pendingRequestNotice,
  requestFailure,
} from './notices';
import { OrganizationErrorCode } from './participationApi';

const httpError = (status: number, code: string) =>
  new ApiError({ kind: 'http', status, code, message: '서버 문구' });
const networkError = new ApiError({ kind: 'network', message: '네트워크' });
const RETRY_LATER = '잠시 후 다시 시도해 주세요';

describe('lookupFailureNotice (회사 확인 실패)', () => {
  it('실패 한도(429 ORGANIZATION-018)면 잠시 후 다시 시도하라고 한다', () => {
    expect(
      lookupFailureNotice(
        httpError(429, OrganizationErrorCode.tooManyFailures),
      ),
    ).toEqual({
      title: RETRY_LATER,
      message: '없는 회사 코드를 여러 번 입력해\n잠시 회사를 확인할 수 없어요.',
    });
  });

  it.each([
    ['네트워크', networkError],
    ['서버 오류', httpError(500, 'COMMON-500')],
    ['ApiError 가 아님', new Error('boom')],
  ])('%s 는 확인하지 못했다고 하고 다시 시도하게 한다', (_, error) => {
    expect(lookupFailureNotice(error)).toEqual({
      title: '회사를 확인하지 못했어요',
      message: '잠시 후 다시 시도해 주세요.',
    });
  });
});

describe('requestFailure (참여 요청 실패 → 안내와 닫은 뒤 갈 곳)', () => {
  it('이미 참여 중(409 ORGANIZATION-013)이면 이미 참여 안내 뒤 소속 쪽으로 보낸다', () => {
    expect(
      requestFailure(
        httpError(409, OrganizationErrorCode.alreadyMember),
        'Orbit',
      ),
    ).toEqual({ next: 'alreadyMember', notice: alreadyMemberNotice('Orbit') });
  });

  it('승인 대기 요청이 있으면(409 ORGANIZATION-014) 승인 대기 안내 뒤 그 요청 쪽으로 보낸다', () => {
    expect(
      requestFailure(
        httpError(409, OrganizationErrorCode.pendingRequest),
        'Orbit',
      ),
    ).toEqual({ next: 'pending', notice: pendingRequestNotice('Orbit') });
  });

  it.each([
    OrganizationErrorCode.unknownCode,
    OrganizationErrorCode.retiredCode,
  ])(
    '그사이 코드가 바뀌었으면(404 %s) 유효하지 않은 코드 안내 뒤 코드를 다시 넣게 한다',
    code => {
      expect(requestFailure(httpError(404, code), 'Orbit')).toEqual({
        next: 'reenterCode',
        notice: invalidCodeNotice,
      });
    },
  );

  it('잠금 대기(409 ORGANIZATION-010)·실패 한도(429 -018)는 잠시 후 다시 보내게 화면에 머문다', () => {
    expect(
      requestFailure(
        httpError(409, OrganizationErrorCode.lockTimeout),
        'Orbit',
      ),
    ).toEqual({
      next: 'stay',
      notice: {
        title: RETRY_LATER,
        message: '요청이 몰려 처리하지 못했어요.\n잠시 후 다시 보내 주세요.',
      },
    });
    expect(
      requestFailure(
        httpError(429, OrganizationErrorCode.tooManyFailures),
        'Orbit',
      ),
    ).toMatchObject({ next: 'stay', notice: { title: RETRY_LATER } });
  });

  it('네트워크·서버 오류는 보내지 못했다고 하고 화면에 머문다', () => {
    expect(requestFailure(networkError, 'Orbit')).toEqual({
      next: 'stay',
      notice: {
        title: '참여 요청을 보내지 못했어요',
        message: '잠시 후 다시 시도해 주세요.',
      },
    });
  });
});

describe('cancelFailure (신청 취소 실패)', () => {
  it('이미 처리된 요청(409 ORGANIZATION-017)이면 그렇게 알리고, 받아 둔 목록이 옛 상태라고 알린다', () => {
    expect(
      cancelFailure(httpError(409, OrganizationErrorCode.alreadyDecided)),
    ).toEqual({
      outdated: true,
      title: '이미 처리된 요청이에요',
      message: '사무실이 이미 결정했거나 취소된 요청이라 취소할 수 없어요.',
    });
  });

  // 서버는 없는 요청과 다른 계정의 요청을 구분하지 않는다. 받아 둔 목록이 옛 상태일 수 있다
  it('없는·다른 계정의 요청(403 ORGANIZATION-016)이면 처리할 수 없다고 알리고, 받아 둔 목록이 옛 상태라고 알린다', () => {
    expect(
      cancelFailure(httpError(403, OrganizationErrorCode.notOwnRequest)),
    ).toEqual({
      outdated: true,
      title: '처리할 수 없는 요청이에요',
      message: '이미 사라졌거나 이 계정의 요청이 아니에요.',
    });
  });

  it.each([
    ['네트워크', networkError],
    ['서버 오류', httpError(500, 'COMMON-500')],
  ])('%s 는 취소하지 못했다고 한다', (_, error) => {
    expect(cancelFailure(error)).toEqual({
      outdated: false,
      title: '신청을 취소하지 못했어요',
      message: '잠시 후 다시 시도해 주세요.',
    });
  });
});
