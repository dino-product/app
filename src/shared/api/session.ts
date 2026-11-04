import { isRecord } from '../isRecord';
import {
  ApiError,
  ApiErrorCode,
  ApiErrorMessage,
  isApiError,
} from './ApiError';
import { delay } from './delay';
import type { TokenStore } from './tokenStore';

// 로그인 세션(토큰)을 들고 access token 을 제때 다시 받는다. 사용법 (useApiClient().session):
//   await session.start(loginResponse)   로그인 응답으로 세션을 세운다 (Keychain 에 저장)
//   session.subscribe(s => …)            세션이 바뀌면(로그인·재발급·로그아웃) 받는다, onExpired(() => …) 는 만료됐을 때 한 번
// 재발급 규칙 (백엔드 HM-337): /auth/refresh 는 매번 새 access + 새 refresh 를 준다(회전).
// 30초가 지나 옛 refresh 를 다시 쓰면 서버가 세션을 철회하므로, 재발급은 한 번에 하나만 하고(single-flight) 새 값을 바로 저장한다

/** 로그인한 기기 세션. 시각은 서버가 준 ISO-8601 UTC 문자열 그대로 */
export type Session = {
  accountId: number;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

/** POST /api/v1/auth/kakao/login, /api/v1/auth/apple/login 응답 (LoginResponse) */
export type LoginResponse = Session & {
  /** 이번 로그인으로 계정이 처음 생겼는지. 가입 단계는 GET /api/v1/profiles/{accountId} 의 nextStep 으로 본다 */
  registered: boolean;
};

/** POST /api/v1/auth/refresh 응답 (RefreshedTokensResponse) */
type RefreshedTokens = Omit<Session, 'accountId'>;

export const REFRESH_PATH = '/api/v1/auth/refresh';
/** access 만료까지 이만큼 이하로 남았으면 요청 전에 미리 재발급한다 (만료는 시계 오차 없이 정각부터 거부) */
export const REFRESH_BEFORE_EXPIRY_MS = 60 * 1000;
/** 재발급 응답을 잃었을 때 다시 받기 전에 기다린다. 서버 유예(30초) 안이어야 한다 */
export const REFRESH_RETRY_DELAY_MS = 1000;
/** 다시 받는 재발급의 타임아웃. 재발급을 기다리는 요청이 최대 15초 + 1초 + 5초 = 21초 안에 끝난다 */
export const REFRESH_RETRY_TIMEOUT_MS = 5 * 1000;

const TOKEN_FIELDS = [
  'accessToken',
  'accessTokenExpiresAt',
  'refreshToken',
  'refreshTokenExpiresAt',
] as const;

/** 서버가 준 값에서 토큰 네 개를 꺼낸다. 모양이 다르면 undefined */
function pickTokens(value: unknown): RefreshedTokens | undefined {
  if (
    !isRecord(value) ||
    !TOKEN_FIELDS.every(key => typeof value[key] === 'string')
  ) {
    return undefined;
  }
  return {
    accessToken: value.accessToken as string,
    accessTokenExpiresAt: value.accessTokenExpiresAt as string,
    refreshToken: value.refreshToken as string,
    refreshTokenExpiresAt: value.refreshTokenExpiresAt as string,
  };
}

// 재발급이 거절됐다 = 세션이 끝났다 (형식 오류·만료·로그아웃·재사용을 서버가 구분하지 않고 AUTH-009 로 준다)
const isRefreshRejected = (error: unknown) =>
  isApiError(error) &&
  (error.code === ApiErrorCode.refreshRejected || error.status === 401);

// 답을 받지 못했다. 서버는 이미 처리(회전)했을 수 있다
const isLost = (error: unknown) =>
  isApiError(error) && (error.kind === 'network' || error.kind === 'timeout');

// 서버가 잠시 답하지 못했다 (다시 하면 될 수 있다)
const isTransient = (error: unknown) =>
  isLost(error) ||
  (isApiError(error) &&
    error.kind === 'http' &&
    error.status !== undefined &&
    error.status >= 500);

// 구독자 하나가 던져도 저장·다른 구독자 알림·요청을 막지 않는다. 오류는 남긴다 (세션 값은 남기지 않는다)
function notifySafely(listener: () => void) {
  try {
    listener();
  } catch (error) {
    console.error('세션 구독자가 오류를 던졌다', error);
  }
}

/** 요청을 보낸 세션. 404 뒤 다시 보낼 때 같은 계정인지 본다 */
export type Credentials = { accountId: number; accessToken: string };
const credentialsOf = ({ accountId, accessToken }: Session): Credentials => ({
  accountId,
  accessToken,
});

export type SessionManager = ReturnType<typeof createSessionManager>;

export function createSessionManager({
  store,
  refreshTokens,
  now = Date.now,
}: {
  store: TokenStore;
  /** POST /api/v1/auth/refresh 를 부른다 (공개 요청). timeoutMs 가 없으면 기본 타임아웃 */
  refreshTokens: (refreshToken: string, timeoutMs?: number) => Promise<unknown>;
  now?: () => number;
}) {
  // undefined: 아직 저장소를 읽지 않음, null: 세션 없음
  let current: Session | null | undefined;
  let loading: Promise<Session | null> | undefined;
  let renewing: Promise<Session | null> | undefined;
  const listeners = new Set<(session: Session | null) => void>();
  const expiredListeners = new Set<() => void>();

  const listen = <T>(set: Set<T>, listener: T) => {
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  };

  function load(): Promise<Session | null> {
    if (current !== undefined) {
      return Promise.resolve(current);
    }
    loading ??= store.read().then(
      stored => {
        // 읽는 동안 로그인·로그아웃했으면 그 값이 맞다
        if (current === undefined) {
          current = stored;
        }
        return current;
      },
      error => {
        loading = undefined;
        throw error;
      },
    );
    return loading;
  }

  // 메모리는 바로 바꾼다(다음 요청이 새 토큰을 쓰게). 저장소에 먼저 남기고(실패하면 한 번 더) 구독자에게 알린다.
  // 두 번 다 실패하면 던진다: 로그인·로그아웃은 부른 쪽이 알고, 재발급은 무시한다(이번 실행 동안은 메모리 토큰을 쓴다)
  async function replace(next: Session | null): Promise<void> {
    current = next;
    const write = () => (next === null ? store.clear() : store.save(next));
    try {
      await write().catch(write);
    } finally {
      // 저장하는 동안 다른 세션으로 바뀌었으면(늦게 끝난 로그인 저장 뒤의 로그아웃 등) 옛 세션을 알리지 않는다
      if (current === next) {
        listeners.forEach(listener => notifySafely(() => listener(next)));
      }
    }
  }

  const ignoreFailure = () => undefined;

  // 재발급 응답을 잃었으면(network·timeout) 1초 뒤 같은 refresh 로 한 번 더(짧은 타임아웃으로) 받는다.
  // 서버는 회전 뒤 30초 안에 같은 refresh 가 다시 오면 같은 새 토큰을 준다. 그대로 두면 다음 재발급이 옛 refresh 로 세션을 철회시킨다
  async function requestTokens(before: Session): Promise<unknown> {
    try {
      return await refreshTokens(before.refreshToken);
    } catch (error) {
      if (!isLost(error)) {
        throw error;
      }
      await delay(REFRESH_RETRY_DELAY_MS);
      // 기다리는 동안 로그아웃·다른 로그인이 있었으면 다시 보내지 않는다 (renew 가 세션이 바뀐 것을 보고 그만둔다)
      if (current !== before) {
        return undefined;
      }
      return refreshTokens(before.refreshToken, REFRESH_RETRY_TIMEOUT_MS);
    }
  }

  async function renew(): Promise<Session | null> {
    const before = await load();
    if (before === null) {
      return null;
    }
    let response: unknown;
    try {
      response = await requestTokens(before);
    } catch (error) {
      if (isRefreshRejected(error) && current === before) {
        await replace(null).catch(ignoreFailure);
        expiredListeners.forEach(notifySafely);
      }
      throw error;
    }
    // 재발급하는 동안 로그아웃·다른 로그인이 있었으면 그 세션을 되살리지도, 다른 세션의 토큰을 주지도 않는다
    if (current !== before) {
      return null;
    }
    const tokens = pickTokens(response);
    if (tokens === undefined) {
      throw new ApiError({
        kind: 'http',
        status: 200,
        message: ApiErrorMessage.invalidResponse,
      });
    }
    const next = { ...before, ...tokens };
    await replace(next).catch(ignoreFailure);
    return next;
  }

  // 동시에 여러 요청이 재발급을 원해도 /auth/refresh 는 한 번만 부르고 결과를 나눠 쓴다
  function renewOnce(): Promise<Session | null> {
    renewing ??= renew().finally(() => {
      renewing = undefined;
    });
    return renewing;
  }

  return {
    /** 지금 세션 (처음에는 Keychain 에서 읽는다). 없으면 null */
    getSession: load,
    /** 로그인 응답으로 세션을 세운다 */
    async start({
      accountId,
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
      refreshTokenExpiresAt,
    }: LoginResponse) {
      await replace({
        accountId,
        accessToken,
        accessTokenExpiresAt,
        refreshToken,
        refreshTokenExpiresAt,
      });
    },
    /** 세션을 지운다 (로그아웃·탈퇴 뒤) */
    end: () => replace(null),
    /** 세션이 바뀔 때마다 (로그인·재발급·끝) 받는다. 푸는 함수를 돌려준다 */
    subscribe: (listener: (session: Session | null) => void) =>
      listen(listeners, listener),
    /** 재발급이 거절돼 세션이 끝났을 때 한 번 받는다 → 로그인 화면으로 */
    onExpired: (listener: () => void) => listen(expiredListeners, listener),

    /**
     * 요청에 붙일 세션. 곧 만료되면 먼저 재발급한다. 세션이 없으면 undefined.
     * 재발급이 일시 오류(5xx·network·timeout)로 실패해도 access 가 아직 만료 전이면 지금 토큰을 준다
     */
    async getCredentials(): Promise<Credentials | undefined> {
      const session = await load();
      if (session === null) {
        return undefined;
      }
      const left = Date.parse(session.accessTokenExpiresAt) - now();
      if (left > REFRESH_BEFORE_EXPIRY_MS) {
        return credentialsOf(session);
      }
      try {
        const renewed = await renewOnce();
        return renewed === null ? undefined : credentialsOf(renewed);
      } catch (error) {
        if (left > 0 && isTransient(error)) {
          return credentialsOf(session);
        }
        throw error;
      }
    },
    /**
     * 서버가 이 access token 을 거절했다(COMMON-404). 이미 바뀌었으면 그 토큰을, 아니면 재발급한 토큰을 준다.
     * 요청을 보낸 뒤 로그아웃했거나 다른 계정으로 바뀌었으면 undefined (다시 보내지 않는다)
     */
    async renewAfterRejection({
      accountId,
      accessToken,
    }: Credentials): Promise<string | undefined> {
      const session = await load();
      if (session === null || session.accountId !== accountId) {
        return undefined;
      }
      if (session.accessToken !== accessToken) {
        return session.accessToken;
      }
      return (await renewOnce())?.accessToken;
    },
  };
}
