import { isRecord } from '../isRecord';
import {
  ApiError,
  ApiErrorCode,
  ApiErrorMessage,
  isApiError,
} from './ApiError';
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

export type SessionManager = ReturnType<typeof createSessionManager>;

export function createSessionManager({
  store,
  refreshTokens,
  now = Date.now,
}: {
  store: TokenStore;
  /** POST /api/v1/auth/refresh 를 부른다 (공개 요청) */
  refreshTokens: (refreshToken: string) => Promise<unknown>;
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

  // 메모리는 바로 바꾸고 저장소에 남긴다
  function replace(next: Session | null): Promise<void> {
    current = next;
    listeners.forEach(listener => listener(next));
    return next === null ? store.clear() : store.save(next);
  }

  // 재발급 중에는 저장에 실패해도 요청을 실패시키지 않는다. 이번 실행 동안은 메모리의 새 토큰으로 요청한다
  const ignoreFailure = () => undefined;

  async function renew(): Promise<Session | null> {
    const before = await load();
    if (before === null) {
      return null;
    }
    let tokens: RefreshedTokens | undefined;
    try {
      tokens = pickTokens(await refreshTokens(before.refreshToken));
    } catch (error) {
      if (isRefreshRejected(error) && current === before) {
        await replace(null).catch(ignoreFailure);
        expiredListeners.forEach(listener => listener());
      }
      throw error;
    }
    if (tokens === undefined) {
      throw new ApiError({
        kind: 'http',
        status: 200,
        message: ApiErrorMessage.invalidResponse,
      });
    }
    // 재발급하는 동안 로그아웃·다른 로그인이 있었으면 그 세션을 되살리지 않는다
    if (current !== before) {
      return current ?? null;
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

    /** 요청에 붙일 access token. 곧 만료되면 먼저 재발급한다. 세션이 없으면 undefined */
    async getAccessToken(): Promise<string | undefined> {
      const session = await load();
      if (session === null) {
        return undefined;
      }
      const left = Date.parse(session.accessTokenExpiresAt) - now();
      if (left > REFRESH_BEFORE_EXPIRY_MS) {
        return session.accessToken;
      }
      return (await renewOnce())?.accessToken;
    },
    /** 서버가 이 access token 을 거절했다(COMMON-404). 이미 바뀌었으면 그 토큰을, 아니면 재발급한 토큰을 준다 */
    async renewAfterRejection(
      rejectedToken: string,
    ): Promise<string | undefined> {
      const session = await load();
      if (session === null) {
        return undefined;
      }
      if (session.accessToken !== rejectedToken) {
        return session.accessToken;
      }
      return (await renewOnce())?.accessToken;
    },
  };
}
