import type { HttpMethod } from '../api/client';
import { DEV_API_BASE_URL } from '../api/config';

// 가짜 API 서버 (fetch 대신 끼운다). 사용법:
//   const server = createFakeServer().on('GET', '/api/v1/memberships', ok([...]));
//   createApiClient({ baseUrl: server.baseUrl, fetch: server.fetch, tokenStore }) 또는 renderWithApi(<X />, { server })
// 경로·메서드마다 응답을 차례로 주고(마지막 응답은 계속 되풀이), 받은 요청을 calls 에 남긴다.
// 정하지 않은 경로는 501 FAKE-NO-ROUTE 로 답하고, 그런 요청이 있었으면 테스트가 끝날 때 실패한다(verifyFakeServers).
// 응답은 백엔드 봉투 모양을 만드는 ok·fail·noContent 로 만든다

/** 가짜 서버가 받은 요청 */
export type RecordedCall = {
  method: HttpMethod;
  /** 보낸 주소 그대로 (인코딩한 쿼리 포함) */
  url: string;
  /** 쿼리를 뺀 경로 (/api/v1/...) */
  path: string;
  /** 디코딩한 쿼리 */
  query: Record<string, string>;
  headers: Record<string, string>;
  /** JSON 본문을 푼 값 */
  body: unknown;
  signal?: AbortSignal;
};

export type FakeResponse =
  | {
      type: 'response';
      status: number;
      text: string;
      headers: Record<string, string>;
    }
  | { type: 'networkError' }
  | { type: 'hang' };

type Handler =
  | FakeResponse
  | ((call: RecordedCall) => FakeResponse | Promise<FakeResponse>);

type ResponseOptions = { headers?: Record<string, string> };
type HttpResponse = Extract<FakeResponse, { type: 'response' }>;

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): HttpResponse => ({
  type: 'response',
  status,
  text: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', ...headers },
});

/** 성공 봉투. result 가 없으면 키를 뺀다 (백엔드 NON_NULL) */
export const ok = (result?: unknown, { headers }: ResponseOptions = {}) =>
  json(
    200,
    {
      success: true,
      code: 'COMMON-200',
      message: '요청에 성공했습니다.',
      ...(result === undefined ? {} : { result }),
    },
    headers,
  );

/** 실패 봉투. result 는 검증 실패({필드: [메시지]} 또는 [메시지])일 때만 */
export const fail = (
  status: number,
  code: string,
  {
    message = '요청을 처리하지 못했습니다.',
    result,
    headers,
  }: ResponseOptions & { message?: string; result?: unknown } = {},
) =>
  json(
    status,
    {
      success: false,
      code,
      message,
      ...(result === undefined ? {} : { result }),
    },
    headers,
  );

/** 204, 본문 없음 */
export const noContent = (): FakeResponse => ({
  type: 'response',
  status: 204,
  text: '',
  headers: {},
});

/** 봉투가 아닌 본문 (게이트웨이 HTML 등) */
export const rawResponse = (
  status: number,
  text: string,
  headers: Record<string, string> = {},
): FakeResponse => ({ type: 'response', status, text, headers });

/** fetch 가 실패한다 (기기가 오프라인, 서버가 꺼짐) */
export const networkError = (): FakeResponse => ({ type: 'networkError' });

/** 답하지 않는다. 요청이 끊겨야(abort) 끝난다 */
export const hang = (): FakeResponse => ({ type: 'hang' });

const abortError = () =>
  Object.assign(new Error('Aborted'), { name: 'AbortError' });

/** 정하지 않은 경로에 주는 오류 코드. 서버에 없는 코드라 화면 오류 처리와 섞이지 않는다 */
export const FAKE_NO_ROUTE_CODE = 'FAKE-NO-ROUTE';

// 이번 테스트에서 만든 가짜 서버들. verifyFakeServers 가 처리 못 한 요청을 모아 본다
const servers = new Set<{ takeUnhandled: () => string[] }>();

