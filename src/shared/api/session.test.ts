import {
  createFakeServer,
  fail,
  hang,
  networkError,
  noContent,
  ok,
  type FakeServer,
} from '../testing/fakeServer';
import { createMemoryTokenStore, testSession } from '../testing/session';
import { ApiErrorCode } from './ApiError';
import { createApiClient, LOGOUT_PATH, REQUEST_TIMEOUT_MS } from './client';
import {
  REFRESH_BEFORE_EXPIRY_MS,
  REFRESH_PATH,
  REFRESH_RETRY_DELAY_MS,
  REFRESH_RETRY_TIMEOUT_MS,
  type LoginResponse,
  type Session,
} from './session';

const NOW = Date.parse('2026-11-04T01:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

let server: FakeServer;

const setup = (session: Session | null = testSession({}, NOW)) => {
  const tokenStore = createMemoryTokenStore(session);
  const client = createApiClient({
    baseUrl: server.baseUrl,
    fetch: server.fetch,
    tokenStore,
    now: () => NOW,
  });
  return { client, tokenStore };
};

const renewed = {
  accessToken: 'access-2',
  accessTokenExpiresAt: iso(NOW + 60 * 60 * 1000),
  refreshToken: 'refresh-2',
  refreshTokenExpiresAt: iso(NOW + 30 * 24 * 60 * 60 * 1000),
};

const expiringSoon = (msLeft: number) =>
  testSession({ accessTokenExpiresAt: iso(NOW + msLeft) }, NOW);

const bearerOf = (path: string) =>
  server.callsTo('GET', path).map(call => call.headers.Authorization);

// 실패를 기다리는 동안 처리되지 않은 거절로 잡히지 않게 먼저 받아 둔다
const settle = (promise: Promise<unknown>) =>
  promise.then(
    value => ({ value }),
    error => ({ error }),
  );

// 요청이 서버에 닿은 뒤 열 때까지 답을 붙잡아 두는 응답
function gated<T>(response: T) {
  let open = () => {};
  const gate = new Promise<void>(resolve => {
    open = resolve;
  });
  return {
    open: () => open(),
    handler: async () => {
      await gate;
      return response;
    },
  };
}

beforeEach(() => {
  server = createFakeServer();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('선제 재발급', () => {
  it('access 만료까지 60초 이하로 남았으면 요청 전에 재발급하고 새 토큰으로 보낸다', async () => {
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/auth/me', ok({ accountId: 1 }));
    const { client } = setup(expiringSoon(REFRESH_BEFORE_EXPIRY_MS));

    await client.get('/api/v1/auth/me');

    expect(REFRESH_BEFORE_EXPIRY_MS).toBe(60_000);
    expect(server.callsTo('POST', REFRESH_PATH)[0].body).toEqual({
      refreshToken: 'refresh-1',
    });
    expect(bearerOf('/api/v1/auth/me')).toEqual(['Bearer access-2']);
  });

  it('60초보다 많이 남았으면 재발급하지 않는다', async () => {
    server.on('GET', '/api/v1/auth/me', ok({ accountId: 1 }));
    const { client } = setup(expiringSoon(REFRESH_BEFORE_EXPIRY_MS + 1));

    await client.get('/api/v1/auth/me');

    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(0);
    expect(bearerOf('/api/v1/auth/me')).toEqual(['Bearer access-1']);
  });

  it('여러 요청이 동시에 재발급이 필요해도 /auth/refresh 는 한 번만 부르고 모두 새 토큰으로 보낸다', async () => {
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/auth/me', ok({ accountId: 1 }));
    const { client } = setup(expiringSoon(0));

    await Promise.all([
      client.get('/api/v1/auth/me'),
      client.get('/api/v1/auth/me'),
      client.get('/api/v1/auth/me'),
    ]);

    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
    expect(bearerOf('/api/v1/auth/me')).toEqual([
      'Bearer access-2',
      'Bearer access-2',
      'Bearer access-2',
    ]);
  });

  it('재발급 응답의 새 refresh token 으로 요청을 보내기 전에 바꿔 저장한다', async () => {
    const { client, tokenStore } = setup(expiringSoon(0));
    let storedWhenSent: Session | null = null;
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/auth/me', () => {
        storedWhenSent = tokenStore.current;
        return ok({ accountId: 1 });
      });

    await client.get('/api/v1/auth/me');

    const expected = { accountId: 1, ...renewed };
    expect(storedWhenSent).toEqual(expected);
    expect(tokenStore.current).toEqual(expected);
    await expect(client.session.getSession()).resolves.toEqual(expected);
  });

  it('재발급 뒤 다음 재발급은 새 refresh token 으로 한다', async () => {
    server
      .on(
        'POST',
        REFRESH_PATH,
        ok({ ...renewed, accessTokenExpiresAt: iso(NOW) }),
        ok(renewed),
      )
      .on('GET', '/api/v1/auth/me', ok({ accountId: 1 }));
    const { client } = setup(expiringSoon(0));

    await client.get('/api/v1/auth/me');
    await client.get('/api/v1/auth/me');

    expect(server.callsTo('POST', REFRESH_PATH).map(call => call.body)).toEqual(
      [{ refreshToken: 'refresh-1' }, { refreshToken: 'refresh-2' }],
    );
  });
});

// 백엔드 develop(79b47ad8) 의 재발급 계약 (#138): AuthSessionController POST /api/v1/auth/refresh,
// 요청 RefreshTokensRequest { refreshToken }, 응답 RefreshedTokensResponse { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt }
// (accountId·registered 없음), 거절은 모두 401 AUTH-009, 만료·폐기된 access 는 404 COMMON-404. 값은 백엔드 @Schema 예시 모양
describe('재발급 계약 (백엔드 HM-337 기기 세션)', () => {
  const backendRefreshToken =
    '7f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b.q3Jx0Yb9kVwH2tN7sLmA4cDeFgHiJkLmNoPqRsTuVwX';
  const refreshedTokensResponse = {
    accessToken: 'eyJhbGciOiJIUzI1NiJ9.rotated.signature',
    accessTokenExpiresAt: '2026-11-04T02:00:00Z',
    refreshToken:
      '7f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b.Zp8sQw2rTy6uIo0pAs4dFg7hJk1lZx3cVb5nMq9wErT',
    refreshTokenExpiresAt: '2026-12-04T01:00:00Z',
  };

  it('경로·오류 코드가 백엔드와 같다', () => {
    expect(REFRESH_PATH).toBe('/api/v1/auth/refresh');
    expect(ApiErrorCode.refreshRejected).toBe('AUTH-009');
    expect(ApiErrorCode.notFound).toBe('COMMON-404');
  });

  it('Bearer 없이 JSON { refreshToken } 만 보내고, 응답의 토큰 네 값으로 세션을 바꾸며 accountId 는 그대로 둔다', async () => {
    server
      .on('POST', REFRESH_PATH, ok(refreshedTokensResponse))
      .on('GET', '/api/v1/auth/me', ok({ accountId: 7 }));
    const { client, tokenStore } = setup(
      testSession(
        {
          accountId: 7,
          refreshToken: backendRefreshToken,
          accessTokenExpiresAt: iso(NOW),
        },
        NOW,
      ),
    );

    await client.get('/api/v1/auth/me');

    const [refresh] = server.callsTo('POST', REFRESH_PATH);
    expect(refresh.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(refresh.body).toEqual({ refreshToken: backendRefreshToken });
    expect(tokenStore.current).toEqual({
      accountId: 7,
      ...refreshedTokensResponse,
    });
    expect(bearerOf('/api/v1/auth/me')).toEqual([
      `Bearer ${refreshedTokensResponse.accessToken}`,
    ]);
  });
});

describe('COMMON-404 뒤 재시도', () => {
  const invalidToken = fail(404, ApiErrorCode.notFound, {
    message: '요청한 리소스를 찾을 수 없습니다.',
  });

  it('인증 요청이 COMMON-404 를 받으면 한 번 재발급하고 새 토큰으로 한 번 다시 보낸다', async () => {
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/memberships', invalidToken, ok(['소속']));
    const { client } = setup();

    await expect(client.get('/api/v1/memberships')).resolves.toEqual(['소속']);

    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
    expect(bearerOf('/api/v1/memberships')).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
  });

  it('다시 보내도 404 면 그 오류를 그대로 던진다 (진짜 없는 자원)', async () => {
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/memberships', invalidToken);
    const { client } = setup();

    await expect(client.get('/api/v1/memberships')).rejects.toMatchObject({
      status: 404,
      code: 'COMMON-404',
    });
    expect(server.callsTo('GET', '/api/v1/memberships')).toHaveLength(2);
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
  });

  it('같은 토큰으로 동시에 404 를 받아도 재발급은 한 번이다', async () => {
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/memberships', invalidToken, ok([]))
      .on('GET', '/api/v1/notifications/unread-count', invalidToken, ok(0));
    const { client } = setup();

    await Promise.all([
      client.get('/api/v1/memberships'),
      client.get('/api/v1/notifications/unread-count'),
    ]);

    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
  });

  it('옛 토큰의 404 가 다른 요청의 재발급 뒤에 오면 다시 재발급하지 않고 새 토큰으로 보낸다', async () => {
    let answerLate = () => {};
    const late = new Promise<void>(resolve => {
      answerLate = resolve;
    });
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/memberships', invalidToken, ok([]))
      .on(
        'GET',
        '/api/v1/notifications/unread-count',
        async () => {
          await late;
          return invalidToken;
        },
        ok(0),
      );
    const { client } = setup();

    const slow = client.get('/api/v1/notifications/unread-count');
    await client.get('/api/v1/memberships');
    answerLate();

    await expect(slow).resolves.toBe(0);
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
    expect(bearerOf('/api/v1/notifications/unread-count')).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
  });

  it('공개 요청의 404 로는 재발급하지 않는다', async () => {
    server.on(
      'POST',
      '/api/v1/auth/kakao/login',
      fail(404, 'AUTH-004', { message: '계정을 찾을 수 없습니다.' }),
    );
    const { client } = setup();

    await expect(
      client.post('/api/v1/auth/kakao/login', { idToken: 'id' }),
    ).rejects.toMatchObject({ code: 'AUTH-004' });
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(0);
  });

  it('404 가 아닌 오류로는 재발급하지 않는다', async () => {
    server.on(
      'GET',
      '/api/v1/memberships',
      fail(403, 'PROFILE-005', {
        message: '가입을 마친 뒤 이용할 수 있습니다.',
      }),
    );
    const { client } = setup();

    await expect(client.get('/api/v1/memberships')).rejects.toMatchObject({
      code: 'PROFILE-005',
    });
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(0);
  });
});

describe('세션 만료 (AUTH-009)', () => {
  const refreshRejected = fail(401, ApiErrorCode.refreshRejected, {
    message: '다시 로그인해 주세요.',
  });

  it('재발급이 AUTH-009 면 저장한 세션을 지우고 만료 구독자에게 한 번 알린다', async () => {
    server
      .on('POST', REFRESH_PATH, refreshRejected)
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client, tokenStore } = setup(expiringSoon(0));
    const expired = jest.fn();
    const changed = jest.fn();
    client.session.onExpired(expired);
    client.session.subscribe(changed);

    const results = await Promise.allSettled([
      client.get('/api/v1/auth/me'),
      client.get('/api/v1/auth/me'),
    ]);

    expect(results.map(result => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(results[0]).toMatchObject({ reason: { code: 'AUTH-009' } });
    expect(tokenStore.current).toBeNull();
    await expect(client.session.getSession()).resolves.toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith(null);
    expect(server.callsTo('GET', '/api/v1/auth/me')).toHaveLength(0);
    // 거절은 다시 받아도 같다
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
  });

  it('404 뒤 재발급이 AUTH-009 여도 세션을 지우고 한 번 알린다', async () => {
    server
      .on('POST', REFRESH_PATH, refreshRejected)
      .on('GET', '/api/v1/memberships', fail(404, ApiErrorCode.notFound));
    const { client, tokenStore } = setup();
    const expired = jest.fn();
    client.session.onExpired(expired);

    await expect(client.get('/api/v1/memberships')).rejects.toMatchObject({
      code: 'AUTH-009',
    });
    // 세션이 없어진 뒤의 요청은 토큰 없이 가고 다시 알리지 않는다
    await expect(client.get('/api/v1/memberships')).rejects.toMatchObject({
      code: 'COMMON-404',
    });

    expect(tokenStore.current).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
  });

  it('재발급이 다른 401 이어도 세션 만료로 다룬다', async () => {
    server
      .on('POST', REFRESH_PATH, fail(401, ApiErrorCode.noToken))
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client, tokenStore } = setup(expiringSoon(0));
    const expired = jest.fn();
    client.session.onExpired(expired);

    await expect(client.get('/api/v1/auth/me')).rejects.toMatchObject({
      status: 401,
    });
    expect(tokenStore.current).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('재발급을 다시 받아도 네트워크 오류면 세션을 지우지 않는다', async () => {
    jest.useFakeTimers();
    server
      .on('POST', REFRESH_PATH, networkError())
      .on('GET', '/api/v1/auth/me', ok({}));
    const session = expiringSoon(0);
    const { client, tokenStore } = setup(session);
    const expired = jest.fn();
    client.session.onExpired(expired);

    const result = settle(client.get('/api/v1/auth/me'));
    await jest.advanceTimersByTimeAsync(REFRESH_RETRY_DELAY_MS);

    expect(await result).toMatchObject({ error: { kind: 'network' } });
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(2);
    expect(tokenStore.current).toEqual(session);
    expect(expired).not.toHaveBeenCalled();
  });

  it('구독을 풀면 더 알리지 않는다', async () => {
    server
      .on('POST', REFRESH_PATH, refreshRejected)
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client } = setup(expiringSoon(0));
    const expired = jest.fn();
    client.session.onExpired(expired)();

    await client.get('/api/v1/auth/me').catch(() => undefined);

    expect(expired).not.toHaveBeenCalled();
  });

  it('재발급 응답 모양이 다르면 세션을 그대로 두고 오류로 던진다', async () => {
    server
      .on('POST', REFRESH_PATH, ok({ accessToken: 'access-2' }))
      .on('GET', '/api/v1/auth/me', ok({}));
    const session = expiringSoon(0);
    const { client, tokenStore } = setup(session);

    await expect(client.get('/api/v1/auth/me')).rejects.toMatchObject({
      kind: 'http',
    });
    expect(tokenStore.current).toEqual(session);
  });
});

describe('세션 세우기·끝내기', () => {
  const login: LoginResponse = {
    accountId: 7,
    registered: true,
    accessToken: 'access-login',
    accessTokenExpiresAt: iso(NOW + 60 * 60 * 1000),
    refreshToken: 'refresh-login',
    refreshTokenExpiresAt: iso(NOW + 30 * 24 * 60 * 60 * 1000),
  };

  it('로그인 응답으로 세션을 세우고 저장한다 (registered 는 저장하지 않는다)', async () => {
    server.on('GET', '/api/v1/auth/me', ok({ accountId: 7 }));
    const { client, tokenStore } = setup(null);
    const changed = jest.fn();
    client.session.subscribe(changed);

    await client.session.start(login);
    await client.get('/api/v1/auth/me');

    const session = {
      accountId: 7,
      accessToken: 'access-login',
      accessTokenExpiresAt: login.accessTokenExpiresAt,
      refreshToken: 'refresh-login',
      refreshTokenExpiresAt: login.refreshTokenExpiresAt,
    };
    expect(tokenStore.current).toEqual(session);
    expect(changed).toHaveBeenCalledWith(session);
    expect(bearerOf('/api/v1/auth/me')).toEqual(['Bearer access-login']);
  });

  it('세션을 끝내면 저장한 것을 지우고 구독자에게 null 을 알린다', async () => {
    const { client, tokenStore } = setup();
    const changed = jest.fn();
    const unsubscribe = client.session.subscribe(changed);

    await client.session.end();
    unsubscribe();
    await client.session.start(login);

    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith(null);
    expect(tokenStore.current).toEqual(
      expect.objectContaining({ accountId: 7 }),
    );
  });

  it('저장소는 처음 한 번만 읽는다', async () => {
    const tokenStore = createMemoryTokenStore(testSession({}, NOW));
    const read = jest.spyOn(tokenStore, 'read');
    const client = createApiClient({
      baseUrl: server.baseUrl,
      fetch: server.fetch,
      tokenStore,
      now: () => NOW,
    });

    await Promise.all([
      client.session.getSession(),
      client.session.getSession(),
    ]);
    await client.session.getSession();

    expect(read).toHaveBeenCalledTimes(1);
  });

  it('저장소를 읽지 못하면 다음에 다시 읽는다', async () => {
    const tokenStore = createMemoryTokenStore(testSession({}, NOW));
    jest.spyOn(tokenStore, 'read').mockRejectedValueOnce(new Error('locked'));
    const client = createApiClient({
      baseUrl: server.baseUrl,
      fetch: server.fetch,
      tokenStore,
      now: () => NOW,
    });

    await expect(client.session.getSession()).rejects.toThrow('locked');
    await expect(client.session.getSession()).resolves.toMatchObject({
      accountId: 1,
    });
  });

  it('재발급하는 동안 세션을 끝내면 재발급 결과로 세션을 되살리지 않는다', async () => {
    const { client, tokenStore } = setup(expiringSoon(0));
    server
      .on('POST', REFRESH_PATH, async () => {
        await client.session.end();
        return ok(renewed);
      })
      .on('GET', '/api/v1/auth/me', ok({}));

    await client.get('/api/v1/auth/me');

    expect(tokenStore.current).toBeNull();
    expect(bearerOf('/api/v1/auth/me')).toEqual([undefined]);
  });

  it('재발급하는 동안 다른 계정으로 바뀌면 그 계정 토큰으로 보내지 않는다', async () => {
    const { client } = setup(expiringSoon(0));
    server
      .on('POST', REFRESH_PATH, async () => {
        await client.session.end();
        await client.session.start({
          ...testSession({ accountId: 2, accessToken: 'access-B' }, NOW),
          registered: false,
        });
        return ok(renewed);
      })
      .on('GET', '/api/v1/auth/me', ok({}));

    await client.get('/api/v1/auth/me');

    expect(bearerOf('/api/v1/auth/me')).toEqual([undefined]);
  });

  it('저장에 실패해도 이번 실행 동안은 새 토큰으로 요청한다', async () => {
    const { client, tokenStore } = setup(expiringSoon(0));
    const save = jest
      .spyOn(tokenStore, 'save')
      .mockRejectedValue(new Error('disk'));
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/auth/me', ok({}));

    await client.get('/api/v1/auth/me');

    expect(bearerOf('/api/v1/auth/me')).toEqual(['Bearer access-2']);
    expect(save).toHaveBeenCalledTimes(2);
  });
});

describe('토큰 값 노출', () => {
  it('로그인·재발급·만료 내내 console 에 토큰 값을 남기지 않는다', async () => {
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const spies = methods.map(method =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    server
      .on(
        'POST',
        REFRESH_PATH,
        ok(renewed),
        fail(401, ApiErrorCode.refreshRejected),
      )
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client } = setup(null);

    await client.session.start({
      ...expiringSoon(0),
      registered: false,
    });
    await client.get('/api/v1/auth/me');
    await client.session.start({ ...expiringSoon(0), registered: false });
    await client.get('/api/v1/auth/me').catch(() => undefined);

    const printed = JSON.stringify(spies.map(spy => spy.mock.calls));
    for (const token of ['access-1', 'refresh-1', 'access-2', 'refresh-2']) {
      expect(printed).not.toContain(token);
    }
    spies.forEach(spy => spy.mockRestore());
  });
});

describe('구독자 오류', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  const boom = () => {
    throw new Error('listener boom');
  };

  it('세션 구독자가 던져도 회전된 refresh 를 저장하고 요청을 보낸다', async () => {
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/auth/me', ok({ accountId: 1 }));
    const { client, tokenStore } = setup(expiringSoon(0));
    client.session.subscribe(boom);

    await expect(client.get('/api/v1/auth/me')).resolves.toEqual({
      accountId: 1,
    });

    expect(tokenStore.current?.refreshToken).toBe('refresh-2');
    expect(bearerOf('/api/v1/auth/me')).toEqual(['Bearer access-2']);
    expect(console.error).toHaveBeenCalled();
  });

  it('세션 구독자가 던져도 AUTH-009 면 세션을 지우고 만료를 알린다', async () => {
    server
      .on('POST', REFRESH_PATH, fail(401, ApiErrorCode.refreshRejected))
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client, tokenStore } = setup(expiringSoon(0));
    const expired = jest.fn();
    client.session.subscribe(boom);
    client.session.onExpired(expired);

    await expect(client.get('/api/v1/auth/me')).rejects.toMatchObject({
      code: 'AUTH-009',
    });

    expect(tokenStore.current).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('만료 구독자 하나가 던져도 다른 만료 구독자에게 알린다', async () => {
    server
      .on('POST', REFRESH_PATH, fail(401, ApiErrorCode.refreshRejected))
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client } = setup(expiringSoon(0));
    const expired = jest.fn();
    client.session.onExpired(boom);
    client.session.onExpired(expired);

    await client.get('/api/v1/auth/me').catch(() => undefined);

    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('로그인할 때 구독자가 던져도 세션을 저장한다', async () => {
    const { client, tokenStore } = setup(null);
    client.session.subscribe(boom);

    await client.session.start({ ...testSession({}, NOW), registered: true });

    expect(tokenStore.current).toEqual(testSession({}, NOW));
  });
});

describe('저장 실패', () => {
  it('늦게 끝난 로그인 저장은 그 사이 세션을 끝냈으면 구독자에게 옛 세션을 알리지 않는다', async () => {
    const { client, tokenStore } = setup(null);
    let finishSave = () => {};
    jest.spyOn(tokenStore, 'save').mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishSave = resolve;
        }),
    );
    const changed = jest.fn();
    client.session.subscribe(changed);

    const starting = client.session.start({
      ...testSession({}, NOW),
      registered: true,
    });
    await client.session.end();
    finishSave();
    await starting;

    expect(changed.mock.calls).toEqual([[null]]);
  });

  it('재발급 뒤 저장에 실패하면 한 번 다시 저장한다', async () => {
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client, tokenStore } = setup(expiringSoon(0));
    const save = jest
      .spyOn(tokenStore, 'save')
      .mockRejectedValueOnce(new Error('busy'));

    await client.get('/api/v1/auth/me');

    expect(save).toHaveBeenCalledTimes(2);
    expect(tokenStore.current?.refreshToken).toBe('refresh-2');
  });

  it('로그인 저장이 두 번 다 실패하면 로그인한 쪽에 알린다', async () => {
    const { client, tokenStore } = setup(null);
    jest.spyOn(tokenStore, 'save').mockRejectedValue(new Error('disk'));

    await expect(
      client.session.start({ ...testSession({}, NOW), registered: true }),
    ).rejects.toThrow('disk');
  });
});

