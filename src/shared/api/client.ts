import { isRecord } from '../isRecord';
import {
  ApiError,
  ApiErrorCode,
  ApiErrorMessage,
  isApiError,
} from './ApiError';
import { delay } from './delay';
import { createSessionManager, REFRESH_PATH } from './session';
import type { TokenStore } from './tokenStore';

// 서버 API 를 부른다. 사용법: `const api = useApiClient(); api.get<Membership[]>('/api/v1/memberships', { signal })`
// 봉투 { success, code, message, result } 를 풀어 result 를 돌려주고(204 는 undefined), 실패는 ApiError 로 던진다.
// 경로는 세 가지로 다룬다
// - 공개(로그인·재발급): 토큰을 붙이지 않는다
// - 로그아웃: 있는 access token 을 그대로 붙인다. 재발급·재시도는 하지 않는다 (서버는 무효 토큰이어도 204)
// - 그 밖(인증): access token 을 붙이고(곧 만료면 먼저 재발급), 만료·폐기된 토큰이 받는 COMMON-404 는 한 번 재발급해 한 번 다시 보낸다

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/** 값이 undefined·null 인 항목은 빼고 보낸다 */
export type QueryParams = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;
export type RequestOptions = {
  query?: QueryParams;
  /** JSON 으로 보낸다 */
  body?: unknown;
  /** React Query 의 queryFn 이 주는 signal. 화면을 떠나 취소하면 요청을 끊는다 */
  signal?: AbortSignal;
};
type ReadOptions = Omit<RequestOptions, 'body'>;

/** 응답이 없으면 요청을 끊고 timeout 으로 던진다 */
export const REQUEST_TIMEOUT_MS = 15 * 1000;
/** 503 의 Retry-After 를 이만큼까지만 기다린다 */
export const MAX_RETRY_AFTER_MS = 5 * 1000;

// 토큰 없이 부르는 경로 (백엔드 AuthSecurityCustomizer)
const PUBLIC_PATH_PREFIXES = ['/api/v1/auth/kakao/', '/api/v1/auth/apple/'];
/** POST, 본문 { refreshToken } 선택. Bearer 도 같이 보내야 그 access token 까지 폐기된다 */
export const LOGOUT_PATH = '/api/v1/auth/logout';
const isPublicPath = (path: string) =>
  path === REFRESH_PATH ||
  PUBLIC_PATH_PREFIXES.some(prefix => path.startsWith(prefix));

type Envelope = {
  success: boolean;
  code: string;
  message?: unknown;
  result?: unknown;
};
type RawResponse = { status: number; retryAfter: string | null; text: string };

const isEnvelope = (body: unknown): body is Envelope =>
  isRecord(body) &&
  typeof body.success === 'boolean' &&
  typeof body.code === 'string';
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');
const isFieldErrors = (value: unknown): value is Record<string, string[]> =>
  isRecord(value) && Object.values(value).every(isStringList);

function toQueryString(query: QueryParams = {}): string {
  const pairs = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  return pairs.length === 0 ? '' : `?${pairs.join('&')}`;
}

