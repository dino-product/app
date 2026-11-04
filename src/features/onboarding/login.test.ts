import { appleAuth } from '@invertase/react-native-apple-authentication';
import {
  login as loginWithKakao,
  type KakaoLoginOptions,
  type KakaoOAuthToken,
} from '@react-native-seoul/kakao-login';
import { isApiError } from '../../shared/api';
import { waitFor } from '@testing-library/react-native';
import {
  createFakeServer,
  fail,
  hang,
  networkError,
  noContent,
  ok,
  type RecordedCall,
} from '../../shared/testing/fakeServer';
import { createTestApi } from '../../shared/testing/renderWithApi';
import { testSession } from '../../shared/testing/session';
import { appStorage } from '../../shared/storage/appStorage';
import {
  forgetSignedInStep,
  isLoginCancelled,
  logIn,
  logOut,
  readRecentLoginMethod,
  readSignedInStep,
  saveRecentLoginMethod,
  saveSignedInStep,
} from './login';

// 로그인 흐름 (#113): nonce → SDK → 서버 로그인 → 세션 저장 → 프로필 조회. SDK 는 jest/loginSdk.js 의 목이다
// login 은 겹쳐 정의돼(웹·네이티브) 앱이 쓰는 네이티브 모양으로 본다
const kakaoLogin = loginWithKakao as unknown as jest.MockedFunction<
  (options: KakaoLoginOptions) => Promise<KakaoOAuthToken>
>;
const kakaoToken = (idToken: string): KakaoOAuthToken => ({
  accessToken: 'kakao-access',
  refreshToken: 'kakao-refresh',
  idToken,
  accessTokenExpiresAt: new Date(),
  refreshTokenExpiresAt: new Date(),
  scopes: [],
});
const appleRequest = jest.mocked(appleAuth.performRequest);

const loginResponse = {
  accountId: 7,
  registered: true,
  accessToken: 'server-access',
  accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  refreshToken: 'server-refresh',
  refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};
const profile = {
  accountId: 7,
  status: 'PENDING_SIGNUP',
  nextStep: 'PROFILE',
  name: null,
  phoneNumber: null,
  signedUpAt: null,
  marketingAgreed: null,
};

const PATHS = {
  KAKAO: {
    nonce: '/api/v1/auth/kakao/nonces',
    login: '/api/v1/auth/kakao/login',
  },
  APPLE: {
    nonce: '/api/v1/auth/apple/nonces',
    login: '/api/v1/auth/apple/login',
  },
} as const;
const PROFILE_PATH = '/api/v1/profiles/7';
const LOGOUT_PATH = '/api/v1/auth/logout';

// nonce 를 부를 때마다 새 값을 준다 (서버는 5분·1회용으로 발급한다)
function nonces() {
  let issued = 0;
  return () => {
    issued += 1;
    return ok({
      nonce: `nonce-${issued}`,
      expiresAt: '2026-11-04T00:05:00Z',
    });
  };
}

function loginServer(method: 'KAKAO' | 'APPLE' = 'KAKAO') {
  return createFakeServer()
    .on('POST', PATHS[method].nonce, nonces())
    .on('POST', PATHS[method].login, ok(loginResponse))
    .on('GET', PROFILE_PATH, ok(profile))
    .on('POST', LOGOUT_PATH, noContent());
}

const requests = (calls: RecordedCall[]) =>
  calls.map(call => `${call.method} ${call.path}`);

