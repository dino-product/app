import type { Session } from '../api/session';
import type { TokenStore } from '../api/tokenStore';

// 로그인 세션 테스트 도구. 사용법: `createMemoryTokenStore(testSession({ accessTokenExpiresAt: soon }))`
// Keychain 대신 메모리에 두고, 지금 저장된 값을 current 로 본다

const HOUR_MS = 60 * 60 * 1000;

/** 로그인한 세션. 기본은 access 1시간·refresh 30일 남음 */
export function testSession(
  overrides: Partial<Session> = {},
  now: number = Date.now(),
): Session {
  return {
    accountId: 1,
    accessToken: 'access-1',
    accessTokenExpiresAt: new Date(now + HOUR_MS).toISOString(),
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: new Date(now + 30 * 24 * HOUR_MS).toISOString(),
    ...overrides,
  };
}

export function createMemoryTokenStore(
  initial: Session | null = null,
): TokenStore & { readonly current: Session | null } {
  let saved = initial;
  return {
    read: async () => saved,
    save: async session => {
      saved = session;
    },
    clear: async () => {
      saved = null;
    },
    get current() {
      return saved;
    },
  };
}
