import { ApiErrorMessage, isApiError } from '../../../shared/api';
import {
  createFakeServer,
  fail,
  hang,
  networkError,
  ok,
} from '../../../shared/testing/fakeServer';
import { createTestApi } from '../../../shared/testing/renderWithApi';
import { testSession } from '../../../shared/testing/session';
import {
  cancelParticipationRequest,
  cancelRequestPath,
  COMPANY_LOOKUP_PATH,
  fetchParticipationRequests,
  lookupCompany,
  OrganizationErrorCode,
  parseCompanyCheck,
  parseParticipationRequest,
  PARTICIPATION_REQUESTS_PATH,
  requestParticipation,
} from './participationApi';

// 백엔드 응답 그대로 (api-spec §2.3, organization/adapter/in/web/*Response)
const companyCheck = {
  organizationId: 9,
  organizationName: 'Orbit',
  availability: 'AVAILABLE',
  pendingRequestId: null,
};

// ParticipationRequestResponse (요청·취소 응답)
const created = {
  requestId: 31,
  organizationId: 9,
  organizationName: 'Orbit',
  desiredType: 'TECHNICIAN',
  status: 'PENDING',
  requestedAt: '2026-11-04T01:24:00Z',
};

// MyParticipationRequestsResponse.Request (내 신청 현황의 한 줄)
const rejected = {
  requestId: 3,
  organizationId: 12,
  organizationName: '스마트 홈케어',
  desiredType: 'STAFF',
  confirmedType: null,
  status: 'REJECTED',
  rejectReason: '이번 달 채용이 마감되었습니다',
  requestedAt: '2026-10-10T00:00:00Z',
  decidedAt: '2026-10-11T00:00:00Z',
};

const signedIn = (server = createFakeServer()) =>
  createTestApi({ server, session: testSession() });

describe('parseCompanyCheck', () => {
  it('CompanyCheckResponse 를 옮기고 숫자 id 는 문자열로 바꾼다', () => {
    expect(
      parseCompanyCheck({
        ...companyCheck,
        availability: 'PENDING_REQUEST',
        pendingRequestId: 3,
      }),
    ).toEqual({
      organizationId: '9',
      organizationName: 'Orbit',
      availability: 'PENDING_REQUEST',
      pendingRequestId: '3',
    });
  });

  it('대기 요청이 없으면 pendingRequestId 를 두지 않는다', () => {
    expect(parseCompanyCheck(companyCheck)).toEqual({
      organizationId: '9',
      organizationName: 'Orbit',
      availability: 'AVAILABLE',
    });
  });

  it.each([
    ['availability 가 목록 밖', { ...companyCheck, availability: 'MAYBE' }],
    ['id 가 숫자가 아님', { ...companyCheck, organizationId: '9' }],
    ['이름이 없음', { ...companyCheck, organizationName: null }],
    ['객체가 아님', null],
  ])('모양이 다르면(%s) 서버 응답 오류로 던진다', (_, value) => {
    expect(() => parseCompanyCheck(value)).toThrow(
      ApiErrorMessage.invalidResponse,
    );
  });
});

describe('parseParticipationRequest', () => {
  it('요청 응답(ParticipationRequestResponse)을 옮긴다. 결정 전이라 결정 필드가 없다', () => {
    expect(parseParticipationRequest(created)).toEqual({
      requestId: '31',
      organizationId: '9',
      organizationName: 'Orbit',
      desiredType: 'TECHNICIAN',
      status: 'PENDING',
      requestedAt: '2026-11-04T01:24:00Z',
    });
  });

  it('거절된 요청은 사유와 결정 일시를 옮긴다', () => {
    expect(parseParticipationRequest(rejected)).toEqual({
      requestId: '3',
      organizationId: '12',
      organizationName: '스마트 홈케어',
      desiredType: 'STAFF',
      status: 'REJECTED',
      requestedAt: '2026-10-10T00:00:00Z',
      rejectReason: '이번 달 채용이 마감되었습니다',
      decidedAt: '2026-10-11T00:00:00Z',
    });
  });

  // 앱의 approvedType 은 서버 confirmedType 이다 (사무실이 희망 유형과 다르게 정할 수 있다)
  it('승인된 요청의 확정 유형(confirmedType)은 approvedType 이다', () => {
    expect(
      parseParticipationRequest({
        ...rejected,
        status: 'APPROVED',
        confirmedType: 'TECHNICIAN',
        rejectReason: null,
      }),
    ).toMatchObject({
      status: 'APPROVED',
      desiredType: 'STAFF',
      approvedType: 'TECHNICIAN',
    });
  });

  it.each([
    ['상태가 목록 밖', { ...created, status: 'DONE' }],
    ['희망 유형이 목록 밖', { ...created, desiredType: 'OWNER' }],
    ['확정 유형이 목록 밖', { ...rejected, confirmedType: 'OWNER' }],
    ['요청 일시가 없음', { ...created, requestedAt: null }],
    ['사유가 문자열이 아님', { ...rejected, rejectReason: 1 }],
  ])('모양이 다르면(%s) 서버 응답 오류로 던진다', (_, value) => {
    expect(() => parseParticipationRequest(value)).toThrow(
      ApiErrorMessage.invalidResponse,
    );
  });
});

