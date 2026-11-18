import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { noTermsAgreed, type TermsAgreement } from './model';

// 가입 약관 동의 상태 (#193). 가입 약관 화면과 약관 상세(다른 경로)가 같은 상태를 보고 바꾼다:
// 상세에서 고른 라디오가 돌아오면 가입 약관의 체크가 된다. 가입 단계 화면 묶음이 떠 있는 동안 남고(프로필 등록에 다녀와도),
// 메모리에만 있다 (persistence: 가입 단계는 다시 열 때 버린다).
// 약관 개정으로 다시 동의하는 계정은 서버에 남은 마케팅(선택) 동의로 시작하고, 건드리지 않으면 그 값을 보낸다 (#113)

export type TermsAgreementState = {
  agreement: TermsAgreement;
  setAgreement: Dispatch<SetStateAction<TermsAgreement>>;
};

export function useTermsAgreementState(
  initialMarketing?: boolean,
): TermsAgreementState {
  const [agreement, setAgreement] = useState<TermsAgreement>(() => ({
    ...noTermsAgreed,
    MARKETING: initialMarketing ?? false,
  }));
  // 마케팅 동의 값이 그린 뒤에 오면(켠 직후 서버 확인), 선택 약관을 건드리지 않았을 때만 반영한다. 렌더 중에 맞춘다
  const [appliedMarketing, setAppliedMarketing] = useState(
    initialMarketing ?? false,
  );
  if ((initialMarketing ?? false) !== appliedMarketing) {
    setAppliedMarketing(initialMarketing ?? false);
    if (agreement.MARKETING === appliedMarketing) {
      setAgreement({ ...agreement, MARKETING: initialMarketing ?? false });
    }
  }
  return useMemo(() => ({ agreement, setAgreement }), [agreement]);
}

const TermsAgreementContext = createContext<TermsAgreementState | null>(null);

/** 가입 단계 화면 묶음을 감싼다 (가입 약관·약관 상세가 같은 상태를 쓴다) */
export function TermsAgreementProvider({
  initialMarketing,
  children,
}: {
  initialMarketing?: boolean;
  children?: ReactNode;
}) {
  const state = useTermsAgreementState(initialMarketing);
  return (
    <TermsAgreementContext.Provider value={state}>
      {children}
    </TermsAgreementContext.Provider>
  );
}

export function useTermsAgreement(): TermsAgreementState {
  const state = useContext(TermsAgreementContext);
  if (state === null) {
    throw new Error('TermsAgreementProvider 안에서만 쓸 수 있다');
  }
  return state;
}
