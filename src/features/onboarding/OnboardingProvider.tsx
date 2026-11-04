import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Membership } from '../my/model';
import type { ParticipationRequest } from '../my/org/model';
import {
  useParticipationStore,
  type ParticipationStore,
} from '../my/org/useParticipationStore';

// 가입 단계 하나(프로필 등록 → 참여 완료) 동안 남아야 하는 상태. 온보딩 스택을 감싸므로
// 가입을 그만두고 로그인 화면으로 돌아가면 처음 값으로 돌아간다. 회사 참여는 아직 목이다 (#116 에서 서버에 붙인다)
type OnboardingState = ParticipationStore;

const OnboardingContext = createContext<OnboardingState | null>(null);

// 새 사용자라 소속도 참여 요청도 없이 시작한다
const NO_REQUESTS: readonly ParticipationRequest[] = [];
const NO_MEMBERSHIPS: readonly Membership[] = [];

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const {
    requests,
    lookupCompany,
    requestParticipation,
    cancelRequest,
    decideRequest,
  } = useParticipationStore(NO_REQUESTS, NO_MEMBERSHIPS);
  const state = useMemo(
    () => ({
      requests,
      lookupCompany,
      requestParticipation,
      cancelRequest,
      decideRequest,
    }),
    [
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
