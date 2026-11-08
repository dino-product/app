import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { MEMBERSHIPS_PATH } from '../features/my/memberships';
import { readSignedInStep } from '../features/onboarding/login';
import type { NextStep } from '../features/onboarding/profileApi';
import { createApiClient } from '../shared/api/client';
import type { Session } from '../shared/api/session';
import {
  createKeychainTokenStore,
  KEYCHAIN_READY_KEY,
  KEYCHAIN_SERVICE,
} from '../shared/api/tokenStore';
import { appStorage } from '../shared/storage/appStorage';
import {
  fail,
  noContent,
  ok,
  type FakeServer,
} from '../shared/testing/fakeServer';
import { createTestQueryClient } from '../shared/testing/renderWithApi';
import App from './App';
import {
  ACCOUNT_ID,
  accountMemberships,
  accountServer,
  ELIGIBILITY_PATH,
  fixAppTestClock,
  LOGOUT_PATH,
  markSampleDraftsCleared,
  PROFILE_PATH,
  testWorkRepository,
  WITHDRAWALS_PATH,
} from './testing';

// 로그인 유지 (#138): 한 번 로그인한 기기는 앱을 완전히 종료했다 다시 켜도, 오래 두었다 켜도 로그인한 채로 있다.
// 다른 앱 테스트(App.session)는 메모리 세션 저장소를 쓰지만, 여기서는 운영과 같은 Keychain 저장소(createKeychainTokenStore)로 켠다.
// 켤 때마다 세션 관리자·서버 상태 캐시는 새로 만들고, 기기에 남는 것(Keychain 목·MMKV 목)만 이어져 콜드 스타트와 같다.
// 가짜 서버는 백엔드 develop 의 기기 세션(HM-337 RefreshSession)처럼 재발급마다 refresh 를 회전하고, 회전 뒤 30초 안에
// 직전 refresh 가 다시 오면 같은 새 토큰을 다시 준다. 유예가 지난 옛 refresh·30일 넘게 쓰지 않은 refresh·폐기된 세션은 401 AUTH-009 로 거절한다
fixAppTestClock();
// 로그인 → 종료 → 다시 켜기를 여러 번 지나가 커버리지·병렬 실행에서 기본 5초를 넘을 수 있다 (App.onboarding.test 와 같다)
jest.setTimeout(20_000);

const header = (name: string) => screen.queryByRole('header', { name });
const tab = (name: string) => screen.getByRole('tab', { name });
const LOGIN_TITLE = '오늘의 현장, 한눈에. Orbit';
const HOME_TITLE = '내 작업';
const KAKAO_LOGIN_PATH = '/api/v1/auth/kakao/login';
const REFRESH_PATH = '/api/v1/auth/refresh';
const SECOND_MS = 1000;
const HOUR_MS = 60 * 60 * SECOND_MS;
const DAY_MS = 24 * HOUR_MS;
/** 백엔드 기본값: access 1시간(AUTH_ACCESS_TOKEN_TTL PT1H), refresh 미사용 수명 30일(AUTH_REFRESH_TOKEN_IDLE_LIFETIME P30D) */
const ACCESS_TTL_MS = HOUR_MS;
const REFRESH_IDLE_MS = 30 * DAY_MS;
/** 회전 뒤 직전 refresh 를 다시 받아 주는 시간 (RefreshSession.REPLAY_GRACE) */
const REPLAY_GRACE_MS = 30 * SECOND_MS;

// 백엔드가 주는 모양의 토큰. refresh 는 '<세션 식별자 UUID 36자>.<비밀값 base64url 43자>' (RefreshTokenValue)
const DEVICE_SESSION_ID = '7f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b';
const refreshToken = (n: number) =>
  `${DEVICE_SESSION_ID}.${`r${n}`.padEnd(43, 'x')}`;
const accessToken = (n: number) => `eyJhbGciOiJIUzI1NiJ9.access${n}.signature`;
// 시각은 초 단위로 자른 ISO-8601 UTC (Instant, 예: 2026-10-21T06:00:00Z)
const instantAfter = (ms: number) =>
  new Date(Math.floor((Date.now() + ms) / SECOND_MS) * SECOND_MS)
    .toISOString()
    .replace('.000Z', 'Z');