/** Retry-After(초 또는 HTTP 날짜)를 기다릴 ms 로. 읽을 수 없으면 undefined */
function retryAfterMs(value: string | null, now: number): number | undefined {
  if (value === null || value.trim() === '') {
    return undefined;
  }
  const seconds = Number(value);
  const ms = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - now;
  return Number.isNaN(ms)
    ? undefined
    : Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function unwrap<T>({ status, text }: RawResponse): T {
  if (status === 204) {
    return undefined as T;
  }
  const body = parseJson(text);
  if (!isEnvelope(body)) {
    // 게이트웨이 HTML 등 봉투가 아닌 본문
    throw new ApiError({
      kind: 'http',
      status,
      message: ApiErrorMessage.invalidResponse,
    });
  }
  if (body.success) {
    return body.result as T;
  }
  throw new ApiError({
    kind: 'http',
    status,
    code: body.code,
    message:
      typeof body.message === 'string'
        ? body.message
        : ApiErrorMessage.invalidResponse,
    fieldErrors: isFieldErrors(body.result) ? body.result : undefined,
    violations: isStringList(body.result) ? body.result : undefined,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({
  baseUrl,
  tokenStore,
  fetch: fetchImpl,
  now = Date.now,
}: {
  /** config.ts 의 apiBaseUrl. undefined 면 모든 요청이 kind 'config' 로 실패한다 */
  baseUrl: string | undefined;
  tokenStore: TokenStore;
  /** 테스트가 가짜 서버를 끼운다. 없으면 부를 때의 전역 fetch */
  fetch?: typeof fetch;
  now?: () => number;
}) {
  const callFetch: typeof fetch =
    fetchImpl ?? ((input, init) => fetch(input, init));

  // 한 번 주고받기. 본문을 다 읽을 때까지 타임아웃을 걸고, 부른 쪽의 취소도 이어 받는다
  async function exchange(
    url: string,
    init: RequestInit,
    signal: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<RawResponse> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel);
    if (signal?.aborted) {
      controller.abort();
    }
    try {
      const response = await callFetch(url, {
        ...init,
        signal: controller.signal,
      });
      return {
        status: response.status,
        retryAfter: response.headers.get('Retry-After'),
        text: response.status === 204 ? '' : await response.text(),
      };
    } catch (error) {
      if (timedOut) {
        throw new ApiError({
          kind: 'timeout',
          message: ApiErrorMessage.timeout,
        });
      }
      if (signal?.aborted) {
        throw error;
      }
      throw new ApiError({
        kind: 'network',
        message: ApiErrorMessage.network,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  async function send<T>(
    method: HttpMethod,
    path: string,
    { query, body, signal }: RequestOptions,
    accessToken?: string,
    timeoutMs: number = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    if (baseUrl === undefined) {
      throw new ApiError({ kind: 'config', message: ApiErrorMessage.config });
    }
    const url = `${baseUrl}${path}${toQueryString(query)}`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (accessToken !== undefined) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const init: RequestInit = {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    };

    let response = await exchange(url, init, signal, timeoutMs);
    // 503 COMMON-503 (DB 커넥션 대기 초과) 는 Retry-After 와 온다. 그만큼 기다려 한 번만 다시 보낸다
    const wait =
      response.status === 503
        ? retryAfterMs(response.retryAfter, now())
        : undefined;
    if (wait !== undefined) {
      // 기다리는 동안 취소되면 다시 보내지 않고 취소로 끝낸다
      await delay(wait, signal);
      response = await exchange(url, init, signal, timeoutMs);
    }
    return unwrap<T>(response);
  }

  const session = createSessionManager({
    store: tokenStore,
    now,
    refreshTokens: (refreshToken, timeoutMs) =>
      send(
        'POST',
        REFRESH_PATH,
        { body: { refreshToken } },
        undefined,
        timeoutMs,
      ),
  });

  async function request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    if (isPublicPath(path)) {
      return send<T>(method, path, options);
    }
    if (path === LOGOUT_PATH) {
      const current = await session.getSession();
      return send<T>(method, path, options, current?.accessToken);
    }
    const credentials = await session.getCredentials();
    try {
      return await send<T>(method, path, options, credentials?.accessToken);
    } catch (error) {
      // 만료·폐기된 access token 은 401 이 아니라 진짜 없는 자원과 같은 404 COMMON-404 로 온다
      if (
        credentials === undefined ||
        !isApiError(error, ApiErrorCode.notFound)
      ) {
        throw error;
      }
      const renewed = await session.renewAfterRejection(credentials);
      if (renewed === undefined) {
        throw error;
      }
      return send<T>(method, path, options, renewed);
    }
  }

  return {
    request,
    get: <T = unknown>(path: string, options?: ReadOptions) =>
      request<T>('GET', path, options),
    post: <T = unknown>(path: string, body?: unknown, options?: ReadOptions) =>
      request<T>('POST', path, { ...options, body }),
    put: <T = unknown>(path: string, body?: unknown, options?: ReadOptions) =>
      request<T>('PUT', path, { ...options, body }),
    delete: <T = unknown>(path: string, options?: ReadOptions) =>
      request<T>('DELETE', path, options),
    /** 로그인 세션 (start·end·subscribe·onExpired) */
    session,
  };
}
