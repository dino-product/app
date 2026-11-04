import {
  createFakeServer,
  fail,
  hang,
  networkError,
  noContent,
  ok,
  rawResponse,
  type FakeServer,
} from '../testing/fakeServer';
import { createMemoryTokenStore, testSession } from '../testing/session';
import { ApiError, ApiErrorCode } from './ApiError';
import {
  createApiClient,
  MAX_RETRY_AFTER_MS,
  REQUEST_TIMEOUT_MS,
} from './client';

let server: FakeServer;

const clientFor = (session = testSession()) =>
  createApiClient({
    baseUrl: server.baseUrl,
    fetch: server.fetch,
    tokenStore: createMemoryTokenStore(session),
  });

// 던진 오류를 받는다
const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('실패해야 하는 요청이 성공했다');
    },
    (error: ApiError) => error,
  );

// 실패를 기다리는 동안 처리되지 않은 거절로 잡히지 않게 먼저 받아 둔다
const settle = (promise: Promise<unknown>) =>
  promise.then(
    value => ({ value }),
    error => ({ error }),
  );

beforeEach(() => {
  server = createFakeServer();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('응답 봉투', () => {
  it('성공 봉투면 result 를 돌려준다', async () => {
    server.on('GET', '/api/v1/memberships', ok([{ organizationId: 3 }]));

    await expect(clientFor().get('/api/v1/memberships')).resolves.toEqual([
      { organizationId: 3 },
    ]);
  });

  it('성공 봉투에 result 가 없으면(null 이라 키가 빠짐) undefined 다', async () => {
    server.on('POST', '/api/v1/participation-requests/7/cancel', ok());

    await expect(
      clientFor().post('/api/v1/participation-requests/7/cancel'),
    ).resolves.toBeUndefined();
  });

  it('204 면 본문 없이 undefined 를 돌려준다', async () => {
    server.on('DELETE', '/api/v1/push-devices/9', noContent());

    await expect(
      clientFor().delete('/api/v1/push-devices/9'),
    ).resolves.toBeUndefined();
  });

  it('실패 봉투면 status·code·message 를 담은 ApiError 를 던진다', async () => {
    server.on(
      'GET',
      '/api/v1/organizations/1/works/2',
      fail(404, 'SCHEDULE-001', { message: '작업을 찾을 수 없습니다.' }),
    );

    const error = await rejection(
      clientFor().get('/api/v1/organizations/1/works/2'),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'http',
      status: 404,
      code: 'SCHEDULE-001',
      message: '작업을 찾을 수 없습니다.',
    });
  });

  it('본문 검증 실패({필드: [메시지]})는 fieldErrors 로 담는다', async () => {
    server.on(
      'PUT',
      '/api/v1/profiles/1',
      fail(400, ApiErrorCode.badRequest, {
        message: '요청 값이 올바르지 않습니다.',
        result: { name: ['필수입니다.'], phone: ['형식이 올바르지 않습니다.'] },
      }),
    );

    const error = await rejection(
      clientFor().put('/api/v1/profiles/1', { name: '' }),
    );

    expect(error).toMatchObject({
      status: 400,
      code: 'COMMON-400',
      fieldErrors: {
        name: ['필수입니다.'],
        phone: ['형식이 올바르지 않습니다.'],
      },
    });
    expect(error.violations).toBeUndefined();
  });

  it('경로·쿼리 검증 실패([메시지])는 메시지 목록(violations)으로 담는다', async () => {
    server.on(
      'GET',
      '/api/v1/notifications',
      fail(400, ApiErrorCode.badRequest, { result: ['0보다 커야 합니다'] }),
    );

    const error = await rejection(
      clientFor().get('/api/v1/notifications', { query: { size: 0 } }),
    );

    expect(error).toMatchObject({
      code: 'COMMON-400',
      violations: ['0보다 커야 합니다'],
    });
    expect(error.fieldErrors).toBeUndefined();
  });

  it('봉투가 아닌 오류 본문(게이트웨이 HTML)도 status 를 담은 ApiError 로 던진다', async () => {
    server.on(
      'GET',
      '/api/v1/memberships',
      rawResponse(502, '<html><body>Bad Gateway</body></html>', {
        'Content-Type': 'text/html',
      }),
    );

    const error = await rejection(clientFor().get('/api/v1/memberships'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'http', status: 502 });
    expect(error.code).toBeUndefined();
  });

  it('성공 상태라도 봉투가 아니면 ApiError 로 던진다', async () => {
    server.on('GET', '/api/v1/memberships', rawResponse(200, 'not json'));

    await expect(clientFor().get('/api/v1/memberships')).rejects.toMatchObject({
      kind: 'http',
      status: 200,
    });
  });
});

describe('네트워크·타임아웃', () => {
  it('fetch 가 실패하면 kind network 로 던진다', async () => {
    server.on('GET', '/api/v1/memberships', networkError());

    await expect(clientFor().get('/api/v1/memberships')).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('15초 안에 응답이 없으면 kind timeout 으로 던지고 요청을 끊는다', async () => {
    jest.useFakeTimers();
    server.on('GET', '/api/v1/memberships', hang());

    const result = settle(clientFor().get('/api/v1/memberships'));
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(server.calls[0].signal?.aborted).toBe(false);

    await jest.advanceTimersByTimeAsync(1);

    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(await result).toMatchObject({ error: { kind: 'timeout' } });
    expect(server.calls[0].signal?.aborted).toBe(true);
  });

  it('부른 쪽이 취소하면(React Query signal) 요청을 끊고 취소를 그대로 던진다', async () => {
    server.on('GET', '/api/v1/memberships', hang());
    const controller = new AbortController();

    const result = settle(
      clientFor().get('/api/v1/memberships', { signal: controller.signal }),
    );
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    controller.abort();

    const { error } = (await result) as { error: Error };
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.name).toBe('AbortError');
    expect(server.calls[0].signal?.aborted).toBe(true);
  });

  it('이미 취소된 signal 로 부르면 보내자마자 끊는다', async () => {
    server.on('GET', '/api/v1/memberships', ok([]));
    const controller = new AbortController();
    controller.abort();

    await expect(
      clientFor().get('/api/v1/memberships', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('503 Retry-After', () => {
  const unavailable = (retryAfter?: string) =>
    fail(503, ApiErrorCode.unavailable, {
      headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
    });

  it('Retry-After 만큼 기다렸다 한 번 다시 보낸다', async () => {
    jest.useFakeTimers();
    server.on('GET', '/api/v1/memberships', unavailable('2'), ok(['다시']));

    const result = settle(clientFor().get('/api/v1/memberships'));
    await jest.advanceTimersByTimeAsync(1_999);
    expect(server.calls).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(1);

    expect(await result).toEqual({ value: ['다시'] });
    expect(server.calls).toHaveLength(2);
  });

  it('다시 보내도 503 이면 한 번만 보내고 그 오류를 던진다', async () => {
    jest.useFakeTimers();
    server.on('GET', '/api/v1/memberships', unavailable('2'));

    const result = settle(clientFor().get('/api/v1/memberships'));
    await jest.advanceTimersByTimeAsync(10_000);

    expect(await result).toMatchObject({
      error: { status: 503, code: 'COMMON-503' },
    });
    expect(server.calls).toHaveLength(2);
  });

  it('최대 5초까지만 기다린다', async () => {
    jest.useFakeTimers();
    server.on('GET', '/api/v1/memberships', unavailable('30'), ok([]));

    const result = settle(clientFor().get('/api/v1/memberships'));
    await jest.advanceTimersByTimeAsync(MAX_RETRY_AFTER_MS);

    expect(MAX_RETRY_AFTER_MS).toBe(5_000);
    expect(await result).toEqual({ value: [] });
    expect(server.calls).toHaveLength(2);
  });

  it('Retry-After 가 날짜면 그 시각까지 기다린다', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-04T00:00:00Z') });
    server.on(
      'GET',
      '/api/v1/memberships',
      unavailable('Wed, 04 Nov 2026 00:00:03 GMT'),
      ok([]),
    );

    const result = settle(clientFor().get('/api/v1/memberships'));
    await jest.advanceTimersByTimeAsync(2_999);
    expect(server.calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);

    expect(await result).toEqual({ value: [] });
  });

  it('Retry-After 가 없거나 읽을 수 없으면 다시 보내지 않는다', async () => {
    server
      .on('GET', '/api/v1/memberships', unavailable())
      .on('GET', '/api/v1/notifications', unavailable('곧'));

    await expect(clientFor().get('/api/v1/memberships')).rejects.toMatchObject({
      status: 503,
    });
    await expect(
      clientFor().get('/api/v1/notifications'),
    ).rejects.toMatchObject({ status: 503 });
    expect(server.calls).toHaveLength(2);
  });
});

describe('요청 모양', () => {
  it('쿼리 파라미터는 인코딩해 붙이고 값이 없는 것은 뺀다', async () => {
    server.on('GET', '/api/v1/organizations/lookup', ok({}));

    await clientFor().get('/api/v1/organizations/lookup', {
      query: {
        companyCode: 'A B&C=1',
        page: 0,
        unreadOnly: false,
        from: undefined,
        to: null,
      },
    });

    expect(server.calls[0].url).toBe(
      'http://localhost:8080/api/v1/organizations/lookup?companyCode=A%20B%26C%3D1&page=0&unreadOnly=false',
    );
    expect(server.calls[0].query).toEqual({
      companyCode: 'A B&C=1',
      page: '0',
      unreadOnly: 'false',
    });
  });

  it('본문은 JSON 으로 보내고 Content-Type: application/json 을 붙인다', async () => {
    server.on('POST', '/api/v1/participation-requests', ok({ requestId: 1 }));

    await clientFor().post('/api/v1/participation-requests', {
      organizationId: 3,
    });

    expect(server.calls[0].body).toEqual({ organizationId: 3 });
    expect(server.calls[0].headers).toMatchObject({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
  });

  it('본문이 없으면 Content-Type 을 붙이지 않는다', async () => {
    server.on('GET', '/api/v1/memberships', ok([]));

    await clientFor().get('/api/v1/memberships');

    expect(server.calls[0].headers['Content-Type']).toBeUndefined();
  });

  it('request 로 메서드를 직접 고를 수 있다', async () => {
    server.on('PATCH', '/api/v1/memberships', ok('patched'));

    await expect(
      clientFor().request('PATCH', '/api/v1/memberships', { body: {} }),
    ).resolves.toBe('patched');
  });
});

describe('Authorization', () => {
  it('인증 요청에는 Authorization: Bearer 를 붙인다', async () => {
    server.on('GET', '/api/v1/auth/me', ok({ accountId: 1 }));

    await clientFor(testSession({ accessToken: 'access-abc' })).get(
      '/api/v1/auth/me',
    );

    expect(server.calls[0].headers.Authorization).toBe('Bearer access-abc');
  });

  it.each([
    ['POST', '/api/v1/auth/kakao/nonces'],
    ['POST', '/api/v1/auth/kakao/login'],
    ['POST', '/api/v1/auth/apple/nonces'],
    ['POST', '/api/v1/auth/apple/login'],
    ['POST', '/api/v1/auth/refresh'],
  ] as const)(
    '공개 요청 %s %s 에는 세션이 있어도 붙이지 않는다',
    async (method, path) => {
      server.on(method, path, ok({}));

      await clientFor().request(method, path, { body: {} });

      expect(server.calls[0].headers.Authorization).toBeUndefined();
    },
  );

  it('세션이 없으면 붙이지 않고 보낸다 (서버가 COMMON-401 로 답한다)', async () => {
    server.on(
      'GET',
      '/api/v1/auth/me',
      fail(401, ApiErrorCode.noToken, { message: '인증이 필요합니다.' }),
    );

    const client = createApiClient({
      baseUrl: server.baseUrl,
      fetch: server.fetch,
      tokenStore: createMemoryTokenStore(null),
    });

    await expect(client.get('/api/v1/auth/me')).rejects.toMatchObject({
      status: 401,
      code: 'COMMON-401',
    });
    expect(server.calls[0].headers.Authorization).toBeUndefined();
  });
});

describe('설정', () => {
  it('API 주소가 없으면(Release 에 값 없음) 보내지 않고 kind config 로 던진다', async () => {
    const client = createApiClient({
      baseUrl: undefined,
      fetch: server.fetch,
      tokenStore: createMemoryTokenStore(testSession()),
    });

    const error = await rejection(client.get('/api/v1/memberships'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe('config');
    expect(server.calls).toHaveLength(0);
  });

  it('fetch 를 주지 않으면 전역 fetch 를 부를 때마다 찾아 쓴다', async () => {
    server.on('GET', '/api/v1/memberships', ok(['전역']));
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(server.fetch);
    const client = createApiClient({
      baseUrl: server.baseUrl,
      tokenStore: createMemoryTokenStore(testSession()),
    });

    await expect(client.get('/api/v1/memberships')).resolves.toEqual(['전역']);
    spy.mockRestore();
  });
});