describe('재발급 응답 유실', () => {
  it('재발급이 네트워크 오류면 1초 뒤 같은 refresh 로 한 번 더 받는다 (서버는 30초 안의 재전송에 같은 새 토큰을 준다)', async () => {
    jest.useFakeTimers();
    server
      .on('POST', REFRESH_PATH, networkError(), ok(renewed))
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client, tokenStore } = setup(expiringSoon(0));

    const result = settle(client.get('/api/v1/auth/me'));
    await jest.advanceTimersByTimeAsync(REFRESH_RETRY_DELAY_MS - 1);
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);

    expect(await result).toEqual({ value: {} });
    expect(REFRESH_RETRY_DELAY_MS).toBe(1_000);
    expect(server.callsTo('POST', REFRESH_PATH).map(call => call.body)).toEqual(
      [{ refreshToken: 'refresh-1' }, { refreshToken: 'refresh-1' }],
    );
    expect(tokenStore.current?.refreshToken).toBe('refresh-2');
    expect(bearerOf('/api/v1/auth/me')).toEqual(['Bearer access-2']);
  });

  it('재발급이 타임아웃이어도 한 번 더 받는다', async () => {
    jest.useFakeTimers();
    server
      .on('POST', REFRESH_PATH, hang(), ok(renewed))
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client } = setup(expiringSoon(0));

    const result = settle(client.get('/api/v1/auth/me'));
    await jest.advanceTimersByTimeAsync(
      REQUEST_TIMEOUT_MS + REFRESH_RETRY_DELAY_MS,
    );

    expect(await result).toEqual({ value: {} });
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(2);
  });

  it('다시 받는 재발급은 5초만 기다린다 (최대 15초 + 1초 + 5초)', async () => {
    jest.useFakeTimers();
    server
      .on('POST', REFRESH_PATH, hang())
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client } = setup(expiringSoon(0));

    const result = settle(client.get('/api/v1/auth/me'));
    await jest.advanceTimersByTimeAsync(
      REQUEST_TIMEOUT_MS + REFRESH_RETRY_DELAY_MS + REFRESH_RETRY_TIMEOUT_MS,
    );

    const retried = server.callsTo('POST', REFRESH_PATH)[1];
    expect(REFRESH_RETRY_TIMEOUT_MS).toBe(5_000);
    expect(retried.signal?.aborted).toBe(true);
    expect(await result).toMatchObject({ error: { kind: 'timeout' } });
  });

  it('다시 받기 전에 로그아웃하면 다시 보내지 않는다', async () => {
    jest.useFakeTimers();
    server
      .on('POST', REFRESH_PATH, networkError(), ok(renewed))
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client } = setup(expiringSoon(0));

    const result = settle(client.get('/api/v1/auth/me'));
    await jest.advanceTimersByTimeAsync(10);
    await client.session.end();
    await jest.advanceTimersByTimeAsync(REFRESH_RETRY_DELAY_MS);
    await result;

    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
    expect(bearerOf('/api/v1/auth/me')).toEqual([undefined]);
  });

  it('5xx 로 답했으면(서버가 처리하지 못함) 다시 받지 않는다', async () => {
    server
      .on('POST', REFRESH_PATH, fail(500, ApiErrorCode.serverError))
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client } = setup(expiringSoon(0));

    await expect(client.get('/api/v1/auth/me')).rejects.toMatchObject({
      status: 500,
    });
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
  });
});