/**
 * 정하지 않은 경로로 온 요청이 있었으면 던진다. jest/setupAfterEnv.js 가 테스트마다 부른다.
 * 오타 난 경로가 오류 화면으로 보여 "오류 상태" 테스트가 거짓으로 통과하는 일을 막는다
 */
export function verifyFakeServers() {
  const unhandled = [...servers].flatMap(server => server.takeUnhandled());
  servers.clear();
  if (unhandled.length > 0) {
    throw new Error(
      `가짜 서버에 응답을 정하지 않은 요청이 있었다 (server.on 으로 정한다):\n${unhandled.join(
        '\n',
      )}`,
    );
  }
}

function parseUrl(url: string, baseUrl: string) {
  const [path, search = ''] = url.slice(baseUrl.length).split('?');
  const query: Record<string, string> = {};
  for (const pair of search.split('&').filter(Boolean)) {
    const [key, value = ''] = pair.split('=');
    query[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return { path, query };
}

function toResponse({ status, text, headers }: HttpResponse) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    text: async () => text,
  } as unknown as Response;
}

export function createFakeServer(baseUrl: string = DEV_API_BASE_URL) {
  const routes = new Map<string, { handlers: Handler[]; hits: number }>();
  const calls: RecordedCall[] = [];
  let unhandled: string[] = [];

  // 정하지 않은 요청: 기록해 두고(테스트가 끝날 때 실패) 서버에 없는 코드로 답한다
  const noRoute = (request: string) => {
    unhandled.push(request);
    return toResponse(
      fail(501, FAKE_NO_ROUTE_CODE, {
        message: `가짜 서버에 없는 경로: ${request}`,
      }),
    );
  };

  const fetch = async (
    input: RequestInfo,
    init: RequestInit = {},
  ): Promise<Response> => {
    // 실제 fetch 처럼 이미 취소된 요청은 보내지 않는다
    if (init.signal?.aborted) {
      throw abortError();
    }
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method ?? 'GET') as HttpMethod;
    if (!url.startsWith(baseUrl)) {
      return noRoute(`${method} ${url}`);
    }
    const { path, query } = parseUrl(url, baseUrl);
    const call: RecordedCall = {
      method,
      url,
      path,
      query,
      headers: { ...(init.headers as Record<string, string> | undefined) },
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      signal: init.signal ?? undefined,
    };
    calls.push(call);

    const route = routes.get(`${method} ${path}`);
    if (!route) {
      return noRoute(`${method} ${path}`);
    }
    const handler =
      route.handlers[Math.min(route.hits, route.handlers.length - 1)];
    route.hits += 1;
    const response =
      typeof handler === 'function' ? await handler(call) : handler;

    // 함수 응답을 기다리는 동안 취소됐다
    if (call.signal?.aborted) {
      throw abortError();
    }
    if (response.type === 'networkError') {
      throw new TypeError('Network request failed');
    }
    if (response.type === 'hang') {
      return new Promise((_, reject) => {
        call.signal?.addEventListener('abort', () => reject(abortError()));
      });
    }
    return toResponse(response);
  };

  const server = {
    baseUrl,
    fetch: fetch as typeof globalThis.fetch,
    /** 받은 요청 전부 (순서대로) */
    calls,
    /** 이 경로·메서드로 온 요청 */
    callsTo: (method: HttpMethod, path: string) =>
      calls.filter(call => call.method === method && call.path === path),
    /** 경로·메서드의 응답을 정한다. 여러 개면 차례로 주고 마지막 것을 되풀이한다 */
    on(method: HttpMethod, path: string, ...handlers: Handler[]) {
      routes.set(`${method} ${path}`, { handlers, hits: 0 });
      return server;
    },
    /** 정하지 않은 경로로 온 요청('GET /api/v1/x')을 꺼내고 비운다. 일부러 부르는 테스트만 쓴다 */
    takeUnhandled() {
      const taken = unhandled;
      unhandled = [];
      return taken;
    },
  };
  servers.add(server);
  return server;
}

export type FakeServer = ReturnType<typeof createFakeServer>;
