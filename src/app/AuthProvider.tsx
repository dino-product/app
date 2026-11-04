import { isCancelledError, useQueryClient } from '@tanstack/react-query';
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
import { Alert, AppState } from 'react-native';
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
import { withdrawalMutationKey } from '../features/my/withdrawalApi';
import type { LoginMethod } from '../features/onboarding/model';
import { clearAllRejectDrafts } from '../features/schedule/rejectDraft';
import { useWorkRepository } from '../features/work/data/WorkRepositoryProvider';
import { clearAllReportDrafts } from '../features/work/reportDraft';
import {
  currentAccountId,
  fetchProfile,
  ProfileErrorCode,
  profileQuery,
  profileQueryKey,
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

type LoginAttempt = {
  controller: AbortController;
  /** SDK 로그인 화면(카카오톡·카카오계정·Apple)을 기다리는 중 */
  inSdk: boolean;
  /** SDK 를 기다리는 동안 앱이 백그라운드에 갔다가(카카오톡·Android 로그인 창) 돌아왔다. 이때부터 다시 누를 수 있다 */
  returned: boolean;
};

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
  /** 로그인해 있는지 */
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
  /**
   * 탈퇴를 마쳤다 (POST /profiles/{accountId}/withdrawals 204, #115). 최근 로그인 표시를 지우고
   * 로그아웃과 같은 길로 기기 세션·캐시·표식·초안을 지운 뒤 로그인 화면으로 간다. 서버 로그아웃은 보내지 않는다(토큰이 이미 무효)
   */
  withdraw: () => Promise<void>;
  profileStore: ProfileStore;
};

const AuthContext = createContext<Auth | null>(null);

// 서버가 이 세션·계정을 코드로 거절했다(PROFILE-002 등 4xx) → 세션을 지운다.
// 그 밖(서버에 닿지 못함·5xx·앱이 모르는 응답 모양 — 새 가입 단계 값 등)은 일시 오류로 보고 지금 화면에 머문다
const isRejectedByServer = (error: unknown) =>
  isApiError(error) &&
  error.kind === 'http' &&
  error.code !== undefined &&
  error.status !== undefined &&
  error.status >= 400 &&
  error.status < 500;