describe('logIn — 카카오', () => {
  it('nonce 발급 → 카카오 SDK(nonce 그대로) → 서버 로그인 → 세션 저장 → 프로필 조회 순서로 부르고 프로필을 돌려준다', async () => {
    const order: string[] = [];
    const server = loginServer();
    kakaoLogin.mockImplementationOnce(async options => {
      order.push(`sdk ${JSON.stringify(options)}`);
      return kakaoToken('kakao-id-token');
    });
    const api = createTestApi({ server });
    server.on('GET', PROFILE_PATH, call => {
      order.push(`profile ${call.headers.Authorization}`);
      return ok(profile);
    });

    const result = await logIn(api.client, 'KAKAO');

    expect(requests(server.calls)).toEqual([
      `POST ${PATHS.KAKAO.nonce}`,
      `POST ${PATHS.KAKAO.login}`,
      `GET ${PROFILE_PATH}`,
    ]);
    expect(order).toEqual([
      'sdk {"nonce":"nonce-1"}',
      'profile Bearer server-access',
    ]);
    expect(server.callsTo('POST', PATHS.KAKAO.login)[0].body).toEqual({
      idToken: 'kakao-id-token',
    });
    expect(api.tokenStore.current).toEqual({
      accountId: 7,
      accessToken: 'server-access',
      accessTokenExpiresAt: loginResponse.accessTokenExpiresAt,
      refreshToken: 'server-refresh',
      refreshTokenExpiresAt: loginResponse.refreshTokenExpiresAt,
    });
    expect(result).toEqual({ status: 'signedIn', profile });
  });

  it('nonce·로그인은 토큰 없이 부른다 (공개 경로)', async () => {
    const server = loginServer();
    const api = createTestApi({ server });

    await logIn(api.client, 'KAKAO');

    expect(
      server.callsTo('POST', PATHS.KAKAO.nonce)[0].headers.Authorization,
    ).toBeUndefined();
    expect(
      server.callsTo('POST', PATHS.KAKAO.login)[0].headers.Authorization,
    ).toBeUndefined();
  });

  it('카카오가 빈 idToken 을 주면 서버에 보내지 않고 실패로 다룬다', async () => {
    const server = loginServer();
    kakaoLogin.mockResolvedValueOnce(kakaoToken(''));
    const api = createTestApi({ server });

    await expect(logIn(api.client, 'KAKAO')).rejects.toThrow();
    expect(server.callsTo('POST', PATHS.KAKAO.login)).toHaveLength(0);
    expect(api.tokenStore.current).toBeNull();
  });

  it.each([
    // iOS 는 라이브러리 RNKakaoLogins.describe 가 SdkError 를 '종류(이유): 메시지' 로 바꿔 준다
    ['iOS 로그인 창 닫음', 'ClientFailed(Cancelled): no message'],
    ['iOS 동의 화면 취소', 'AuthFailed(AccessDenied): User denied access'],
    // Android 는 라이브러리가 SDK 오류의 message 를 그대로 준다 (ClientError(Cancelled), AuthError(AccessDenied))
    ['Android 로그인 창 닫음', 'user cancelled.'],
    ['Android 동의 화면 취소', 'User denied access'],
  ])(
    '사용자가 SDK 로그인을 취소하면(%s) 서버에 보내지 않고 취소로 끝낸다',
    async (_, message) => {
      const server = loginServer();
      kakaoLogin.mockRejectedValueOnce(
        Object.assign(new Error(message), { code: 'RNKakaoLogins' }),
      );
      const api = createTestApi({ server });

      await expect(logIn(api.client, 'KAKAO')).resolves.toEqual({
        status: 'cancelled',
      });
      expect(server.callsTo('POST', PATHS.KAKAO.login)).toHaveLength(0);
    },
  );

  it('앱 키가 없는 빌드처럼 SDK 가 다른 이유로 실패하면 실패로 다룬다', async () => {
    kakaoLogin.mockRejectedValueOnce(
      Object.assign(
        new Error(
          'ClientFailed(MustInitAppKey): the Kakao SDK was never initialized.',
        ),
        { code: 'RNKakaoLogins' },
      ),
    );
    const api = createTestApi({ server: loginServer() });

    await expect(logIn(api.client, 'KAKAO')).rejects.toThrow('MustInitAppKey');
  });

  it.each([
    ['AUTH-002', fail(401, 'AUTH-002')],
    ['AUTH-003', fail(401, 'AUTH-003')],
    ['네트워크', networkError()],
  ])(
    '서버 로그인이 실패하면(%s) 세션을 남기지 않고 던지며, 다시 부르면 nonce 부터 새로 받는다',
    async (_, response) => {
      const server = loginServer().on(
        'POST',
        PATHS.KAKAO.login,
        response,
        ok(loginResponse),
      );
      const api = createTestApi({ server });

      await expect(logIn(api.client, 'KAKAO')).rejects.toBeDefined();
      expect(api.tokenStore.current).toBeNull();

      await expect(logIn(api.client, 'KAKAO')).resolves.toMatchObject({
        status: 'signedIn',
      });
      expect(kakaoLogin.mock.calls.map(([options]) => options)).toEqual([
        { nonce: 'nonce-1' },
        { nonce: 'nonce-2' },
      ]);
    },
  );

  it('nonce 를 받지 못하면 SDK 를 열지 않고 던진다', async () => {
    const server = loginServer().on(
      'POST',
      PATHS.KAKAO.nonce,
      fail(503, 'COMMON-503'),
    );
    const api = createTestApi({ server });

    await expect(logIn(api.client, 'KAKAO')).rejects.toMatchObject({
      code: 'COMMON-503',
    });
    expect(kakaoLogin).not.toHaveBeenCalled();
  });

  it('nonce 응답 모양이 다르면 SDK 를 열지 않고 던진다', async () => {
    const server = loginServer().on('POST', PATHS.KAKAO.nonce, ok({}));
    const api = createTestApi({ server });

    const error = await logIn(api.client, 'KAKAO').catch(caught => caught);

    expect(isApiError(error)).toBe(true);
    expect(kakaoLogin).not.toHaveBeenCalled();
  });

  it('로그인 응답 모양이 다르면 세션을 세우지 않고 던진다', async () => {
    const server = loginServer().on(
      'POST',
      PATHS.KAKAO.login,
      ok({ accountId: 7 }),
    );
    const api = createTestApi({ server });

    const error = await logIn(api.client, 'KAKAO').catch(caught => caught);

    expect(isApiError(error)).toBe(true);
    expect(api.tokenStore.current).toBeNull();
  });

  it('프로필 조회가 실패하면 서버 세션을 끝내고 기기 세션도 지운 뒤 던진다', async () => {
    const server = loginServer().on('GET', PROFILE_PATH, networkError());
    const api = createTestApi({ server });

    await expect(logIn(api.client, 'KAKAO')).rejects.toMatchObject({
      kind: 'network',
    });
    expect(api.tokenStore.current).toBeNull();
    await waitFor(() =>
      expect(server.callsTo('POST', LOGOUT_PATH)[0]).toMatchObject({
        headers: expect.objectContaining({
          Authorization: 'Bearer server-access',
        }),
        body: { refreshToken: 'server-refresh' },
      }),
    );
  });
});

