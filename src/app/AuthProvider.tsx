import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';
import {
  forgetRecentLoginMethod,
  forgetSignedInStep,
  logIn as logInWith,
  logOut,
  readRecentLoginMethod,
  readSignedInStep,
  saveRecentLoginMethod,
  saveSignedInStep,
} from '../features/onboarding/login';
import type { LoginMethod } from '../features/onboarding/model';
import {
  currentAccountId,
  fetchProfile,
  ProfileErrorCode,
  type AccountProfile,
  type NextStep,
} from '../features/onboarding/profileApi';
import { ApiErrorCode, isApiError, useApiClient } from '../shared/api';
import { clearNavigationState } from './navigation/persistence';

// 로그인 상태 (#113). 서버 세션(Keychain)과 그 계정의 가입 단계(프로필 nextStep)로 정한다.
// 켤 때는 MMKV 에 남긴 표식(로그인 여부와 마지막으로 확인한 가입 단계, 토큰 아님)을 동기로 읽어 첫 렌더부터 그 화면을 그리고,
// 뒤에서 Keychain 세션으로 프로필을 조회해 맞춘다(낙관적 복원). 단계가 같으면 다시 그리지 않는다.
// 루트 내비게이터가 phase 로 화면 묶음(로그인 / 가입 단계 / 메인)을 바꾼다

/** signedOut: 로그인 화면 · signUp: 가입 단계(프로필 등록 → 약관 동의 → 회사 참여) · main: 메인 */
export type AuthPhase = 'signedOut' | 'signUp' | 'main';

type AuthState =
  | { status: 'signedOut' }
  | {
      status: 'signedIn';
      /** 마지막으로 확인한 가입 단계 */
      nextStep: NextStep;
      /** 이번 가입에서 약관까지 마쳤고 회사 참여 단계에 있다. 가입은 끝났지만 시작하기 전까지 가입 단계 화면에 머문다 */
      joining: boolean;
    };

// 같은 상태로 다시 정하면 React 가 그리지 않게 고정 값을 쓴다
const SIGNED_OUT: AuthState = { status: 'signedOut' };

const initialState = (): AuthState => {
  const nextStep = readSignedInStep();
  return nextStep === null
    ? SIGNED_OUT
    : { status: 'signedIn', nextStep, joining: false };
};

/** 로그인 버튼 결과. busy: 앞 로그인이 아직 진행 중이라 무시했다 */
export type LoginOutcome = 'signedIn' | 'cancelled' | 'failed' | 'busy';

// 로그인한 계정의 프로필(이름·연락처 등). 쓰는 화면(가입 단계)만 구독해, 뒤에서 확인한 프로필이 와도 다른 화면은 다시 그리지 않는다
type ProfileStore = {
  get: () => AccountProfile | null;
  set: (profile: AccountProfile | null) => void;
  subscribe: (listener: () => void) => () => void;
};

