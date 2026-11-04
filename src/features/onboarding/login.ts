import { appleAuth } from '@invertase/react-native-apple-authentication';
import { login as loginWithKakao } from '@react-native-seoul/kakao-login';
import {
  ApiError,
  ApiErrorMessage,
  LOGOUT_PATH,
  type ApiClient,
  type LoginResponse,
} from '../../shared/api';
import { isRecord } from '../../shared/isRecord';
import { appStorage } from '../../shared/storage/appStorage';
import type { LoginMethod } from './model';
import { fetchProfile, type AccountProfile, type NextStep } from './profileApi';

// 카카오·Apple 로그인 (#113, 백엔드 §2.1). 사용법: `const result = await logIn(api, 'KAKAO')`
// nonce 발급 → SDK 로그인 → 서버 로그인 → 세션 저장 → 프로필 조회. 가입 단계는 로그인 응답에 없어 프로필의 nextStep 으로 본다.
// 서버는 nonce 를 서명 검증 뒤 소비하고 되돌리지 않으므로, 실패한 뒤 다시 할 때는 늘 nonce 부터 새로 받는다(부를 때마다 받는다).
// 토큰은 세션(Keychain)에만 두고 돌려주지 않는다. 부른 쪽 캐시(React Query 등)에 토큰이 남지 않는다

export type LoginResult =
  /** 사용자가 SDK 로그인 화면을 닫았다. 로그인 화면에 그대로 있고 오류를 띄우지 않는다 */
  { status: 'cancelled' } | { status: 'signedIn'; profile: AccountProfile };

const AUTH_PATHS: Record<LoginMethod, { nonce: string; login: string }> = {
  KAKAO: {
    nonce: '/api/v1/auth/kakao/nonces',
    login: '/api/v1/auth/kakao/login',
  },
  APPLE: {
    nonce: '/api/v1/auth/apple/nonces',
    login: '/api/v1/auth/apple/login',
  },
};

/** SDK 가 서버에 보낼 값을 주지 않았다 (빈 idToken 등) */
class LoginSdkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginSdkError';
  }
}

const invalidResponse = () =>
  new ApiError({
    kind: 'http',
    status: 200,
    message: ApiErrorMessage.invalidResponse,
  });

// 카카오 SDK 는 취소를 메시지로만 알린다. iOS 'ClientFailed(Cancelled)', 동의 화면에서 닫으면 'AuthFailed(AccessDenied)',
// Android 'user cancelled', 'access_denied'
const KAKAO_CANCEL_PATTERN = /cancel|denied/i;

/** 사용자가 SDK 로그인을 그만뒀는지 (실패 안내를 띄우지 않는다) */
export function isLoginCancelled(method: LoginMethod, error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (method === 'APPLE') {
    return (error as { code?: unknown }).code === appleAuth.Error.CANCELED;
  }
  return KAKAO_CANCEL_PATTERN.test(error.message);
}

async function issueNonce(api: ApiClient, method: LoginMethod) {
  const response = await api.post(AUTH_PATHS[method].nonce);
  if (
    !isRecord(response) ||
    typeof response.nonce !== 'string' ||
    response.nonce === ''
  ) {
    throw invalidResponse();
  }
  return response.nonce;
}

// 카카오톡이 있으면 카카오톡으로, 없으면 카카오계정으로 로그인한다 (라이브러리 login 이 고른다). nonce 는 그대로 넘긴다
async function kakaoCredential(nonce: string) {
  const { idToken } = await loginWithKakao({ nonce });
  if (!idToken) {
    throw new LoginSdkError('카카오가 idToken 을 주지 않았다');
  }
  return { idToken };
}

// raw nonce 를 넘기면 라이브러리가 SHA-256 소문자 hex 로 바꿔 Apple 요청에 넣는다 (서버 규칙과 같다).
// 이름·이메일은 서버가 저장하지 않으므로 묻지 않는다
async function appleCredential(nonce: string) {
  const { identityToken, authorizationCode } = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [],
    nonce,
  });
  if (!identityToken || !authorizationCode) {
    throw new LoginSdkError(
      'Apple 이 identityToken·authorizationCode 를 주지 않았다',
    );
  }
  return { idToken: identityToken, authorizationCode };
}