describe('logIn — Apple (iOS)', () => {
  it('nonce 발급 → Apple 요청(raw nonce, 라이브러리가 SHA-256 소문자 hex 로 바꿔 넣음) → 서버 로그인에 idToken·authorizationCode 를 보낸다', async () => {
    const server = loginServer('APPLE');
    const api = createTestApi({ server });

    const result = await logIn(api.client, 'APPLE');

    expect(requests(server.calls)).toEqual([
      `POST ${PATHS.APPLE.nonce}`,
      `POST ${PATHS.APPLE.login}`,
      `GET ${PROFILE_PATH}`,
    ]);
    expect(appleRequest).toHaveBeenCalledWith({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [],
      nonce: 'nonce-1',
    });
    expect(server.callsTo('POST', PATHS.APPLE.login)[0].body).toEqual({
      idToken: 'apple-id-token',
      authorizationCode: 'apple-authorization-code',
    });
    expect(result).toEqual({ status: 'signedIn', profile });
  });

  it.each([
    ['identityToken', { identityToken: null }],
    ['authorizationCode', { authorizationCode: null }],
  ])('%s 가 없으면 서버에 보내지 않고 실패로 다룬다', async (_, missing) => {
    const server = loginServer('APPLE');
    appleRequest.mockImplementationOnce(async options => ({
      user: 'apple-user',
      fullName: null,
      email: null,
      realUserStatus: 1,
      authorizedScopes: [],
      state: null,
      nonce: options?.nonce ?? '',
      identityToken: 'apple-id-token',
      authorizationCode: 'apple-authorization-code',
      ...missing,
    }));
    const api = createTestApi({ server });

    await expect(logIn(api.client, 'APPLE')).rejects.toThrow();
    expect(server.callsTo('POST', PATHS.APPLE.login)).toHaveLength(0);
  });

  it('사용자가 Apple 로그인을 취소하면(1001) 취소로 끝낸다', async () => {
    const server = loginServer('APPLE');
    appleRequest.mockRejectedValueOnce(
      Object.assign(new Error('The operation couldn’t be completed.'), {
        code: appleAuth.Error.CANCELED,
      }),
    );
    const api = createTestApi({ server });

    await expect(logIn(api.client, 'APPLE')).resolves.toEqual({
      status: 'cancelled',
    });
    expect(server.callsTo('POST', PATHS.APPLE.login)).toHaveLength(0);
  });

  it.each([
    ['AUTH-005', fail(401, 'AUTH-005')],
    ['AUTH-006', fail(502, 'AUTH-006')],
  ])('서버가 Apple 로그인을 거절하면(%s) 던진다', async (code, response) => {
    const server = loginServer('APPLE').on('POST', PATHS.APPLE.login, response);
    const api = createTestApi({ server });

    await expect(logIn(api.client, 'APPLE')).rejects.toMatchObject({ code });
    expect(api.tokenStore.current).toBeNull();
  });
});