describe('lookupCompany', () => {
  it('정리한 코드로 GET /organizations/lookup 을 부르고, 찾은 회사는 찾은 방법과 함께 참여 대상이 된다', async () => {
    const api = signedIn(
      createFakeServer().on('GET', COMPANY_LOOKUP_PATH, ok(companyCheck)),
    );

    await expect(
      lookupCompany(api.client, '7k2m-9x', 'QR_CODE'),
    ).resolves.toEqual({
      kind: 'found',
      target: {
        organizationId: '9',
        organizationName: 'Orbit',
        companyCode: '7K2M9X',
        requestChannel: 'QR_CODE',
      },
    });
    expect(api.server.callsTo('GET', COMPANY_LOOKUP_PATH)[0]).toMatchObject({
      query: { companyCode: '7K2M9X' },
      headers: { Authorization: 'Bearer access-1' },
    });
  });

  it('이미 참여 중인 회사·승인 대기 요청이 있는 회사로 나눈다', async () => {
    const server = createFakeServer().on(
      'GET',
      COMPANY_LOOKUP_PATH,
      ok({ ...companyCheck, availability: 'ALREADY_MEMBER' }),
      ok({
        ...companyCheck,
        availability: 'PENDING_REQUEST',
        pendingRequestId: 3,
      }),
    );
    const api = signedIn(server);
    const organization = { organizationId: '9', organizationName: 'Orbit' };

    await expect(
      lookupCompany(api.client, 'RBT124', 'COMPANY_CODE'),
    ).resolves.toEqual({ kind: 'alreadyMember', organization });
    await expect(
      lookupCompany(api.client, 'RBT124', 'COMPANY_CODE'),
    ).resolves.toEqual({ kind: 'pending', organization, requestId: '3' });
  });

  // 없는 코드(ORGANIZATION-011)도, 회사가 코드를 바꿔 폐기된 이전 코드(ORGANIZATION-012)도 유효하지 않은 코드다
  it.each([
    OrganizationErrorCode.unknownCode,
    OrganizationErrorCode.retiredCode,
  ])('404 %s 면 유효하지 않은 코드다', async code => {
    const api = signedIn(
      createFakeServer().on('GET', COMPANY_LOOKUP_PATH, fail(404, code)),
    );

    await expect(
      lookupCompany(api.client, 'ZZZZZZ', 'COMPANY_CODE'),
    ).resolves.toEqual({ kind: 'invalid' });
  });

  it('실패 한도(429 ORGANIZATION-018)·네트워크 오류는 그대로 던져 화면이 안내한다', async () => {
    const server = createFakeServer().on(
      'GET',
      COMPANY_LOOKUP_PATH,
      fail(429, OrganizationErrorCode.tooManyFailures),
      networkError(),
    );
    const api = signedIn(server);

    const limited = await lookupCompany(
      api.client,
      'ZZZZZZ',
      'COMPANY_CODE',
    ).catch(error => error);
    expect(isApiError(limited, OrganizationErrorCode.tooManyFailures)).toBe(
      true,
    );
    await expect(
      lookupCompany(api.client, 'ZZZZZZ', 'COMPANY_CODE'),
    ).rejects.toMatchObject({ kind: 'network' });
  });

  it('취소 신호를 받으면 요청을 끊는다 (화면을 떠남)', async () => {
    const api = signedIn(
      createFakeServer().on('GET', COMPANY_LOOKUP_PATH, hang()),
    );
    const controller = new AbortController();

    const pending = lookupCompany(api.client, 'RBT124', 'COMPANY_CODE', {
      signal: controller.signal,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('requestParticipation', () => {
  it('POST /participation-requests 에 회사 코드·희망 유형·요청 경로를 보내고, 보낸 경로를 붙여 돌려준다', async () => {
    const api = signedIn(
      createFakeServer().on('POST', PARTICIPATION_REQUESTS_PATH, ok(created)),
    );

    await expect(
      requestParticipation(api.client, {
        companyCode: 'rbt-124',
        desiredType: 'TECHNICIAN',
        requestChannel: 'COMPANY_CODE',
      }),
    ).resolves.toEqual({
      requestId: '31',
      organizationId: '9',
      organizationName: 'Orbit',
      desiredType: 'TECHNICIAN',
      status: 'PENDING',
      requestedAt: '2026-11-04T01:24:00Z',
      requestChannel: 'COMPANY_CODE',
    });
    expect(
      api.server.callsTo('POST', PARTICIPATION_REQUESTS_PATH)[0].body,
    ).toEqual({
      companyCode: 'RBT124',
      desiredType: 'TECHNICIAN',
      requestChannel: 'COMPANY_CODE',
    });
  });

  it.each([
    OrganizationErrorCode.alreadyMember,
    OrganizationErrorCode.pendingRequest,
    OrganizationErrorCode.lockTimeout,
  ])('409 %s 는 코드를 담아 던진다', async code => {
    const api = signedIn(
      createFakeServer().on(
        'POST',
        PARTICIPATION_REQUESTS_PATH,
        fail(409, code),
      ),
    );

    const error = await requestParticipation(api.client, {
      companyCode: 'RBT124',
      desiredType: 'STAFF',
      requestChannel: 'COMPANY_CODE',
    }).catch(caught => caught);

    expect(isApiError(error, code)).toBe(true);
  });
});

describe('cancelParticipationRequest', () => {
  it('POST /participation-requests/{requestId}/cancel 을 부르고 취소된 요청을 돌려준다', async () => {
    const path = cancelRequestPath('31');
    const api = signedIn(
      createFakeServer().on(
        'POST',
        path,
        ok({ ...created, status: 'CANCELED' }),
      ),
    );

    await expect(
      cancelParticipationRequest(api.client, '31'),
    ).resolves.toMatchObject({ requestId: '31', status: 'CANCELED' });
    expect(path).toBe('/api/v1/participation-requests/31/cancel');
    expect(api.server.callsTo('POST', path)[0].body).toBeUndefined();
  });

  it('이미 결정된 요청(409 ORGANIZATION-017)은 코드를 담아 던진다', async () => {
    const path = cancelRequestPath('3');
    const api = signedIn(
      createFakeServer().on(
        'POST',
        path,
        fail(409, OrganizationErrorCode.alreadyDecided),
      ),
    );

    const error = await cancelParticipationRequest(api.client, '3').catch(
      caught => caught,
    );

    expect(isApiError(error, OrganizationErrorCode.alreadyDecided)).toBe(true);
  });
});

describe('fetchParticipationRequests', () => {
  it('GET /participation-requests 의 requests 를 서버 순서(요청 일시순) 그대로 옮긴다', async () => {
    const api = signedIn(
      createFakeServer().on(
        'GET',
        PARTICIPATION_REQUESTS_PATH,
        ok({
          requests: [
            rejected,
            {
              ...created,
              confirmedType: null,
              rejectReason: null,
              decidedAt: null,
            },
          ],
        }),
      ),
    );

    const requests = await fetchParticipationRequests(api.client);

    expect(requests.map(item => [item.requestId, item.status])).toEqual([
      ['3', 'REJECTED'],
      ['31', 'PENDING'],
    ]);
  });

  it('requests 가 배열이 아니면 서버 응답 오류로 던진다', async () => {
    const api = signedIn(
      createFakeServer().on('GET', PARTICIPATION_REQUESTS_PATH, ok({})),
    );

    await expect(fetchParticipationRequests(api.client)).rejects.toThrow(
      ApiErrorMessage.invalidResponse,
    );
  });

  // 만료·폐기된 access token 은 401 이 아니라 COMMON-404 로 온다. 토대(#110)가 한 번 재발급해 다시 보낸다
  it('토큰이 만료돼(COMMON-404) 거절되면 재발급한 토큰으로 다시 받는다', async () => {
    const server = createFakeServer()
      .on('GET', PARTICIPATION_REQUESTS_PATH, call =>
        call.headers.Authorization === 'Bearer access-2'
          ? ok({ requests: [rejected] })
          : fail(404, 'COMMON-404'),
      )
      .on(
        'POST',
        '/api/v1/auth/refresh',
        ok({
          accountId: 1,
          accessToken: 'access-2',
          accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          refreshToken: 'refresh-2',
          refreshTokenExpiresAt: new Date(
            Date.now() + 30 * 86_400_000,
          ).toISOString(),
        }),
      );
    const api = signedIn(server);

    await expect(fetchParticipationRequests(api.client)).resolves.toHaveLength(
      1,
    );
    expect(server.callsTo('GET', PARTICIPATION_REQUESTS_PATH)).toHaveLength(2);
  });
});
