import { render } from '@testing-library/react-native';
import {
  createParticipationServer,
  EXISTING_REQUESTS,
} from '../features/my/org/testing';
import { saveSignedInStep } from '../features/onboarding/login';
import type { NextStep } from '../features/onboarding/profileApi';
import type { Session } from '../shared/api';
import {
  createFakeServer,
  noContent,
  ok,
  type FakeServer,
} from '../shared/testing/fakeServer';
import { createTestApi } from '../shared/testing/renderWithApi';
import { testSession } from '../shared/testing/session';
import App from './App';

// 앱 전체 테스트 도구 (#113). 로그인 상태는 가짜 서버와 기기에 남은 값(Keychain 세션, MMKV 가입 단계 표식)으로 만든다. 사용법:
//   await renderSignedInApp()                          가입을 마친 계정으로 로그인해 둔 앱 (메인)
//   await renderApp({ server: accountServer({ nextStep: 'PROFILE' }) })  로그아웃 상태에서 로그인부터
//   await relaunch(app)                                같은 기기(저장된 세션·MMKV)로 앱을 다시 켠다

export const ACCOUNT_ID = 1;
export const PROFILE_PATH = `/api/v1/profiles/${ACCOUNT_ID}`;
export const LOGOUT_PATH = '/api/v1/auth/logout';

const HOUR_MS = 60 * 60 * 1000;
// 오래 걸리는 시나리오나 Date.now 를 앞당기는 테스트가 재발급을 타지 않게 access token 을 길게 둔다
const LONG_LIVED_MS = 30 * 24 * HOUR_MS;

/** 로그인해 둔 기기 세션 (Keychain 에 남은 값) */
export function signedInSession(overrides: Partial<Session> = {}): Session {
  return testSession({
    accountId: ACCOUNT_ID,
    accessTokenExpiresAt: new Date(Date.now() + LONG_LIVED_MS).toISOString(),
    ...overrides,
  });
}

/** 가입 단계별 ProfileResponse */
export function accountProfile(nextStep: NextStep = 'COMPLETED') {
  const entered = nextStep !== 'PROFILE';
  const completed = nextStep === 'COMPLETED';
  return {
    accountId: ACCOUNT_ID,
    status: completed ? 'ACTIVE' : 'PENDING_SIGNUP',
    nextStep,
    name: entered ? '박기사' : null,
    phoneNumber: entered ? '01012345678' : null,
    signedUpAt: completed ? '2026-10-21T00:00:00Z' : null,
    marketingAgreed: completed ? false : null,
  };
}

/** 로그인 응답. 받을 때마다 새 토큰이 아니라 같은 값이다 (테스트는 토큰 값을 보지 않는다) */
export const loginResponse = () => ({
  accountId: ACCOUNT_ID,
  registered: false,
  accessToken: 'access-1',
  accessTokenExpiresAt: new Date(Date.now() + LONG_LIVED_MS).toISOString(),
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: new Date(Date.now() + LONG_LIVED_MS).toISOString(),
});

/**
 * 로그인·가입 단계·로그아웃·회사 참여를 정한 가짜 서버. 프로필은 서버처럼 이어진다:
 * 프로필 입력(PUT) → TERMS, 약관 동의(POST) → COMPLETED. nextStep 은 처음 프로필 조회가 줄 단계.
 * 회사 참여(#116)도 서버처럼 이어진다(features/my/org/testing). 가입을 마친 계정은 신청 현황에 거절 1·승인 대기 2 가 있고,
 * 새 계정은 비어 있다. 사무실의 결정은 participationOf(app.server).decide 로 정한다.
 * server 를 주면 그 서버에 더한다(계정 경로는 덮어쓴다). 계정 경로의 응답을 바꾸려면 렌더한 뒤 app.server.on 으로 정한다
 */
export function accountServer({
  nextStep = 'COMPLETED',
  server = createFakeServer(),
}: { nextStep?: NextStep; server?: FakeServer } = {}) {
  createParticipationServer({
    server,
    requests: nextStep === 'COMPLETED' ? EXISTING_REQUESTS : [],
  });
  let profile = accountProfile(nextStep);
  let nonce = 0;
  const issueNonce = () => {
    nonce += 1;
    return ok({ nonce: `nonce-${nonce}`, expiresAt: '2026-11-04T00:05:00Z' });
  };
  return server
    .on('POST', '/api/v1/auth/kakao/nonces', issueNonce)
    .on('POST', '/api/v1/auth/kakao/login', () => ok(loginResponse()))
    .on('POST', '/api/v1/auth/apple/nonces', issueNonce)
    .on('POST', '/api/v1/auth/apple/login', () => ok(loginResponse()))
    .on('GET', PROFILE_PATH, () => ok(profile))
    .on('PUT', PROFILE_PATH, call => {
      const { name, phoneNumber } = call.body as {
        name: string;
        phoneNumber: string;
      };
      profile = {
        ...profile,
        name,
        phoneNumber,
        nextStep: profile.nextStep === 'PROFILE' ? 'TERMS' : profile.nextStep,
      };
      return ok(profile);
    })
    .on('POST', `${PROFILE_PATH}/terms-agreements`, call => {
      const { marketing } = call.body as { marketing: boolean };
      profile = {
        ...profile,
        status: 'ACTIVE',
        nextStep: 'COMPLETED',
        signedUpAt: profile.signedUpAt ?? '2026-11-04T00:00:00Z',
        marketingAgreed: marketing,
      };
      return ok(profile);
    })
    .on('POST', LOGOUT_PATH, noContent());
}

type AppOptions = {
  server?: FakeServer;
  /** 앱을 켤 때 Keychain 에 남아 있는 세션. 없으면 로그아웃 상태 */
  session?: Session | null;
  now?: () => number;
};

export async function renderApp({
  server = accountServer(),
  session = null,
  now,
}: AppOptions = {}) {
  const api = createTestApi({ server, session, now });
  const view = await render(<App api={api} />);
  return { ...view, ...api };
}

/**
 * 로그인해 둔 기기. Keychain 에 세션이, MMKV 에 마지막으로 확인한 가입 단계가 남아 있다.
 * 켜면 그 단계 화면(COMPLETED 면 메인)을 바로 그리고 뒤에서 서버 프로필로 확인한다
 */
export function renderSignedInApp({
  nextStep = 'COMPLETED',
  server,
  now,
}: { nextStep?: NextStep; server?: FakeServer; now?: () => number } = {}) {
  saveSignedInStep(nextStep);
  return renderApp({
    server: accountServer({ nextStep, server }),
    session: signedInSession(),
    now,
  });
}

/** 앱을 끄고 같은 기기(Keychain 세션·MMKV·서버)로 다시 켠다 */
export async function relaunch(app: Awaited<ReturnType<typeof renderApp>>) {
  await app.unmount();
  return renderApp({ server: app.server, session: app.tokenStore.current });
}
