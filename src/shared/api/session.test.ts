import {
  createFakeServer,
  fail,
  networkError,
  ok,
  type FakeServer,
} from '../testing/fakeServer';
import { createMemoryTokenStore, testSession } from '../testing/session';
import { ApiErrorCode } from './ApiError';
import { createApiClient } from './client';
import {
  REFRESH_BEFORE_EXPIRY_MS,
  REFRESH_PATH,
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

beforeEach(() => {
  server = createFakeServer();
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

  it('재발급이 네트워크 오류면 세션을 지우지 않는다', async () => {
    server
      .on('POST', REFRESH_PATH, networkError())
      .on('GET', '/api/v1/auth/me', ok({}));
    const session = expiringSoon(0);
    const { client, tokenStore } = setup(session);
    const expired = jest.fn();
    client.session.onExpired(expired);

    await expect(client.get('/api/v1/auth/me')).rejects.toMatchObject({
      kind: 'network',
    });
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

  it('저장에 실패해도 이번 실행 동안은 새 토큰으로 요청한다', async () => {
    const { client, tokenStore } = setup(expiringSoon(0));
    jest.spyOn(tokenStore, 'save').mockRejectedValue(new Error('disk'));
    server
      .on('POST', REFRESH_PATH, ok(renewed))
      .on('GET', '/api/v1/auth/me', ok({}));

    await client.get('/api/v1/auth/me');

    expect(bearerOf('/api/v1/auth/me')).toEqual(['Bearer access-2']);
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
