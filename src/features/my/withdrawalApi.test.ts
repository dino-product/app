import { ApiErrorMessage, isApiError } from '../../shared/api';
import {
  createFakeServer,
  fail,
  networkError,
  noContent,
  ok,
} from '../../shared/testing/fakeServer';
import { createTestApi } from '../../shared/testing/renderWithApi';
import { testSession } from '../../shared/testing/session';
import {
  parseWithdrawalEligibility,
  withdrawAccount,
  withdrawalEligibilityPath,
  withdrawalEligibilityQuery,
  withdrawalEligibilityQueryKey,
  withdrawalPath,
} from './withdrawalApi';

const ELIGIBILITY_PATH = '/api/v1/profiles/7/withdrawal-eligibility';
const WITHDRAWALS_PATH = '/api/v1/profiles/7/withdrawals';

const thrownBy = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('parseWithdrawalEligibility', () => {
  // 백엔드 WithdrawalEligibilityResponse 그대로 (api-spec §2.2 P5)
  it('탈퇴 가능 여부와 막는 사유·건수를 옮긴다', () => {
    const response = {
      withdrawable: false,
      blocks: [
        { reason: 'SOLE_OWNER', count: 1 },
        { reason: 'WORK_IN_PROGRESS', count: 2 },
        { reason: 'WORK_PENDING_ACCEPT', count: 3 },
      ],
    };

    expect(parseWithdrawalEligibility(response)).toEqual(response);
  });

  it('탈퇴할 수 있으면 사유가 빈 목록이다', () => {
    expect(
      parseWithdrawalEligibility({ withdrawable: true, blocks: [] }),
    ).toEqual({ withdrawable: true, blocks: [] });
  });

  // 서버에 사유가 늘어도 탈퇴를 막는다는 판정(withdrawable)은 그대로 따른다. 모르는 사유는 카드로 그릴 수 없어 뺀다
  it('앱이 모르는 사유는 빼고 판정은 서버 값을 따른다', () => {
    expect(
      parseWithdrawalEligibility({
        withdrawable: false,
        blocks: [{ reason: 'UNPAID_SETTLEMENT', count: 1 }],
      }),
    ).toEqual({ withdrawable: false, blocks: [] });
  });

  it.each([
    ['withdrawable 이 없음', { blocks: [] }],
    ['blocks 가 배열이 아님', { withdrawable: true, blocks: null }],
    [
      '건수가 숫자가 아님',
      {
        withdrawable: false,
        blocks: [{ reason: 'WORK_IN_PROGRESS', count: '1' }],
      },
    ],
    ['객체가 아님', 'false'],
  ])('%s 이면 서버 응답 오류로 던진다', (_, value) => {
    const thrown = thrownBy(() => parseWithdrawalEligibility(value));

    expect(isApiError(thrown)).toBe(true);
    expect((thrown as Error).message).toBe(ApiErrorMessage.invalidResponse);
  });
});