// 프리셋의 Alert 는 네이티브 목으로 이어지므로 띄우지 않게 막는다
const spyAlert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

/**
 * 백엔드처럼 로그인마다 기기 세션을 새로 열고 재발급마다 refresh 를 회전하는 가짜 서버.
 * 로그인·가입 단계·마이·로그아웃·탈퇴 경로는 accountServer 가 준다
 */
function deviceSessionServer({ nextStep }: { nextStep?: NextStep } = {}) {
  const tokensOf = (n: number) => ({
    accessToken: accessToken(n),
    accessTokenExpiresAt: instantAfter(ACCESS_TTL_MS),
    refreshToken: refreshToken(n),
    refreshTokenExpiresAt: instantAfter(REFRESH_IDLE_MS),
  });
  let issued = 0;
  // 기기 세션: 지금 refresh 와 그 만료 시각, 마지막으로 준 토큰, 회전 직전 refresh 와 회전 시각(유예).
  // 로그아웃·탈퇴·폐기로 세션이 없으면 null
  let current: {
    token: string;
    expiresAt: number;
    tokens: ReturnType<typeof tokensOf>;
    previous?: { token: string; rotatedAt: number };
  } | null = null;
  const issue = (rotatedFrom?: string) => {
    issued += 1;
    const tokens = tokensOf(issued);
    current = {
      token: tokens.refreshToken,
      expiresAt: Date.now() + REFRESH_IDLE_MS,
      tokens,
      previous:
        rotatedFrom === undefined
          ? undefined
          : { token: rotatedFrom, rotatedAt: Date.now() },
    };
    return tokens;
  };
  const server = accountServer({ nextStep })
    .on('POST', KAKAO_LOGIN_PATH, () =>
      ok({ accountId: ACCOUNT_ID, registered: false, ...issue() }),
    )
    // RefreshedTokensResponse 는 accountId·registered 없이 토큰 네 값만 준다
    .on('POST', REFRESH_PATH, call => {
      const presented = (call.body as { refreshToken?: unknown }).refreshToken;
      if (current !== null && Date.now() < current.expiresAt) {
        // ROTATED: 지금 refresh 면 다음 토큰으로 회전한다
        if (presented === current.token) {
          return ok(issue(current.token));
        }
        // REPLAYED: 회전 뒤 30초 안에 직전 refresh 가 다시 오면(동시 요청·응답 유실) 이미 준 새 토큰을 다시 준다
        if (
          current.previous !== undefined &&
          presented === current.previous.token &&
          Date.now() < current.previous.rotatedAt + REPLAY_GRACE_MS
        ) {
          return ok(current.tokens);
        }
      }
      // EXPIRED·REUSED(유예가 지난 옛 refresh)·없는 세션: 세션을 지우고 거절한다
      current = null;
      return fail(401, 'AUTH-009', {
        message:
          '로그인 유지 정보가 유효하지 않거나 만료되었습니다. 다시 로그인해 주세요.',
      });
    })
    .on('POST', LOGOUT_PATH, () => {
      current = null;
      return noContent();
    });
  return {
    server,
    /** 서버가 이 기기 세션을 지웠다 (재사용 탐지·계정 폐쇄 등) */
    revoke: () => {
      current = null;
    },
  };
}

// 기기의 네트워크. 끊기면 요청이 서버에 닿지 못하고 fetch 가 실패한다.
// lostResponses 만큼은 요청이 서버에 닿아 처리된 뒤 응답을 잃는다 (약한 신호 등)
const network = { online: true, failed: 0, lostResponses: 0 };

/**
 * 앱을 켠다. 운영과 같은 Keychain 세션 저장소로, 세션 관리자·서버 상태 캐시는 새로 만든다
 * (기기에 남는 Keychain·MMKV 만 앞 실행에서 이어진다)
 */