describe('선제 재발급이 잠시 실패할 때', () => {
  it('일시 오류(5xx)여도 access 가 아직 만료 전이면 그 토큰으로 보낸다', async () => {
    server
      .on('POST', REFRESH_PATH, fail(503, ApiErrorCode.unavailable))
      .on('GET', '/api/v1/auth/me', ok({ accountId: 1 }));
    const { client } = setup(expiringSoon(30_000));

    await expect(client.get('/api/v1/auth/me')).resolves.toEqual({
      accountId: 1,
    });
    expect(bearerOf('/api/v1/auth/me')).toEqual(['Bearer access-1']);
  });

  it('만료가 지났으면 그 오류를 던진다', async () => {
    server
      .on('POST', REFRESH_PATH, fail(500, ApiErrorCode.serverError))
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client } = setup(expiringSoon(0));

    await expect(client.get('/api/v1/auth/me')).rejects.toMatchObject({
      status: 500,
    });
    expect(server.callsTo('GET', '/api/v1/auth/me')).toHaveLength(0);
  });

  it('재발급이 실패한 뒤 다음 요청은 다시 재발급한다 (single-flight 를 푼다)', async () => {
    server
      .on(
        'POST',
        REFRESH_PATH,
        fail(500, ApiErrorCode.serverError),
        ok(renewed),
      )
      .on('GET', '/api/v1/auth/me', ok({}));
    const { client } = setup(expiringSoon(0));

    await client.get('/api/v1/auth/me').catch(() => undefined);
    await client.get('/api/v1/auth/me');

    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(2);
    expect(bearerOf('/api/v1/auth/me')).toEqual(['Bearer access-2']);
  });
});

