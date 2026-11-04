import { appleAuth } from '@invertase/react-native-apple-authentication';
import { login as loginWithKakao } from '@react-native-seoul/kakao-login';
import {
  ApiError,
  ApiErrorMessage,
  type ApiClient,
  type LoginResponse,
} from '../../shared/api';
import { isRecord } from '../../shared/isRecord';
import { appStorage } from '../../shared/storage/appStorage';
import { unregisterPushDevice } from '../push/push';
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

// 카카오 로그인 라이브러리는 취소를 메시지로만 알린다 (오류 code 는 늘 'RNKakaoLogins').
// iOS: 라이브러리가 SdkError 를 '종류(이유): 메시지' 로 바꾼다(RNKakaoLogins.describe). 로그인 창을 닫으면 ClientFailed(Cancelled),
//      동의 화면에서 취소하면 AuthFailed(AccessDenied) — 다른 카카오 래퍼(@react-native-kakao/user)도 이 둘을 사용자 취소로 본다.
// Android: 라이브러리가 SDK 오류의 message 를 그대로 준다. ClientError(Cancelled) 'user cancelled.',
//      AuthError(AccessDenied) 는 서버 error_description 'User denied access'. 모르는 메시지는 실패로 안내한다
const KAKAO_CANCEL_MESSAGES = [
  /^ClientFailed\(Cancelled\)/,
  /^AuthFailed\(AccessDenied\)/,
  /^user cancel/i,
  /^User denied access/,
];

/** 사용자가 SDK 로그인을 그만뒀는지 (실패 안내를 띄우지 않는다) */
export function isLoginCancelled(method: LoginMethod, error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (method === 'APPLE') {
    return (error as { code?: unknown }).code === appleAuth.Error.CANCELED;
  }
  return KAKAO_CANCEL_MESSAGES.some(pattern => pattern.test(error.message));
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

export type LoginOptions = {
  /**
   * 이 시도를 버린다. SDK 를 기다리는 중이면 취소로 끝내고, 늦게 온 SDK 결과로는 서버에 로그인하지 않는다.
   * 카카오톡에서 로그인을 마치지 않고 앱으로 돌아오면 SDK(iOS)가 끝을 알리지 않아 부른 쪽이 버린다
   */
  signal?: AbortSignal;
  /** SDK 로그인 화면을 기다리기 시작할 때 true, 끝나면 false */
  onSdkStage?: (inSdk: boolean) => void;
};

type Credential = { idToken: string; authorizationCode?: string };

// SDK 로그인을 기다린다. 시도를 버리면 null (늦게 온 결과·실패는 버린다)
function awaitSdk(
  method: LoginMethod,
  nonce: string,
  signal: AbortSignal | undefined,
): Promise<Credential | null> {
  const credential =
    method === 'KAKAO' ? kakaoCredential(nonce) : appleCredential(nonce);
  if (signal === undefined) {
    return credential;
  }
  credential.catch(() => undefined);
  const abandoned = new Promise<null>(resolve => {
    if (signal.aborted) {
      resolve(null);
    }
    signal.addEventListener('abort', () => resolve(null));
  });
  return Promise.race([credential, abandoned]);
}

/**
 * 로그인하고 가입 단계(프로필)를 받는다. 취소(사용자·버린 시도)면 { status: 'cancelled' }, 그 밖의 실패는 던진다
 * (SDK 오류, 서버 AUTH-002·003·005·006, 네트워크). 프로필을 받지 못하면 세운 세션을 끝내고 던진다
 */
export async function logIn(
  api: ApiClient,
  method: LoginMethod,
  { signal, onSdkStage }: LoginOptions = {},
): Promise<LoginResult> {
  const nonce = await issueNonce(api, method);
  if (signal?.aborted) {
    return { status: 'cancelled' };
  }
  let credential: Credential | null;
  onSdkStage?.(true);
  try {
    credential = await awaitSdk(method, nonce, signal);
  } catch (error) {
    if (isLoginCancelled(method, error)) {
      return { status: 'cancelled' };
    }
    throw error;
  } finally {
    onSdkStage?.(false);
  }
  if (credential === null || signal?.aborted) {
    return { status: 'cancelled' };
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
 * 기기 세션을 먼저 지우고, 떼어 둔 access token(Bearer)과 refresh token 으로 서버 세션을 끝낸다(둘 다 보내야 둘 다 폐기된다).
 * 그 전에 같은 access token 으로 푸시 기기를 해제한다(#118, 로그아웃 뒤엔 토큰이 무효라 못 부른다. 실패해도 로그아웃은 보낸다).
 * 서버 응답은 기다리지 않는다(짧은 타임아웃, 실패해도 무시). 지운 뒤에는 다른 요청의 재발급 거절이 만료로 알려지지 않는다
 */
export async function logOut(api: ApiClient): Promise<void> {
  const session = await api.session.getSession().catch(() => null);
  const ended = api.session.end().catch(() => undefined);
  if (session !== null) {
    // 해제는 짧은 타임아웃(5초)으로 끝나고, 어떻게 실패해도(저장소 예외 포함) 로그아웃은 보낸다
    unregisterPushDevice(api, session.accessToken)
      .catch(() => undefined)
      .then(() => api.logOut(session))
      .catch(() => undefined);
  }
  await ended;
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