function phaseOf(state: AuthState): AuthPhase {
  if (state.status === 'signedOut') {
    return 'signedOut';
  }
  return state.nextStep !== 'COMPLETED' || state.joining ? 'signUp' : 'main';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const workRepository = useWorkRepository();
  const [state, setState] = useState(initialState);
  const [recentMethod, setRecentMethod] = useState(readRecentLoginMethod);
  const [profileStore] = useState(createProfileStore);
  // 세션 만료 알림이 지금 상태를 본다
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 세대: 로그아웃·만료와 사용자 동작(로그인·프로필 저장·약관 동의·참여 완료)마다 올린다.
  // 뒤에서 온 결과(켤 때 확인, PROFILE-005 재조회)는 시작할 때의 세대가 그대로일 때만 반영해 더 새 상태를 덮지 않는다
  const epoch = useRef(0);

  // 서버가 준 프로필을 기기에 반영한다. 가입 단계가 그대로면 상태를 바꾸지 않아 다시 그리지 않는다.
  // 마이페이지가 쓰는 프로필 캐시(#115)는 아래 두 갈래가 따로 쓴다
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

  // 사용자 동작의 결과 (뒤에서 오던 옛 결과는 버려진다). 프로필 캐시도 바꾸는데, 받는 중이던 프로필 조회(켤 때 확인·마이페이지)가
  // 늦게 끝나 이 값을 덮지 않게 그 조회를 먼저 멈춘다. 멈추는 동안 로그아웃 등으로 세대가 바뀌었으면 쓰지 않는다
  const applyUserProfile = useCallback(
    (profile: AccountProfile, joining?: boolean) => {
      epoch.current += 1;
      const appliedAt = epoch.current;
      applyProfile(profile, joining);
      queryClient.cancelQueries({ queryKey: profileQueryKey }).then(() => {
        if (epoch.current === appliedAt) {
          queryClient.setQueryData(profileQueryKey, profile);
        }
      });
    },
    [applyProfile, queryClient],
  );

  // 뒤에서 온 결과. 그사이 세대가 바뀌었거나(로그아웃·다른 저장) 다른 계정의 프로필이면 버린다
  const applyBackgroundProfile = useCallback(
    (profile: AccountProfile, startedAt: number) => {
      const known = profileStore.get();
      if (
        epoch.current !== startedAt ||
        (known !== null && known.accountId !== profile.accountId)
      ) {
        return;
      }
      applyProfile(profile);
      queryClient.setQueryData(profileQueryKey, profile);
    },
    [applyProfile, profileStore, queryClient],
  );

  // 로그아웃 상태로 돌린다. 앞 계정의 표식·프로필·서버 상태 캐시·작업 저장소·보던 화면·작성 중이던 초안을 지운다 (로그아웃·탈퇴·만료).
  // 공용 기기에서 다음 계정에 앞 계정이 쓰던 완료 보고·거절 사유나 이 기기에 든 작업 상태(로컬 저장소, #114)가 남지 않게 한다
  const resetToSignedOut = useCallback(() => {
    epoch.current += 1;
    forgetSignedInStep();
    profileStore.set(null);
    workRepository.reset();
    queryClient.clear();
    clearNavigationState();
    clearAllReportDrafts();
    clearAllRejectDrafts();
    setState(SIGNED_OUT);
  }, [profileStore, queryClient, workRepository]);

  // 켤 때 로그인해 둔 기기면 뒤에서 세션을 확인한다. 세션이 없으면 로그인 화면, 서버가 계정을 모르면(PROFILE-002 등)
  // 세션을 지우고 로그인 화면 + 다시 로그인해 주세요. 서버에 닿지 못하거나 Keychain 을 잠시 읽지 못하면 지금 화면에 머문다
  // (화면마다 다시 시도). 만료(AUTH-009)는 onExpired 가 받는다
  useEffect(() => {
    if (stateRef.current.status !== 'signedIn') {
      return;
    }
    const startedAt = epoch.current;
    const stale = () => epoch.current !== startedAt;
    (async () => {
      let session;
      try {
        session = await api.session.getSession();
      } catch {
        return;
      }
      if (stale()) {
        return;
      }
      if (session === null) {
        resetToSignedOut();
        return;
      }
      // 마이페이지와 같은 프로필 캐시로 받는다. 보던 마이페이지로 켜져 그쪽이 먼저 받고 있으면 그 요청을 같이 기다린다 (#115).
      // 마이페이지가 구독을 끊어도 요청은 끊기지 않는다(profileQuery 는 취소 신호를 넘기지 않는다). 누가 이 조회를 멈췄는데
      // (cancelQueries) 세대가 그대로면 다시 받는다. 사용자 동작·로그아웃이 멈춘 것이면 세대가 바뀌어 그만둔다.
      // 운영 QueryClient 는 네트워크·5xx 를 두 번까지 다시 보낸다
      const fetchStartupProfile = async (): Promise<AccountProfile> => {
        try {
          return await queryClient.fetchQuery(profileQuery(api));
        } catch (error) {
          if (isCancelledError(error) && !stale()) {
            return fetchStartupProfile();
          }
          throw error;
        }
      };
      try {
        applyBackgroundProfile(await fetchStartupProfile(), startedAt);
      } catch (error) {
        if (
          stale() ||
          isApiError(error, ApiErrorCode.refreshRejected) ||
          !isRejectedByServer(error)
        ) {
          return;
        }
        await logOut(api);
        // 세션을 지우는 동안 사용자가 직접 로그아웃했으면 그쪽이 맞다 (다시 로그인해 달라고 알리지 않는다)
        if (stale()) {
          return;
        }
        resetToSignedOut();
        Alert.alert(
          '다시 로그인해 주세요',
          '계정 정보를 확인하지 못해 로그아웃됐어요.',
        );
      }
    })();
  }, [api, queryClient, applyBackgroundProfile, resetToSignedOut]);

  // 재발급이 거절됐다(AUTH-009). 로그인해 있었으면 로그인 화면으로 가고 다시 로그인해 달라고 알린다.
  // 로그아웃으로 세션을 먼저 지운 뒤에 끝난 재발급은 세션 관리자가 만료로 알리지 않는다.
  // 탈퇴 요청 중이면 알리지 않는다: 이미 탈퇴돼 토큰이 거부된 것이고(COMMON-409 확인), 탈퇴 마무리(withdraw)가 이어진다 (#115)
  useEffect(
    () =>
      api.session.onExpired(() => {
        const wasSignedIn = stateRef.current.status === 'signedIn';
        const withdrawing =
          queryClient.isMutating({ mutationKey: withdrawalMutationKey }) > 0;
        resetToSignedOut();
        if (wasSignedIn && !withdrawing) {
          Alert.alert(
            '다시 로그인해 주세요',
            '로그인한 지 오래되어 로그아웃됐어요.',
          );
        }
      }),
    [api, queryClient, resetToSignedOut],
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
      const startedAt = epoch.current;
      currentAccountId(api)
        .then(accountId => fetchProfile(api, accountId))
        .then(
          profile => applyBackgroundProfile(profile, startedAt),
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
  }, [api, queryClient, signedIn, applyBackgroundProfile]);

  // 진행 중인 로그인 시도. 겹치지 않게 하나만 둔다
  const attempt = useRef<LoginAttempt | null>(null);

  // SDK 를 기다리는 중 백그라운드에 갔다가(카카오톡, Android 는 카카오계정 창도) 돌아오면 버튼 잠금만 푼다.
  // iOS 카카오 SDK 는 카카오톡에서 로그인을 마치지 않고 돌아오면 끝을 알리지 않아 그대로 두면 앱을 다시 켤 때까지 잠긴다.
  // 시도는 살려 둔다: 돌아온 뒤에도 SDK 는 받은 코드를 토큰으로 바꾸는 네트워크 교환(약한 신호면 오래 걸린다)이나
  // 카카오톡 오류 뒤 띄운 카카오계정 창을 마쳐야 끝나므로, 나중에 성공하면 그대로 로그인한다. 그 사이 다시 누르면 앞 시도를 버린다(logIn)
  useEffect(() => {
    let wentBackground = false;
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'background') {
        wentBackground = true;
        return;
      }
      if (status !== 'active' || !wentBackground) {
        return;
      }
      wentBackground = false;
      const current = attempt.current;
      if (current?.inSdk) {
        current.returned = true;
      }
    });
    return () => subscription.remove();
  }, []);

  const logIn = useCallback(
    async (method: LoginMethod): Promise<LoginOutcome> => {
      const previous = attempt.current;
      if (previous) {
        // 앱으로 돌아왔는데 SDK 가 끝나지 않은 앞 시도는 버리고 새로 한다(늦게 온 결과는 버린다). 그 밖에는 겹치지 않게 무시한다
        if (!(previous.inSdk && previous.returned)) {
          return 'busy';
        }
        previous.controller.abort();
      }
      const current: LoginAttempt = {
        controller: new AbortController(),
        inSdk: false,
        returned: false,
      };
      attempt.current = current;
      try {
        const result = await logInWith(api, method, {
          signal: current.controller.signal,
          onSdkStage: inSdk => {
            current.inSdk = inSdk;
          },
        });
        if (result.status === 'cancelled') {
          return 'cancelled';
        }
        saveRecentLoginMethod(method);
        setRecentMethod(method);
        applyUserProfile(result.profile, false);
        return 'signedIn';
      } catch {
        return current.controller.signal.aborted ? 'cancelled' : 'failed';
      } finally {
        if (attempt.current === current) {
          attempt.current = null;
        }
      }
    },
    [api, applyUserProfile],
  );

  // 세션을 떼어 기기에서 먼저 지우고 바로 로그인 화면으로 간다. 서버 로그아웃은 떼어 둔 토큰으로 뒤에서 보낸다 (logOut).
  // 시작할 때 세대를 올려, 그 사이 끝난 뒤의 결과(켤 때 확인 등)가 반영되거나 따로 알리지 않게 한다
  // tellServer: 서버 로그아웃을 보낼지. 탈퇴 뒤에는 서버가 이미 이 계정의 모든 토큰을 거부하므로 기기 세션만 지운다
  const signingOut = useRef<Promise<void> | null>(null);
  const endSession = useCallback(
    (tellServer: boolean) => {
      signingOut.current ??= (async () => {
        epoch.current += 1;
        forgetSignedInStep();
        await (tellServer
          ? logOut(api)
          : api.session.end().catch(() => undefined));
        resetToSignedOut();
      })().finally(() => {
        signingOut.current = null;
      });
      return signingOut.current;
    },
    [api, resetToSignedOut],
  );
  const signOut = useCallback(() => endSession(true), [endSession]);

  const withdraw = useCallback(async () => {
    forgetRecentLoginMethod();
    setRecentMethod(null);
    await endSession(false);
  }, [endSession]);

  const updateProfile = useCallback(
    (profile: AccountProfile) => applyUserProfile(profile),
    [applyUserProfile],
  );
  const agreedToTerms = useCallback(
    (profile: AccountProfile, firstSignUp: boolean) =>
      applyUserProfile(profile, firstSignUp),
    [applyUserProfile],
  );
  const completeOnboarding = useCallback(() => {
    epoch.current += 1;
    setState(current =>
      current.status === 'signedIn' ? { ...current, joining: false } : current,
    );
  }, []);

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
