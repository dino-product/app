import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  completeOnboarding,
  initialAuthState,
  signIn,
  signOut,
  withdraw,
  type AuthState,
  type LoginMethod,
} from '../features/onboarding/model';

// 로그인 상태 (#85). 실제 로그인 전이라 더미 계정을 메모리에만 둔다. 앱을 다시 켜면 로그아웃 상태로 시작한다.
// 루트 내비게이터가 이 상태로 화면 묶음(로그인·온보딩 / 메인)을 바꾼다
type Auth = AuthState & {
  /** 가입한 계정으로 로그인한다 (API 연동 때 /api/v1/auth/kakao, /api/v1/auth/apple) */
  signIn: (method: LoginMethod) => void;
  /** 온보딩을 마치고 메인으로 간다 */
  completeOnboarding: (method: LoginMethod) => void;
  /** API 연동 때 POST /api/v1/auth/logout */
  signOut: () => void;
  /** API 연동 때 POST /api/v1/users/{accountId}/withdrawals 뒤 로그아웃 상태가 된다 */
  withdraw: () => void;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({
  initialState = initialAuthState,
  children,
}: {
  /** 테스트가 로그인한 상태(signedInAuth)에서 시작할 때 준다 */
  initialState?: AuthState;
  children: ReactNode;
}) {
  const [state, setState] = useState(initialState);
  const signInWith = useCallback(
    (method: LoginMethod) => setState(current => signIn(current, method)),
    [],
  );
  const complete = useCallback(
    (method: LoginMethod) =>
      setState(current => completeOnboarding(current, method)),
    [],
  );
  const logOut = useCallback(() => setState(signOut), []);
  const leave = useCallback(() => setState(withdraw), []);

  const auth = useMemo(
    () => ({
      ...state,
      signIn: signInWith,
      completeOnboarding: complete,
      signOut: logOut,
      withdraw: leave,
    }),
    [state, signInWith, complete, logOut, leave],
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