function createProfileStore(): ProfileStore {
  let current: AccountProfile | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(profile) {
      current = profile;
      listeners.forEach(listener => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

type Auth = {
  phase: AuthPhase;
  /** 마지막으로 확인한 가입 단계. 로그아웃이면 null */
  nextStep: NextStep | null;
  /** 로그인해 있는지. AppStateProvider 가 꺼지면 기기의 목 상태를 비운다 */
  signedIn: boolean;
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
  profileStore: ProfileStore;
};

const AuthContext = createContext<Auth | null>(null);

// 서버에 닿지 못했거나 서버가 잠시 답하지 못했다 → 지금 화면에 머문다
const isTransient = (error: unknown) =>
  isApiError(error) &&
  (error.kind !== 'http' ||
    (error.status !== undefined && error.status >= 500));

function phaseOf(state: AuthState): AuthPhase {
  if (state.status === 'signedOut') {
    return 'signedOut';
  }
  return state.nextStep !== 'COMPLETED' || state.joining ? 'signUp' : 'main';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [state, setState] = useState(initialState);
  const [recentMethod, setRecentMethod] = useState(readRecentLoginMethod);
  const [profileStore] = useState(createProfileStore);
  // 세션 만료 알림이 지금 상태를 본다
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 서버가 준 프로필을 기기에 반영한다. 가입 단계가 그대로면 상태를 바꾸지 않아 다시 그리지 않는다
  const applyProfile = useCallback(
    (profile: AccountProfile, joining?: boolean) => {
      profileStore.set(profile);
      saveSignedInStep(profile.nextStep);
      setState(current => {
        const nextJoining =
          joining ?? (current.status === 'signedIn' && current.joining);
        return current.status === 'signedIn' &&
          current.nextStep === profile.nextStep &&
          current.joining === nextJoining
          ? current
          : {
              status: 'signedIn',
              nextStep: profile.nextStep,
              joining: nextJoining,
            };
      });
    },
    [profileStore],
  );

  // 로그아웃 상태로 돌린다. 앞 계정의 표식·프로필·서버 상태 캐시·보던 화면을 지운다 (로그아웃·만료)
  const resetToSignedOut = useCallback(() => {
    forgetSignedInStep();
    profileStore.set(null);
    queryClient.clear();
    clearNavigationState();
    setState(SIGNED_OUT);
  }, [profileStore, queryClient]);

  // 켤 때 로그인해 둔 기기면 뒤에서 세션을 확인한다. 세션이 없으면 로그인 화면, 서버가 계정을 모르면(PROFILE-002 등)
  // 세션을 지우고 로그인 화면, 서버에 닿지 못하면 지금 화면에 머문다(화면마다 다시 시도). 만료(AUTH-009)는 onExpired 가 받는다
  useEffect(() => {
    if (stateRef.current.status !== 'signedIn') {
      return;
    }
    (async () => {
      const session = await api.session.getSession().catch(() => null);
      if (session === null) {
        resetToSignedOut();
        return;
      }
      try {
        applyProfile(await fetchProfile(api, session.accountId));
      } catch (error) {
        if (
          isApiError(error, ApiErrorCode.refreshRejected) ||
          isTransient(error)
        ) {
          return;
        }
        await logOut(api);
        resetToSignedOut();
      }
    })();
  }, [api, applyProfile, resetToSignedOut]);

  // 재발급이 거절됐다(AUTH-009). 로그인해 있었으면 로그인 화면으로 가고 다시 로그인해 달라고 알린다
  useEffect(
    () =>
      api.session.onExpired(() => {
        const wasSignedIn = stateRef.current.status === 'signedIn';
        resetToSignedOut();
        if (wasSignedIn) {
          Alert.alert(
            '다시 로그인해 주세요',
            '로그인한 지 오래되어 로그아웃됐어요.',
          );
        }
      }),
    [api, resetToSignedOut],
  );

  // 가입을 마치지 않은(약관 재동의 포함) 계정이 다른 API 에서 PROFILE-005 를 받으면 프로필을 다시 조회해 가입 단계로 보낸다
  const signedIn = state.status === 'signedIn';
  useEffect(() => {
    if (!signedIn) {
      return;
    }
    let refreshing = false;
    const refresh = (error: unknown) => {
      if (!isApiError(error, ProfileErrorCode.signupRequired) || refreshing) {
        return;
      }
      refreshing = true;
      currentAccountId(api)
        .then(accountId => fetchProfile(api, accountId))
        .then(
          profile => applyProfile(profile),
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
  }, [api, queryClient, signedIn, applyProfile]);

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
        applyProfile(result.profile, false);
        return 'signedIn';
      } catch {
        return 'failed';
      } finally {
        loggingIn.current = false;
      }
    },
    [api, applyProfile],
  );

  // 표식을 먼저 지워, 로그아웃 응답을 기다리다 앱이 꺼져도 다시 켜면 로그인 화면이다
  const signingOut = useRef<Promise<void> | null>(null);
  const signOut = useCallback(() => {
    signingOut.current ??= (async () => {
      forgetSignedInStep();
      await logOut(api);
      resetToSignedOut();
    })().finally(() => {
      signingOut.current = null;
    });
    return signingOut.current;
  }, [api, resetToSignedOut]);

  const withdraw = useCallback(async () => {
    forgetRecentLoginMethod();
    setRecentMethod(null);
    await signOut();
  }, [signOut]);

  const updateProfile = useCallback(
    (profile: AccountProfile) => applyProfile(profile),
    [applyProfile],
  );
  const agreedToTerms = useCallback(
    (profile: AccountProfile, firstSignUp: boolean) =>
      applyProfile(profile, firstSignUp),
    [applyProfile],
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
      nextStep: state.status === 'signedIn' ? state.nextStep : null,
      signedIn: state.status === 'signedIn',
      recentMethod,
      logIn,
      updateProfile,
      agreedToTerms,
      completeOnboarding,
      signOut,
      withdraw,
      profileStore,
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
      profileStore,
    ],
  );

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (auth === null) {
    throw new Error('AuthProvider 안에서만 쓸 수 있다');
  }
  return auth;
}

/** 로그인한 계정의 프로필. 켠 직후 서버 확인 전이거나 서버에 닿지 못했으면 null */
export function useAccountProfile(): AccountProfile | null {
  const { profileStore } = useAuth();
  return useSyncExternalStore(profileStore.subscribe, profileStore.get);
}