describe('요청 중 세션이 바뀔 때', () => {
  const invalidToken = fail(404, ApiErrorCode.notFound);

  it('요청 중 로그아웃하면 404 를 받아도 재발급하지 않고 원래 오류를 던진다', async () => {
    const late = gated(invalidToken);
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/memberships', late.handler);
    const { client } = setup();

    const pending = settle(client.get('/api/v1/memberships'));
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await client.session.end();
    late.open();

    expect(await pending).toMatchObject({
      error: { status: 404, code: 'COMMON-404' },
    });
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(0);
    expect(server.callsTo('GET', '/api/v1/memberships')).toHaveLength(1);
  });

  it('요청 중 다른 계정으로 바뀌면 404 뒤 그 계정 토큰으로 다시 보내지 않는다', async () => {
    const late = gated(invalidToken);
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('PUT', '/api/v1/profiles/1', late.handler, ok('done'));
    const { client } = setup();

    const pending = settle(client.put('/api/v1/profiles/1', { name: 'A' }));
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await client.session.end();
    await client.session.start({
      ...testSession({ accountId: 2, accessToken: 'access-B' }, NOW),
      registered: false,
    });
    late.open();

    expect(await pending).toMatchObject({ error: { code: 'COMMON-404' } });
    expect(
      server
        .callsTo('PUT', '/api/v1/profiles/1')
        .map(call => call.headers.Authorization),
    ).toEqual(['Bearer access-1']);
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(0);
  });
});