async function coldStart(server: FakeServer) {
  markSampleDraftsCleared();
  const client = createApiClient({
    baseUrl: server.baseUrl,
    tokenStore: createKeychainTokenStore(),
    fetch: async (input, init) => {
      if (!network.online) {
        network.failed += 1;
        throw new TypeError('Network request failed');
      }
      const response = await server.fetch(input, init);
      if (network.lostResponses > 0) {
        network.lostResponses -= 1;
        throw new TypeError('Network request failed');
      }
      return response;
    },
  });
  const view = await render(
    <App
      api={{
        client,
        queryClient: createTestQueryClient(),
        workRepository: testWorkRepository(),
      }}
    />,
  );
  return { ...view, client };
}

/** 처음 설치한 기기에서 카카오로 로그인해 메인까지 간 뒤 앱을 완전히 종료한다 */
async function signInOnce(server: FakeServer) {
  const app = await coldStart(server);
  await userEvent.press(
    screen.getByRole('button', { name: '카카오로 시작하기' }),
  );
  await screen.findByRole('header', { name: HOME_TITLE });
  await app.unmount();
}

/** 앱을 끈 채로 시간이 흐른다 */
const elapse = (ms: number) => jest.setSystemTime(Date.now() + ms);

/** Keychain 에 남은 세션. 없으면 null */
async function keychainSession(): Promise<Session | null> {
  const saved = await Keychain.getGenericPassword({
    service: KEYCHAIN_SERVICE,
  });
  return saved ? (JSON.parse(saved.password) as Session) : null;
}

const sessionOf = (n: number) =>
  expect.objectContaining({
    accountId: ACCOUNT_ID,
    accessToken: accessToken(n),
    refreshToken: refreshToken(n),
  });

const pressAlertButton = async (
  alert: ReturnType<typeof spyAlert>,
  text: string,
) => {
  const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  await act(() => buttons.find(item => item.text === text)?.onPress?.());
};

