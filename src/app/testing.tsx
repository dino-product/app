import { render, screen, userEvent } from '@testing-library/react-native';
import { MEMBERSHIPS_PATH } from '../features/my/memberships';
import type { NotificationResponse } from '../features/my/notificationApi';
import { notificationServer } from '../features/my/notificationTesting';
import {
  createParticipationServer,
  EXISTING_REQUESTS,
  type ServerParticipationRequest,
} from '../features/my/org/testing';
import { saveSignedInStep } from '../features/onboarding/login';
import type { NextStep } from '../features/onboarding/profileApi';
import { createLocalWorkRepository } from '../features/work/data/LocalWorkRepository';
import { makeLocalSeed } from '../features/work/data/localSeed';
import type { WorkRepository } from '../features/work/data/types';
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
//   await renderSignedInHome()                         같은 앱에서 내 작업 홈이 작업을 불러올 때까지 기다린다 (#114)
//   await renderApp({ server: accountServer({ nextStep: 'PROFILE' }) })  로그아웃 상태에서 로그인부터
//   await relaunch(app)                                같은 기기(저장된 세션·MMKV)와 같은 서버(작업 저장소 포함)로 앱을 다시 켠다
// 작업·일정·이력은 작업 저장소(로컬, features/work/data)에서 비동기로 불러오므로 화면을 연 뒤에는 그 내용이 올 때까지 기다린다 (findBy)

export const ACCOUNT_ID = 1;
export const PROFILE_PATH = `/api/v1/profiles/${ACCOUNT_ID}`;
export const LOGOUT_PATH = '/api/v1/auth/logout';
/** 탈퇴 가능 여부·탈퇴 (#115). 테스트마다 app.server.on 으로 응답을 정한다 */
export const ELIGIBILITY_PATH = `${PROFILE_PATH}/withdrawal-eligibility`;
export const WITHDRAWALS_PATH = `${PROFILE_PATH}/withdrawals`;

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

/** 내 소속 목록 (마이페이지 소속 발주사). 활성 기사 소속 하나 */
export const accountMemberships = () => [
  {
    organizationId: 1,
    organizationName: '오르빗 설비',
    role: 'TECHNICIAN',
    status: 'ACTIVE',
  },
];

/**
 * 로그인·가입 단계·로그아웃·회사 참여·내 소속을 정한 가짜 서버. 프로필은 서버처럼 이어진다:
 * 프로필 입력(PUT) → TERMS, 약관 동의(POST) → COMPLETED. nextStep 은 처음 프로필 조회가 줄 단계.
 * 회사 참여(#116)도 서버처럼 이어진다(features/my/org/testing). 가입을 마친 계정은 신청 현황에 거절 1·승인 대기 2 가 있고,
 * 새 계정은 비어 있다(requests 로 바꿀 수 있다). 사무실의 결정은 participationOf(app.server).decide 로 정한다.
 * 알림센터·알림 설정(#117)도 서버처럼 이어진다(features/my/notificationTesting). 알림은 notifications 로 바꿀 수 있다.
 * server 를 주면 그 서버에 더한다(계정·회사 참여·알림 경로는 덮어쓴다). 이 경로들의 응답을 바꾸려면 렌더한 뒤 app.server.on 으로 정한다
 */
export function accountServer({
  nextStep = 'COMPLETED',
  server = createFakeServer(),
  requests = nextStep === 'COMPLETED' ? EXISTING_REQUESTS : [],
  notifications,
}: {
  nextStep?: NextStep;
  server?: FakeServer;
  /** 처음 신청 현황 */
  requests?: readonly ServerParticipationRequest[];
  /** 알림센터 목록 (없으면 예시 7개) */
  notifications?: NotificationResponse[];
} = {}) {
  createParticipationServer({ server, requests });
  notificationServer({ server, notifications });
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
    .on('POST', LOGOUT_PATH, noContent())
    .on('GET', MEMBERSHIPS_PATH, ok({ memberships: accountMemberships() }));
}

type AppOptions = {
  server?: FakeServer;
  /** 앱을 켤 때 Keychain 에 남아 있는 세션. 없으면 로그아웃 상태 */
  session?: Session | null;
  now?: () => number;
  /** 작업 저장소 (서버의 작업 상태). 없으면 지금 기준 처음 데이터의 로컬 저장소 */
  workRepository?: WorkRepository;
};

