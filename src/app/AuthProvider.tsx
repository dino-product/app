import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';
import {
  forgetRecentLoginMethod,
  logIn as logInWith,
  logOut,
  readRecentLoginMethod,
  saveRecentLoginMethod,
} from '../features/onboarding/login';
import type { LoginMethod } from '../features/onboarding/model';
import {
  fetchProfile,
  ProfileErrorCode,
  type AccountProfile,
} from '../features/onboarding/profileApi';
import {
  ApiErrorCode,
  isApiError,
  useApiClient,
  type ApiClient,
} from '../shared/api';
import { clearNavigationState } from './navigation/persistence';

// 로그인 상태 (#113). 서버 세션(Keychain)과 그 계정의 프로필(가입 단계)로 정한다.
// 앱을 켜면 저장된 세션으로 프로필을 조회해 가입 단계 화면으로 연다. 조회하는 동안은 첫 화면 배경만 보인다(SessionGate).
// 루트 내비게이터가 phase 로 화면 묶음(로그인 / 가입 단계 / 메인)을 바꾼다

/**
 * restoring: 저장된 세션·프로필을 읽는 중 · restoreFailed: 서버에 닿지 못해 다시 시도를 기다림 ·
 * signedOut: 로그인 화면 · signUp: 가입 단계(프로필 등록 → 약관 동의 → 회사 참여) · main: 메인
 */
export type AuthPhase =
  | 'restoring'
  | 'restoreFailed'
  | 'signedOut'
  | 'signUp'
  | 'main';

type AuthState =
  | { status: 'restoring' | 'restoreFailed' | 'signedOut' }
  | {
      status: 'signedIn';
      profile: AccountProfile;
      /** 이번 가입에서 약관까지 마쳤고 회사 참여 단계에 있다. 가입은 끝났지만 시작하기 전까지 가입 단계 화면에 머문다 */
      joining: boolean;
    };

// 같은 상태로 다시 정하면 React 가 그리지 않게 고정 값을 쓴다
const RESTORING: AuthState = { status: 'restoring' };
const RESTORE_FAILED: AuthState = { status: 'restoreFailed' };
const SIGNED_OUT: AuthState = { status: 'signedOut' };

/** 로그인 버튼 결과. busy: 앞 로그인이 아직 진행 중이라 무시했다 */
export type LoginOutcome = 'signedIn' | 'cancelled' | 'failed' | 'busy';

type Auth = {
  phase: AuthPhase;
  /** 로그인한 계정 id. 로그아웃(복원 중 포함)이면 null. AppStateProvider 가 null 이 되면 기기의 목 상태를 비운다 */
  signedIn: number | null;
  /** 로그인한 계정의 프로필(가입 단계). 로그아웃이면 null */
  profile: AccountProfile | null;
  /** 마지막으로 로그인에 성공한 방식 ('최근에 로그인 했어요') */
  recentMethod: LoginMethod | null;
  /** 카카오·Apple 로 로그인한다. 진행 중에 다시 부르면 겹치지 않고 busy */
  logIn: (method: LoginMethod) => Promise<LoginOutcome>;
  /** 가입 단계 API(프로필 입력)가 돌려준 프로필로 바꾼다 */
  updateProfile: (profile: AccountProfile) => void;
  /** 약관에 동의했다. 처음 가입이면 회사 참여까지 가입 단계 화면에 머물고, 재동의면 메인으로 간다 */
  agreedToTerms: (profile: AccountProfile, firstSignUp: boolean) => void;
  /** 회사 참여를 마치고 메인으로 간다 */
  completeOnboarding: () => void;
  /** 서버 로그아웃을 부르고(실패해도) 기기 세션·캐시를 지운 뒤 로그인 화면으로 간다 */
  signOut: () => Promise<void>;
  /** 탈퇴 (#115 에서 POST /profiles/{accountId}/withdrawals 를 붙인다). 지금은 로그아웃하고 최근 로그인 표시를 지운다 */
  withdraw: () => Promise<void>;
  /** 세션 복원을 다시 시도한다 */
  retryRestore: () => void;
};

const AuthContext = createContext<Auth | null>(null);

// 서버에 닿지 못했거나 서버가 잠시 답하지 못했다 → 다시 시도할 수 있다
const isTransient = (error: unknown) =>
  isApiError(error) &&
  (error.kind !== 'http' ||
    (error.status !== undefined && error.status >= 500));

function phaseOf(state: AuthState): AuthPhase {
  if (state.status !== 'signedIn') {
    return state.status;
  }
  return state.profile.nextStep !== 'COMPLETED' || state.joining
    ? 'signUp'
    : 'main';
}

