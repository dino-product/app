import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Membership } from '../my/model';
import type { ParticipationRequest } from '../my/org/model';
import {
  useParticipationStore,
  type ParticipationStore,
} from '../my/org/useParticipationStore';
import type { LoginMethod } from './model';

// 온보딩 하나(더미 로그인 → 참여 완료) 동안 남아야 하는 상태. 온보딩 스택을 감싸므로
// 로그인 화면으로 돌아가면(더미 로그인 취소) 처음 값으로 돌아간다
type OnboardingState = ParticipationStore & {
  /** 이 온보딩을 시작한 로그인 방식. 마치면 그 방식의 계정이 생긴다 */
  method: LoginMethod;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

// 새 사용자라 소속도 참여 요청도 없이 시작한다
const NO_REQUESTS: readonly ParticipationRequest[] = [];
const NO_MEMBERSHIPS: readonly Membership[] = [];

export function OnboardingProvider({
  method,
  children,
}: {
  method: LoginMethod;
  children: ReactNode;
}) {
  const {
    requests,
    lookupCompany,
    requestParticipation,
    cancelRequest,
    decideRequest,
  } = useParticipationStore(NO_REQUESTS, NO_MEMBERSHIPS);
  const state = useMemo(
    () => ({
      method,
      requests,
      lookupCompany,
      requestParticipation,
      cancelRequest,
      decideRequest,
    }),
    [
      method,
      requests,
      lookupCompany,
      requestParticipation,
      cancelRequest,
      decideRequest,
    ],
  );

  return (
    <OnboardingContext.Provider value={state}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const state = useContext(OnboardingContext);
  if (state === null) {
    throw new Error('OnboardingProvider 안에서만 쓸 수 있다');
  }
  return state;
}