/** 지금 기준 처음 데이터의 로컬 작업 저장소 */
export const testWorkRepository = () =>
  createLocalWorkRepository({
    seed: makeLocalSeed(new Date()),
    now: () => new Date(),
  });

export async function renderApp({
  server = accountServer(),
  session = null,
  now,
  workRepository = testWorkRepository(),
}: AppOptions = {}) {
  const api = createTestApi({ server, session, now });
  const view = await render(<App api={{ ...api, workRepository }} />);
  return { ...view, ...api, workRepository };
}

/**
 * 로그인해 둔 기기. Keychain 에 세션이, MMKV 에 마지막으로 확인한 가입 단계가 남아 있다.
 * 켜면 그 단계 화면(COMPLETED 면 메인)을 바로 그리고 뒤에서 서버 프로필로 확인한다
 */
export function renderSignedInApp({
  nextStep = 'COMPLETED',
  server,
  requests,
  notifications,
  now,
  workRepository,
}: {
  nextStep?: NextStep;
  server?: FakeServer;
  /** 처음 신청 현황 (없으면 accountServer 기본값) */
  requests?: readonly ServerParticipationRequest[];
  /** 알림센터 목록 (없으면 accountServer 기본값) */
  notifications?: NotificationResponse[];
  now?: () => number;
  workRepository?: WorkRepository;
} = {}) {
  saveSignedInStep(nextStep);
  return renderApp({
    server: accountServer({ nextStep, server, requests, notifications }),
    session: signedInSession(),
    now,
    workRepository,
  });
}

/** 앱을 끄고 같은 기기(Keychain 세션·MMKV)와 같은 서버(가짜 서버·작업 저장소)로 다시 켠다 */
export async function relaunch(app: Awaited<ReturnType<typeof renderApp>>) {
  await app.unmount();
  return renderApp({
    server: app.server,
    session: app.tokenStore.current,
    workRepository: app.workRepository,
  });
}

/** 로그인해 둔 앱을 켜고 내 작업 홈이 진행할 작업을 불러올 때까지 기다린다 */
export async function renderSignedInHome(
  options: Parameters<typeof renderSignedInApp>[0] = {},
) {
  const app = await renderSignedInApp(options);
  await findHomeLoaded();
  return app;
}

/**
 * 앱 흐름 테스트의 지금: 2026-10-21(수) 오후 2시. 로컬 저장소의 처음 데이터와 화면의 오늘·이번 주가 지금을 기준으로 정해지므로,
 * 돌리는 요일·시각(자정·주말·월초)과 관계없이 같은 화면을 보게 고정한다
 */
export const APP_TEST_NOW = new Date(2026, 9, 21, 14, 0);

/**
 * 테스트 파일 맨 위에서 부른다. Date 만 가짜로 바꾸고 실제 시간만큼 흐르게 한다 (타이머·애니메이션은 그대로)
 */
export function fixAppTestClock() {
  beforeEach(() => {
    jest.useFakeTimers({
      now: APP_TEST_NOW,
      advanceTimers: true,
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });
}

/** 로컬 저장소 처음 데이터의 오늘 진행할 작업 */
export const CURRENT_WORK_TITLE = '보일러 점검';

/** 내 작업 홈이 진행할 작업을 불러올 때까지 기다린다 */
export const findHomeLoaded = () =>
  screen.findByRole('button', { name: `${CURRENT_WORK_TITLE} 상세 보기` });

/** 작업중인 작업 상세의 완료 보고 영역까지 불러올 때까지 기다린다 */
export const findWorkDetailLoaded = () =>
  screen.findByRole('button', { name: '작업 전 사진 추가' });

/** 홈의 진행할 작업이 작업전이면 "작업 시작" 으로 시작한다 (작업중이 될 때까지 기다린다) */
export async function startCurrentWork() {
  await findHomeLoaded();
  const start = screen.queryByRole('button', { name: '작업 시작' });
  if (start) {
    await userEvent.press(start);
    await screen.findByRole('button', { name: '작업 수행중' });
  }
}

/** 홈의 진행할 작업을 시작하고 상세를 연다. 완료 보고는 작업중인 작업만 쓸 수 있다 */
export async function openStartedWorkDetail() {
  await startCurrentWork();
  await userEvent.press(await findHomeLoaded());
  await findWorkDetailLoaded();
}
