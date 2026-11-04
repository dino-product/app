// 카카오·Apple 로그인 SDK 는 네이티브 모듈이라 테스트에서는 목으로 바꾼다 (jest/setup.js).
// 기본은 로그인에 성공해 토큰을 준다. 테스트마다 jest/setupAfterEnv.js 가 기본 동작으로 되돌리고,
// 테스트는 jest.mocked(login).mockRejectedValueOnce(...) 처럼 한 번만 바꾼다

const kakaoToken = () => ({
  accessToken: 'kakao-access-token',
  refreshToken: 'kakao-refresh-token',
  idToken: 'kakao-id-token',
  accessTokenExpiresAt: '2026-11-04 12:00:00',
  refreshTokenExpiresAt: '2026-12-04 12:00:00',
  scopes: ['openid'],
});

// 라이브러리(lib/AppleAuthModule.js)와 같은 값
const appleError = {
  UNKNOWN: '1000',
  CANCELED: '1001',
  INVALID_RESPONSE: '1002',
  NOT_HANDLED: '1003',
  FAILED: '1004',
};

const appleCredential = ({ nonce }) => ({
  user: 'apple-user',
  fullName: null,
  email: null,
  realUserStatus: 1,
  authorizedScopes: [],
  state: null,
  nonce,
  identityToken: 'apple-id-token',
  authorizationCode: 'apple-authorization-code',
});

const kakao = { __esModule: true, login: jest.fn() };

const appleAuth = {
  isSupported: true,
  performRequest: jest.fn(),
  Error: appleError,
  Operation: { IMPLICIT: 0, LOGIN: 1, REFRESH: 2, LOGOUT: 3 },
  Scope: { EMAIL: 0, FULL_NAME: 1 },
};
const apple = { __esModule: true, default: appleAuth, appleAuth };

function resetLoginSdkMocks() {
  kakao.login.mockReset().mockImplementation(async () => kakaoToken());
  appleAuth.performRequest
    .mockReset()
    .mockImplementation(async options => appleCredential(options));
}

module.exports = { kakao, apple, resetLoginSdkMocks };