describe('isLoginCancelled', () => {
  it('카카오는 취소·동의 거절 메시지만 취소로 본다', () => {
    expect(
      isLoginCancelled('KAKAO', new Error('ClientFailed(Cancelled)')),
    ).toBe(true);
    expect(isLoginCancelled('KAKAO', new Error('Token is null'))).toBe(false);
    expect(isLoginCancelled('KAKAO', 'cancelled')).toBe(false);
  });

  it.each([
    'ClientFailed(MustInitAppKey): the Kakao SDK was never initialized.',
    'ClientFailed(TokenNotFound): no message',
    'ApiFailed(Unknown): request cancelled by server',
    'AuthFailed(InvalidGrant): access denied for this app key',
    'Current activity is null. Call login() while the app is in the foreground.',
  ])(
    '취소·거절이란 말이 들어 있어도 다른 실패(%s)는 취소로 보지 않는다',
    message => {
      expect(isLoginCancelled('KAKAO', new Error(message))).toBe(false);
    },
  );

  it('Apple 은 1001(CANCELED) 만 취소로 본다', () => {
    const withCode = (code: string) =>
      Object.assign(new Error('Apple'), { code });

    expect(isLoginCancelled('APPLE', withCode('1001'))).toBe(true);
    expect(isLoginCancelled('APPLE', withCode('1000'))).toBe(false);
  });
});

describe('logOut', () => {
  it('기기 세션을 먼저 지우고, 떼어 둔 Bearer 와 refreshToken 으로 서버 세션을 끝낸다', async () => {
    const server = createFakeServer().on('POST', LOGOUT_PATH, noContent());
    const api = createTestApi({ server, session: testSession() });

    await logOut(api.client);

    expect(api.tokenStore.current).toBeNull();
    await waitFor(() =>
      expect(server.callsTo('POST', LOGOUT_PATH)).toEqual([
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access-1',
          }),
          body: { refreshToken: 'refresh-1' },
        }),
      ]),
    );
  });

  it('서버 응답을 기다리지 않고 끝난다', async () => {
    const server = createFakeServer().on('POST', LOGOUT_PATH, hang());
    const api = createTestApi({ server, session: testSession() });

    await logOut(api.client);

    expect(api.tokenStore.current).toBeNull();
    expect(server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1);
  });

  it.each([
    ['네트워크', networkError()],
    ['서버 오류', fail(500, 'COMMON-500')],
  ])('로그아웃 API 가 실패해도(%s) 기기 세션을 지운다', async (_, response) => {
    const server = createFakeServer().on('POST', LOGOUT_PATH, response);
    const api = createTestApi({ server, session: testSession() });

    await expect(logOut(api.client)).resolves.toBeUndefined();
    expect(api.tokenStore.current).toBeNull();
    await waitFor(() =>
      expect(server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1),
    );
  });

  // #118: 로그아웃 서버 요청 전에 푸시 기기를 해제한다. 해제가 어떻게 실패해도 로그아웃은 보낸다
  it('푸시 기기 해제를 먼저 보내고 그 다음 로그아웃을 보낸다', async () => {
    appStorage.set('push.deviceId', 7);
    const server = createFakeServer()
      .on('DELETE', '/api/v1/push-devices/7', noContent())
      .on('POST', LOGOUT_PATH, noContent());
    const api = createTestApi({ server, session: testSession() });

    await logOut(api.client);

    await waitFor(() =>
      expect(server.calls.map(call => `${call.method} ${call.path}`)).toEqual([
        'DELETE /api/v1/push-devices/7',
        `POST ${LOGOUT_PATH}`,
      ]),
    );
  });

  it('푸시 기기 해제가 예외를 던져도(기기 저장소 오류) 서버 로그아웃은 보낸다', async () => {
    jest.spyOn(appStorage, 'getNumber').mockImplementation(() => {
      throw new Error('storage');
    });
    const server = createFakeServer().on('POST', LOGOUT_PATH, noContent());
    const api = createTestApi({ server, session: testSession() });

    await expect(logOut(api.client)).resolves.toBeUndefined();

    await waitFor(() =>
      expect(server.callsTo('POST', LOGOUT_PATH)).toHaveLength(1),
    );
    jest.restoreAllMocks();
  });

  it('세션이 없으면 서버를 부르지 않는다', async () => {
    const server = createFakeServer();
    const api = createTestApi({ server });

    await logOut(api.client);

    expect(server.calls).toHaveLength(0);
  });
});