function parseLoginResponse(value: unknown): LoginResponse {
  if (
    !isRecord(value) ||
    typeof value.accountId !== 'number' ||
    typeof value.registered !== 'boolean' ||
    typeof value.accessToken !== 'string' ||
    typeof value.accessTokenExpiresAt !== 'string' ||
    typeof value.refreshToken !== 'string' ||
    typeof value.refreshTokenExpiresAt !== 'string'
  ) {
    throw invalidResponse();
  }
  return value as LoginResponse;
}

/**
 * 로그인하고 가입 단계(프로필)를 받는다. 취소면 { status: 'cancelled' }, 그 밖의 실패는 던진다
 * (SDK 오류, 서버 AUTH-002·003·005·006, 네트워크). 프로필을 받지 못하면 세운 세션을 끝내고 던진다
 */
export async function logIn(
  api: ApiClient,
  method: LoginMethod,
): Promise<LoginResult> {
  const nonce = await issueNonce(api, method);
  let credential: { idToken: string; authorizationCode?: string };
  try {
    credential =
      method === 'KAKAO'
        ? await kakaoCredential(nonce)
        : await appleCredential(nonce);
  } catch (error) {
    if (isLoginCancelled(method, error)) {
      return { status: 'cancelled' };
    }
    throw error;
  }

  const response = parseLoginResponse(
    await api.post(AUTH_PATHS[method].login, credential),
  );
  await api.session.start(response);
  try {
    return {
      status: 'signedIn',
      profile: await fetchProfile(api, response.accountId),
    };
  } catch (error) {
    await logOut(api);
    throw error;
  }
}

/**
 * 서버 세션을 끝내고 기기 세션을 지운다. 이 기기의 access token(Bearer)과 refresh token 을 함께 보내야 둘 다 폐기된다.
 * 서버는 늘 204 를 주지만, 닿지 못해도(네트워크 등) 기기 세션은 지운다
 */
export async function logOut(api: ApiClient): Promise<void> {
  const session = await api.session.getSession().catch(() => null);
  if (session !== null) {
    await api
      .post(LOGOUT_PATH, { refreshToken: session.refreshToken })
      .catch(() => undefined);
  }
  await api.session.end().catch(() => undefined);
}

// '최근에 로그인 했어요' (마지막으로 성공한 로그인 방식). 토큰이 아니라 방식 이름만 MMKV 에 둔다
const RECENT_LOGIN_KEY = 'auth.recentLoginMethod';
const LOGIN_METHODS: readonly string[] = ['KAKAO', 'APPLE'];

export function readRecentLoginMethod(): LoginMethod | null {
  const value = appStorage.getString(RECENT_LOGIN_KEY);
  if (value === undefined) {
    return null;
  }
  if (!LOGIN_METHODS.includes(value)) {
    appStorage.remove(RECENT_LOGIN_KEY);
    return null;
  }
  return value as LoginMethod;
}

export function saveRecentLoginMethod(method: LoginMethod) {
  appStorage.set(RECENT_LOGIN_KEY, method);
}

/** 탈퇴하면 최근 로그인 표시도 지운다 */
export function forgetRecentLoginMethod() {
  appStorage.remove(RECENT_LOGIN_KEY);
}

// 로그인한 기기의 표식과 마지막으로 서버에서 확인한 가입 단계 (#113). 켤 때 첫 렌더가 동기로 읽어 로그인 / 가입 단계 / 메인을
// 바로 그린다(세션 확인은 뒤에서 한다). 비밀이 아닌 값만 두고 토큰은 두지 않는다 (토큰은 Keychain 세션에만)
const SIGNED_IN_STEP_KEY = 'auth.signedInStep';
const NEXT_STEPS: readonly string[] = ['PROFILE', 'TERMS', 'COMPLETED'];

/** 로그인한 기기면 마지막으로 확인한 가입 단계, 아니면 null */
export function readSignedInStep(): NextStep | null {
  const value = appStorage.getString(SIGNED_IN_STEP_KEY);
  if (value === undefined) {
    return null;
  }
  if (!NEXT_STEPS.includes(value)) {
    appStorage.remove(SIGNED_IN_STEP_KEY);
    return null;
  }
  return value as NextStep;
}

/** 로그인·프로필 입력·약관 동의·세션 확인으로 가입 단계를 알게 될 때마다 남긴다 */
export function saveSignedInStep(step: NextStep) {
  appStorage.set(SIGNED_IN_STEP_KEY, step);
}

/** 로그아웃·세션 만료·탈퇴 */
export function forgetSignedInStep() {
  appStorage.remove(SIGNED_IN_STEP_KEY);
}