describe('로그아웃', () => {
  it('있는 access 토큰을 그대로 붙이고, 곧 만료여도 먼저 재발급하지 않는다', async () => {
    server
      .on('POST', REFRESH_PATH, fail(401, ApiErrorCode.refreshRejected))
      .on('POST', LOGOUT_PATH, noContent());
    const { client } = setup(expiringSoon(0));
    const expired = jest.fn();
    client.session.onExpired(expired);

    await expect(
      client.post(LOGOUT_PATH, { refreshToken: 'refresh-1' }),
    ).resolves.toBeUndefined();

    expect(server.callsTo('POST', LOGOUT_PATH)[0].headers.Authorization).toBe(
      'Bearer access-1',
    );
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(0);
    expect(expired).not.toHaveBeenCalled();
  });

  it('404 를 받아도 재발급·재전송하지 않는다 (서버는 무효 토큰이어도 204 로 답한다)', async () => {
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('POST', LOGOUT_PATH, fail(404, ApiErrorCode.notFound));
    const { client } = setup();

    await expect(client.post(LOGOUT_PATH)).rejects.toMatchObject({
      status: 404,
    });
    expect(server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1);
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(0);
  });

  it('세션이 없으면 토큰 없이 보낸다', async () => {
    server.on('POST', LOGOUT_PATH, noContent());
    const { client } = setup(null);

    await client.post(LOGOUT_PATH, { refreshToken: null });

    expect(
      server.callsTo('POST', LOGOUT_PATH)[0].headers.Authorization,
    ).toBeUndefined();
  });
});