describe('탈퇴 API', () => {
  const signedIn = () => testSession({ accountId: 7 });

  it('경로는 본인 accountId 로 만든다', () => {
    expect(withdrawalEligibilityPath(7)).toBe(ELIGIBILITY_PATH);
    expect(withdrawalPath(7)).toBe(WITHDRAWALS_PATH);
  });

  it('withdrawalEligibilityQuery 는 기기 세션 계정의 탈퇴 가능 여부를 받는다', async () => {
    const eligibility = {
      withdrawable: false,
      blocks: [{ reason: 'WORK_IN_PROGRESS', count: 1 }],
    };
    const server = createFakeServer().on(
      'GET',
      ELIGIBILITY_PATH,
      ok(eligibility),
    );
    const { client, queryClient } = createTestApi({
      server,
      session: signedIn(),
    });

    await expect(
      queryClient.fetchQuery(withdrawalEligibilityQuery(client)),
    ).resolves.toEqual(eligibility);
    expect(withdrawalEligibilityQuery(client).queryKey).toEqual(
      withdrawalEligibilityQueryKey,
    );
  });

  it('POST /withdrawals 로 앞뒤 공백을 지운 사유를 보내고 204 를 받는다', async () => {
    const server = createFakeServer().on('POST', WITHDRAWALS_PATH, noContent());
    const { client } = createTestApi({ server, session: signedIn() });

    await expect(
      withdrawAccount(client, 7, ' 더 이상 쓰지 않아요 '),
    ).resolves.toBeUndefined();
    expect(server.callsTo('POST', WITHDRAWALS_PATH)[0].body).toEqual({
      reason: '더 이상 쓰지 않아요',
    });
  });

  // 사유는 선택이다. 비우면 사유 없이 탈퇴한다 (서버도 빈 사유를 없음으로 본다)
  it('사유를 비우면 reason 을 null 로 보낸다', async () => {
    const server = createFakeServer().on('POST', WITHDRAWALS_PATH, noContent());
    const { client } = createTestApi({ server, session: signedIn() });

    await withdrawAccount(client, 7, '   ');

    expect(server.callsTo('POST', WITHDRAWALS_PATH)[0].body).toEqual({
      reason: null,
    });
  });

  // 서버는 NUL 문자가 든 사유를 PROFILE-007 로 거절한다. 사유는 선택이라 빼고 보낸다
  it('사유의 NUL 문자는 지워 보낸다', async () => {
    const server = createFakeServer().on('POST', WITHDRAWALS_PATH, noContent());
    const { client } = createTestApi({ server, session: signedIn() });

    await withdrawAccount(client, 7, '이사\u0000 가요\u0000');

    expect(server.callsTo('POST', WITHDRAWALS_PATH)[0].body).toEqual({
      reason: '이사 가요',
    });
  });

  // COMMON-409 는 '다른 탈퇴가 먼저 끝남' 과 '다른 기기의 프로필·약관 저장과 겹쳐 롤백됨' 둘 다다 (WithdrawService).
  // 프로필을 다시 조회해 계정이 살아 있는지 본다
  describe('COMMON-409', () => {
    const PROFILE_PATH = '/api/v1/profiles/7';
    const conflictServer = () =>
      createFakeServer().on('POST', WITHDRAWALS_PATH, fail(409, 'COMMON-409'));

    it('프로필이 그대로 조회되면(계정이 살아 있음) COMMON-409 로 던진다', async () => {
      const server = conflictServer().on(
        'GET',
        PROFILE_PATH,
        ok({
          accountId: 7,
          status: 'ACTIVE',
          nextStep: 'COMPLETED',
          name: '홍길동',
          phoneNumber: '01012345678',
          signedUpAt: '2026-10-21T00:00:00Z',
          marketingAgreed: false,
        }),
      );
      const { client } = createTestApi({ server, session: signedIn() });

      await expect(withdrawAccount(client, 7, '')).rejects.toMatchObject({
        code: 'COMMON-409',
      });
      expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(1);
    });

    it('탈퇴한 계정(PROFILE-002)이면 탈퇴를 마친 것으로 본다', async () => {
      const server = conflictServer().on(
        'GET',
        PROFILE_PATH,
        fail(404, 'PROFILE-002'),
      );
      const { client } = createTestApi({ server, session: signedIn() });

      await expect(withdrawAccount(client, 7, '')).resolves.toBeUndefined();
    });

    it('토큰이 거부되면(COMMON-404 뒤 재발급 AUTH-009) 탈퇴를 마친 것으로 본다', async () => {
      const server = conflictServer()
        .on('GET', PROFILE_PATH, fail(404, 'COMMON-404'))
        .on('POST', '/api/v1/auth/refresh', fail(401, 'AUTH-009'));
      const { client } = createTestApi({ server, session: signedIn() });

      await expect(withdrawAccount(client, 7, '')).resolves.toBeUndefined();
    });

    it('확인하지 못하면(네트워크) 탈퇴하지 못한 것으로 COMMON-409 를 던진다', async () => {
      const server = conflictServer().on('GET', PROFILE_PATH, networkError());
      const { client } = createTestApi({ server, session: signedIn() });

      await expect(withdrawAccount(client, 7, '')).rejects.toMatchObject({
        code: 'COMMON-409',
      });
    });
  });

  it('막히면 PROFILE-006 을 담은 ApiError 로 던진다', async () => {
    const server = createFakeServer().on(
      'POST',
      WITHDRAWALS_PATH,
      fail(409, 'PROFILE-006'),
    );
    const { client } = createTestApi({ server, session: signedIn() });

    await expect(withdrawAccount(client, 7, '')).rejects.toMatchObject({
      code: 'PROFILE-006',
    });
  });
});