beforeEach(() => {
  network.online = true;
  network.failed = 0;
  network.lostResponses = 0;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('App — 로그인 유지 (#138)', () => {
  describe('다시 켜기', () => {
    it('가입을 마치고 로그인한 기기는 앱을 완전히 종료했다가 다시 켜면 로그인 화면 없이 메인 탭으로 들어간다', async () => {
      const { server } = deviceSessionServer();
      await signInOnce(server);
      // 첫 실행 정리(지난 설치의 Keychain 세션 지우기)는 한 번만 하고 표식을 남긴다
      expect(appStorage.getBoolean(KEYCHAIN_READY_KEY)).toBe(true);
      expect(await keychainSession()).toEqual(sessionOf(1));

      elapse(10 * 60 * SECOND_MS);
      await coldStart(server);

      // 첫 렌더부터 메인이다 (로그인 화면을 거치지 않는다)
      expect(header(HOME_TITLE)).toBeOnTheScreen();
      expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
      expect(tab('홈')).toBeSelected();
      // 뒤에서 Keychain 세션으로 계정을 확인한다 (다시 로그인하지 않는다)
      await waitFor(() =>
        expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(2),
      );
      expect(server.callsTo('GET', PROFILE_PATH)[1].headers.Authorization).toBe(
        `Bearer ${accessToken(1)}`,
      );
      expect(server.callsTo('POST', KAKAO_LOGIN_PATH)).toHaveLength(1);
      expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(0);
      expect(header(HOME_TITLE)).toBeOnTheScreen();
      expect(await keychainSession()).toEqual(sessionOf(1));
    });

    it('가입 단계 도중 종료했으면 다시 켤 때 로그인 없이 그 단계(약관 동의)부터 이어 간다', async () => {
      const { server } = deviceSessionServer({ nextStep: 'PROFILE' });
      const first = await coldStart(server);
      await userEvent.press(
        screen.getByRole('button', { name: '카카오로 시작하기' }),
      );
      // 글자 단위 입력·서식은 화면 테스트가 본다. 여기서는 흐름만 보므로 값을 한 번에 넣는다
      await fireEvent.changeText(
        await screen.findByLabelText('이름'),
        '박기사',
      );
      await fireEvent.changeText(
        screen.getByLabelText('연락처'),
        '01012345678',
      );
      await userEvent.press(screen.getByRole('button', { name: '완료' }));
      await screen.findByRole('header', {
        name: '서비스 이용을 위해 동의가 필요해요',
      });
      await first.unmount();

      await coldStart(server);

      expect(header('서비스 이용을 위해 동의가 필요해요')).toBeOnTheScreen();
      expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
      await waitFor(() =>
        expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(2),
      );
      expect(readSignedInStep()).toBe('TERMS');
      expect(server.callsTo('POST', KAKAO_LOGIN_PATH)).toHaveLength(1);
    });

    it('Keychain 읽기가 늦어도 첫 렌더는 메인이고, 다 읽으면 그 세션으로 확인한다', async () => {
      const { server } = deviceSessionServer();
      await signInOnce(server);
      const read = Keychain.getGenericPassword;
      let release = () => {};
      const slow = new Promise<void>(resolve => {
        release = resolve;
      });
      jest
        .spyOn(Keychain, 'getGenericPassword')
        .mockImplementationOnce(async options => {
          await slow;
          return read(options);
        });

      await coldStart(server);

      expect(header(HOME_TITLE)).toBeOnTheScreen();
      expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(1);

      await act(async () => release());

      await waitFor(() =>
        expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(2),
      );
      expect(header(HOME_TITLE)).toBeOnTheScreen();
    });

    it('Keychain 을 잠시 읽지 못해도(잠금 직후 등) 로그아웃하지 않고, 다음 요청에서 다시 읽어 이어 간다', async () => {
      const alert = spyAlert();
      const { server } = deviceSessionServer();
      await signInOnce(server);
      jest
        .spyOn(Keychain, 'getGenericPassword')
        .mockRejectedValueOnce(new Error('errSecInteractionNotAllowed'));

      await coldStart(server);
      await act(async () => {});

      expect(header(HOME_TITLE)).toBeOnTheScreen();
      expect(alert).not.toHaveBeenCalled();
      expect(readSignedInStep()).toBe('COMPLETED');
      expect(await keychainSession()).toEqual(sessionOf(1));

      await userEvent.press(tab('마이'));

      expect(
        await screen.findByRole('button', { name: /^박기사/ }),
      ).toBeOnTheScreen();
      expect(
        server.callsTo('GET', MEMBERSHIPS_PATH)[0].headers.Authorization,
      ).toBe(`Bearer ${accessToken(1)}`);
    });
  });

  describe('access 만료 뒤 재발급', () => {
    it('앱을 끈 사이 access 가 만료됐으면(refresh 유효) 켤 때 재발급해 새 세션을 Keychain 에 저장하고 메인에 머문다', async () => {
      const alert = spyAlert();
      const { server } = deviceSessionServer();
      await signInOnce(server);

      elapse(2 * HOUR_MS);
      await coldStart(server);

      expect(header(HOME_TITLE)).toBeOnTheScreen();
      await waitFor(() =>
        expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(2),
      );
      // 재발급 계약: POST /api/v1/auth/refresh, Bearer 없이 { refreshToken } 만 (RefreshTokensRequest)
      const [refresh] = server.callsTo('POST', REFRESH_PATH);
      expect(refresh.body).toEqual({ refreshToken: refreshToken(1) });
      expect(refresh.headers.Authorization).toBeUndefined();
      // 새 access 로 확인하고, 회전된 refresh 까지 Keychain 에 바꿔 둔다 (accountId 는 그대로)
      expect(server.callsTo('GET', PROFILE_PATH)[1].headers.Authorization).toBe(
        `Bearer ${accessToken(2)}`,
      );
      expect(await keychainSession()).toEqual(sessionOf(2));
      expect(header(HOME_TITLE)).toBeOnTheScreen();
      expect(alert).not.toHaveBeenCalled();
    });

    it('재발급한 뒤 다시 켜면 회전된 새 refresh 로 이어 가고, 30일 안에 한 번씩 켜면 계속 로그인돼 있다', async () => {
      const alert = spyAlert();
      const { server } = deviceSessionServer();
      await signInOnce(server);

      // 미사용 수명(30일)은 재발급마다 다시 센다. 29일마다 켜면 끊기지 않는다
      for (let launch = 2; launch <= 4; launch += 1) {
        elapse(29 * DAY_MS);
        const app = await coldStart(server);
        await waitFor(() =>
          expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(launch - 1),
        );
        expect(server.callsTo('POST', REFRESH_PATH).at(-1)?.body).toEqual({
          refreshToken: refreshToken(launch - 1),
        });
        await waitFor(async () =>
          expect(await keychainSession()).toEqual(sessionOf(launch)),
        );
        expect(header(HOME_TITLE)).toBeOnTheScreen();
        await app.unmount();
      }
      expect(alert).not.toHaveBeenCalled();
      expect(server.callsTo('POST', KAKAO_LOGIN_PATH)).toHaveLength(1);
    });

    it('쓰는 중 access 가 만료되면 API 를 부르기 전에 재발급하고 새 세션을 Keychain 에 저장한다', async () => {
      const { server } = deviceSessionServer();
      await signInOnce(server);
      await coldStart(server);
      await waitFor(() =>
        expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(2),
      );

      // 켜 둔 채 1시간 넘게 지났다
      elapse(ACCESS_TTL_MS + SECOND_MS);
      await userEvent.press(tab('마이'));

      expect(
        await screen.findByLabelText('오르빗 설비, 기사, 활성'),
      ).toBeOnTheScreen();
      expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
      expect(
        server.callsTo('GET', MEMBERSHIPS_PATH)[0].headers.Authorization,
      ).toBe(`Bearer ${accessToken(2)}`);
      expect(await keychainSession()).toEqual(sessionOf(2));
    });

    it('서버가 지금 access 를 거절하면(만료·폐기 토큰은 404 COMMON-404) 한 번 재발급해 다시 보내고 새 세션을 Keychain 에 저장한다', async () => {
      const { server } = deviceSessionServer();
      await signInOnce(server);
      await coldStart(server);
      await waitFor(() =>
        expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(2),
      );
      server.on('GET', MEMBERSHIPS_PATH, call =>
        call.headers.Authorization === `Bearer ${accessToken(1)}`
          ? fail(404, 'COMMON-404')
          : ok({ memberships: accountMemberships() }),
      );

      await userEvent.press(tab('마이'));

      expect(
        await screen.findByLabelText('오르빗 설비, 기사, 활성'),
      ).toBeOnTheScreen();
      expect(
        server
          .callsTo('GET', MEMBERSHIPS_PATH)
          .map(call => call.headers.Authorization),
      ).toEqual([`Bearer ${accessToken(1)}`, `Bearer ${accessToken(2)}`]);
      expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
      expect(await keychainSession()).toEqual(sessionOf(2));
      expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
    });

    it('서버는 회전했는데 재발급 응답을 잃으면 1초 뒤 같은 refresh 로 다시 받아(유예 30초) 그 새 토큰을 저장하고, 다음 실행도 이어 간다', async () => {
      const alert = spyAlert();
      const { server } = deviceSessionServer();
      await signInOnce(server);
      elapse(2 * HOUR_MS);
      network.lostResponses = 1;

      const app = await coldStart(server);

      await waitFor(
        () => expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(2),
        { timeout: 5000 },
      );
      expect(
        server.callsTo('POST', REFRESH_PATH).map(call => call.body),
      ).toEqual([
        { refreshToken: refreshToken(1) },
        { refreshToken: refreshToken(1) },
      ]);
      expect(await keychainSession()).toEqual(sessionOf(2));

      // 옛 refresh 를 남겨 두었다면 유예가 지난 다음 실행에서 재사용으로 거절된다
      await app.unmount();
      elapse(2 * HOUR_MS);
      await coldStart(server);

      await waitFor(() =>
        expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(3),
      );
      expect(server.callsTo('POST', REFRESH_PATH)[2].body).toEqual({
        refreshToken: refreshToken(2),
      });
      await waitFor(async () =>
        expect(await keychainSession()).toEqual(sessionOf(3)),
      );
      expect(header(HOME_TITLE)).toBeOnTheScreen();
      expect(alert).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['켤 때 재발급이 5xx 면', 2 * HOUR_MS, REFRESH_PATH, 'POST'] as const,
    ['켤 때 계정 확인이 5xx 면', 0, PROFILE_PATH, 'GET'] as const,
  ])(
    '%s 서버에 닿지 못한 것으로 보고 로그아웃하지 않고 메인에 머문다',
    async (_, closedFor, path, method) => {
      const alert = spyAlert();
      const { server } = deviceSessionServer();
      await signInOnce(server);
      elapse(closedFor);
      server.on(method, path, fail(500, 'COMMON-500'));

      await coldStart(server);

      await waitFor(() => expect(server.callsTo(method, path)).not.toEqual([]));
      await act(async () => {});
      expect(header(HOME_TITLE)).toBeOnTheScreen();
      expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
      expect(alert).not.toHaveBeenCalled();
      expect(readSignedInStep()).toBe('COMPLETED');
      expect(await keychainSession()).toEqual(sessionOf(1));
    },
  );

  it('네트워크가 없으면 켤 때 로그아웃하지 않고 메인에 머물며, 연결된 뒤 지금 화면에서 다시 시도하면 재발급해 이어 간다', async () => {
    const alert = spyAlert();
    const { server } = deviceSessionServer();
    await signInOnce(server);
    elapse(2 * HOUR_MS);
    network.online = false;

    await coldStart(server);

    // 켤 때 확인 전의 재발급이 서버에 닿지 못한다 (응답 유실로 보고 1초 뒤 한 번 더 받아도 실패)
    await waitFor(() => expect(network.failed).toBe(2), { timeout: 5000 });
    expect(header(HOME_TITLE)).toBeOnTheScreen();
    expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();
    expect(alert).not.toHaveBeenCalled();
    expect(readSignedInStep()).toBe('COMPLETED');
    expect(await keychainSession()).toEqual(sessionOf(1));

    await userEvent.press(tab('마이'));
    expect(
      await screen.findByText('프로필을 불러오지 못했어요.', undefined, {
        timeout: 5000,
      }),
    ).toBeOnTheScreen();
    expect(header(LOGIN_TITLE)).not.toBeOnTheScreen();

    network.online = true;
    // 영역(프로필·소속 등)마다 다시 시도한다. 받아 오면 그 영역의 버튼이 사라지므로 누를 때마다 다시 찾는다
    const retryButtons = () =>
      screen.queryAllByRole('button', { name: '다시 시도' });
    for (let retry = retryButtons()[0]; retry; retry = retryButtons()[0]) {
      await userEvent.press(retry);
      await waitFor(() => expect(retryButtons()).not.toContain(retry));
    }

    expect(
      await screen.findByRole('button', { name: /^박기사/ }),
    ).toBeOnTheScreen();
    expect(
      await screen.findByLabelText('오르빗 설비, 기사, 활성'),
    ).toBeOnTheScreen();
    expect(server.callsTo('POST', REFRESH_PATH)).toHaveLength(1);
    expect(await keychainSession()).toEqual(sessionOf(2));
    expect(alert).not.toHaveBeenCalled();
  });

  it.each([
    ['30일 넘게 켜지 않아 refresh 가 만료됐으면', () => elapse(31 * DAY_MS)],
    [
      '서버가 이 기기 세션을 폐기했으면(재사용 탐지 등)',
      (revoke: () => void) => {
        elapse(2 * HOUR_MS);
        revoke();
      },
    ],
  ])(
    '%s 재발급 거부(401 AUTH-009)에 세션을 지우고 로그인 화면으로 가 다시 로그인 안내를 보인다',
    async (_, expire) => {
      const alert = spyAlert();
      const { server, revoke } = deviceSessionServer();
      await signInOnce(server);
      expire(revoke);

      const app = await coldStart(server);

      expect(
        await screen.findByRole('header', { name: LOGIN_TITLE }),
      ).toBeOnTheScreen();
      expect(alert).toHaveBeenCalledWith(
        '다시 로그인해 주세요',
        '로그인한 지 오래되어 로그아웃됐어요.',
      );
      expect(await keychainSession()).toBeNull();
      expect(readSignedInStep()).toBeNull();
      expect(server.callsTo('GET', PROFILE_PATH)).toHaveLength(1);

      // 다음 실행도 로그인 화면이고, 지운 세션으로 서버를 부르지 않는다
      await app.unmount();
      const calls = server.calls.length;
      await coldStart(server);
      expect(header(LOGIN_TITLE)).toBeOnTheScreen();
      expect(server.calls).toHaveLength(calls);
    },
  );

  describe('로그아웃·탈퇴', () => {
    async function openAccountMenu(server: FakeServer) {
      await signInOnce(server);
      const app = await coldStart(server);
      await userEvent.press(tab('마이'));
      await userEvent.press(
        await screen.findByRole('button', { name: '계정 관리' }),
      );
      return app;
    }

    it('로그아웃하면 Keychain 세션을 지우고, 다음 실행은 로그인 화면이다', async () => {
      const { server } = deviceSessionServer();
      const app = await openAccountMenu(server);

      await userEvent.press(screen.getByRole('button', { name: '로그아웃' }));
      await userEvent.press(screen.getByRole('button', { name: '확인' }));

      expect(
        await screen.findByRole('header', { name: LOGIN_TITLE }),
      ).toBeOnTheScreen();
      expect(await keychainSession()).toBeNull();
      expect(readSignedInStep()).toBeNull();
      await waitFor(() =>
        expect(server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1),
      );
      expect(server.callsTo('POST', LOGOUT_PATH)[0]).toMatchObject({
        headers: expect.objectContaining({
          Authorization: `Bearer ${accessToken(1)}`,
        }),
        body: { refreshToken: refreshToken(1) },
      });

      await app.unmount();
      const calls = server.calls.length;
      await coldStart(server);
      expect(header(LOGIN_TITLE)).toBeOnTheScreen();
      expect(server.calls).toHaveLength(calls);
    });

    it('탈퇴하면 Keychain 세션을 지우고, 다음 실행은 로그인 화면이다', async () => {
      const alert = spyAlert();
      const { server } = deviceSessionServer();
      server
        .on('GET', ELIGIBILITY_PATH, ok({ withdrawable: true, blocks: [] }))
        .on('POST', WITHDRAWALS_PATH, noContent());
      const app = await openAccountMenu(server);

      await userEvent.press(screen.getByRole('button', { name: '계정 탈퇴' }));
      await userEvent.type(
        await screen.findByLabelText('탈퇴 사유 입력'),
        '더 이상 쓰지 않아요',
      );
      await userEvent.press(screen.getByRole('button', { name: '탈퇴하기' }));
      await pressAlertButton(alert, '탈퇴');

      expect(
        await screen.findByRole('header', { name: LOGIN_TITLE }),
      ).toBeOnTheScreen();
      expect(await keychainSession()).toBeNull();
      expect(readSignedInStep()).toBeNull();

      await app.unmount();
      const calls = server.calls.length;
      await coldStart(server);
      expect(header(LOGIN_TITLE)).toBeOnTheScreen();
      expect(server.calls).toHaveLength(calls);
    });
  });

  it('토큰은 Keychain 에만 두고, 로그인·재발급·다시 켜기 내내 MMKV 와 console 에 남기지 않는다', async () => {
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const spies = methods.map(method => jest.spyOn(console, method));
    const { server } = deviceSessionServer();
    await signInOnce(server);
    elapse(2 * HOUR_MS);
    await coldStart(server);
    await waitFor(async () =>
      expect(await keychainSession()).toEqual(sessionOf(2)),
    );

    const tokens = [1, 2].flatMap(n => [accessToken(n), refreshToken(n)]);
    // 앞뒤를 바꿔 남긴 경우도 잡게 비밀 부분(refresh 의 비밀값, access 의 본문)만 따로도 본다
    const secrets = tokens.map(token => token.split('.')[1]);
    const stored = appStorage
      .getAllKeys()
      .map(key => `${key}=${appStorage.getString(key) ?? ''}`)
      .join('\n');
    const printed = JSON.stringify(spies.map(spy => spy.mock.calls));
    for (const value of [...tokens, ...secrets]) {
      expect(stored).not.toContain(value);
      expect(printed).not.toContain(value);
    }
  });
});