const signedIn = (profile: AccountProfile): AuthState => ({
  status: 'signedIn',
  profile,
  joining: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(RESTORING);
  const [recentMethod, setRecentMethod] = useState(readRecentLoginMethod);
  // 세션 만료 알림이 지금 상태를 본다
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 앞 계정의 서버 상태 캐시와 보던 화면을 지운다 (로그아웃·만료)
  const clearDevice = useCallback(() => {
    queryClient.clear();
    clearNavigationState();
  }, [queryClient]);

  const restore = useCallback(() => restoreSession(api, setState), [api]);
  useEffect(() => {
    restore();
  }, [restore]);
  const retryRestore = useCallback(() => {
    setState(RESTORING);
    restore();
  }, [restore]);

  // 재발급이 거절됐다(AUTH-009). 쓰던 중이면 다시 로그인해 달라고 알린다 (복원 중이면 조용히 로그인 화면)
  useEffect(
    () =>
      api.session.onExpired(() => {
        const wasSignedIn = stateRef.current.status === 'signedIn';
        clearDevice();
        setState(SIGNED_OUT);
        if (wasSignedIn) {
          Alert.alert(
            '다시 로그인해 주세요',
            '로그인한 지 오래되어 로그아웃됐어요.',
          );
        }
      }),
    [api, clearDevice],
  );

  // 가입을 마치지 않은(약관 재동의 포함) 계정이 다른 API 에서 PROFILE-005 를 받으면 프로필을 다시 조회해 가입 단계로 보낸다
  const accountId =
    state.status === 'signedIn' ? state.profile.accountId : null;
  useEffect(() => {
    if (accountId === null) {
      return;
    }
    let refreshing = false;
    const refresh = (error: unknown) => {
      if (!isApiError(error, ProfileErrorCode.signupRequired) || refreshing) {
        return;
      }
      refreshing = true;
      fetchProfile(api, accountId)
        .then(
          profile =>
            setState(current =>
              current.status === 'signedIn' &&
              current.profile.accountId === accountId
                ? { ...current, profile }
                : current,
            ),
          () => undefined,
        )
        .finally(() => {
          refreshing = false;
        });
    };
    const unsubscribeQueries = queryClient.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.action.type === 'error') {
        refresh(event.action.error);
      }
    });
    const unsubscribeMutations = queryClient
      .getMutationCache()
      .subscribe(event => {
        if (event?.type === 'updated' && event.action.type === 'error') {
          refresh(event.action.error);
        }
      });
    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [api, queryClient, accountId]);

  const loggingIn = useRef(false);
  const logIn = useCallback(
    async (method: LoginMethod): Promise<LoginOutcome> => {
      if (loggingIn.current) {
        return 'busy';
      }
      loggingIn.current = true;
      try {
        const result = await logInWith(api, method);
        if (result.status === 'cancelled') {
          return 'cancelled';
        }
        saveRecentLoginMethod(method);
        setRecentMethod(method);
        setState(signedIn(result.profile));
        return 'signedIn';
      } catch {
        return 'failed';
      } finally {
        loggingIn.current = false;
      }
    },
    [api],
  );

  const signingOut = useRef<Promise<void> | null>(null);
  const signOut = useCallback(() => {
    signingOut.current ??= (async () => {
      await logOut(api);
      clearDevice();
      setState(SIGNED_OUT);
    })().finally(() => {
      signingOut.current = null;
    });
    return signingOut.current;
  }, [api, clearDevice]);

  const withdraw = useCallback(async () => {
    forgetRecentLoginMethod();
    setRecentMethod(null);
    await signOut();
  }, [signOut]);

  const updateProfile = useCallback(
    (profile: AccountProfile) =>
      setState(current =>
        current.status === 'signedIn' ? { ...current, profile } : current,
      ),
    [],
  );
  const agreedToTerms = useCallback(
    (profile: AccountProfile, firstSignUp: boolean) =>
      setState(current =>
        current.status === 'signedIn'
          ? { ...current, profile, joining: firstSignUp }
          : current,
      ),
    [],
  );
  const completeOnboarding = useCallback(
    () =>
      setState(current =>
        current.status === 'signedIn'
          ? { ...current, joining: false }
          : current,
      ),
    [],
  );

  const auth = useMemo<Auth>(
    () => ({
      phase: phaseOf(state),
      signedIn: state.status === 'signedIn' ? state.profile.accountId : null,
      profile: state.status === 'signedIn' ? state.profile : null,
      recentMethod,
      logIn,
      updateProfile,
      agreedToTerms,
      completeOnboarding,
      signOut,
      withdraw,
      retryRestore,
    }),
    [
      state,
      recentMethod,
      logIn,
      updateProfile,
      agreedToTerms,
      completeOnboarding,
      signOut,
      withdraw,
      retryRestore,
    ],
  );

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/**
 * 저장된 세션으로 프로필을 조회한다. 세션이 없거나 재발급이 거절되면(AUTH-009) 로그인 화면,
 * 서버에 닿지 못하면 다시 시도, 서버가 계정을 모르면(PROFILE-002 등) 세션을 지우고 로그인 화면
 */
async function restoreSession(
  api: ApiClient,
  setState: (state: AuthState) => void,
) {
  const session = await api.session.getSession().catch(() => null);
  if (session === null) {
    setState(SIGNED_OUT);
    return;
  }
  try {
    setState(signedIn(await fetchProfile(api, session.accountId)));
  } catch (error) {
    if (isApiError(error, ApiErrorCode.refreshRejected)) {
      setState(SIGNED_OUT);
    } else if (isTransient(error)) {
      setState(RESTORE_FAILED);
    } else {
      await logOut(api);
      setState(SIGNED_OUT);
    }
  }
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (auth === null) {
    throw new Error('AuthProvider 안에서만 쓸 수 있다');
  }
  return auth;
}