// 카카오톡으로 넘어갔다가 로그인을 마치지 않고 앱으로 돌아오면 SDK 가 끝을 알리지 않는다 (iOS KakaoSDKAuth).
// 부른 쪽이 그 시도를 버리면(signal) 취소로 끝내고, 늦게 온 SDK 결과로 서버에 로그인하지 않는다
describe('logIn — 버린 시도', () => {
  function pendingKakao() {
    let finish: (token: KakaoOAuthToken) => void = () => {};
    kakaoLogin.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    return (idToken: string) => finish(kakaoToken(idToken));
  }

  it('SDK 를 기다리는 중에 버리면 취소로 끝나고, 늦게 온 SDK 결과로는 서버에 로그인하지 않는다', async () => {
    const finish = pendingKakao();
    const server = loginServer();
    const api = createTestApi({ server });
    const attempt = new AbortController();

    const result = logIn(api.client, 'KAKAO', { signal: attempt.signal });
    await waitFor(() => expect(kakaoLogin).toHaveBeenCalledTimes(1));
    attempt.abort();

    await expect(result).resolves.toEqual({ status: 'cancelled' });
    finish('late-id-token');
    await Promise.resolve();
    expect(server.callsTo('POST', PATHS.KAKAO.login)).toHaveLength(0);
    expect(api.tokenStore.current).toBeNull();
  });

  it('버린 시도의 SDK 가 늦게 실패해도 처리되지 않은 거절을 남기지 않는다', async () => {
    let failLate: (error: Error) => void = () => {};
    kakaoLogin.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          failLate = reject;
        }),
    );
    const api = createTestApi({ server: loginServer() });
    const attempt = new AbortController();

    const result = logIn(api.client, 'KAKAO', { signal: attempt.signal });
    await waitFor(() => expect(kakaoLogin).toHaveBeenCalledTimes(1));
    attempt.abort();
    await expect(result).resolves.toEqual({ status: 'cancelled' });

    failLate(new Error('ClientFailed(Unknown): late'));
    await Promise.resolve();
  });

  it('SDK 단계에 들어가고 나올 때 알린다 (앱 복귀 감시용)', async () => {
    const api = createTestApi({ server: loginServer() });
    const stages: boolean[] = [];

    await logIn(api.client, 'KAKAO', {
      onSdkStage: inSdk => stages.push(inSdk),
    });

    expect(stages).toEqual([true, false]);
  });
});

describe('최근 로그인 방식', () => {
  it('저장한 방식을 기기에 남겨 다시 읽는다 (토큰이 아니다)', () => {
    expect(readRecentLoginMethod()).toBeNull();

    saveRecentLoginMethod('APPLE');

    expect(readRecentLoginMethod()).toBe('APPLE');
  });

  it('모르는 값이 남아 있으면 없는 것으로 보고 지운다', () => {
    appStorage.set('auth.recentLoginMethod', 'NAVER');

    expect(readRecentLoginMethod()).toBeNull();
    expect(appStorage.contains('auth.recentLoginMethod')).toBe(false);
  });
});

// 켤 때 첫 렌더가 바로 그릴 화면 (#113 낙관적 복원). 토큰이 아니라 로그인 여부와 마지막으로 확인한 가입 단계만 둔다
describe('로그인한 기기의 가입 단계 표식', () => {
  it('없으면 로그아웃 상태다', () => {
    expect(readSignedInStep()).toBeNull();
  });

  it('저장한 가입 단계를 동기로 다시 읽고, 지우면 로그아웃 상태다', () => {
    saveSignedInStep('TERMS');
    expect(readSignedInStep()).toBe('TERMS');

    saveSignedInStep('COMPLETED');
    expect(readSignedInStep()).toBe('COMPLETED');

    forgetSignedInStep();
    expect(readSignedInStep()).toBeNull();
  });

  it('모르는 값이 남아 있으면 로그아웃 상태로 보고 지운다', () => {
    appStorage.set('auth.signedInStep', 'DONE');

    expect(readSignedInStep()).toBeNull();
    expect(appStorage.contains('auth.signedInStep')).toBe(false);
  });

  it('세션 토큰은 기기 저장소(MMKV)에 두지 않는다', async () => {
    const api = createTestApi({ server: loginServer() });

    await logIn(api.client, 'KAKAO');
    saveSignedInStep('PROFILE');

    const stored = appStorage
      .getAllKeys()
      .map(key => appStorage.getString(key) ?? '')
      .join(' ');
    expect(stored).not.toContain('server-access');
    expect(stored).not.toContain('server-refresh');
  });
});
