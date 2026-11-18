import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  allTermsAgreedWith,
  noTermsAgreed,
  type TermsAgreement,
  type TermsType,
} from './model';

// 가입 약관 동의 상태 (#193). 가입 약관 화면과 약관 상세(다른 경로)가 같은 상태를 보고 바꾼다:
// 상세에서 고른 라디오가 돌아오면 가입 약관의 체크가 된다. 가입 단계 화면 묶음이 떠 있는 동안 남고(프로필 등록에 다녀와도),
// 메모리에만 있다 (persistence: 가입 단계는 다시 열 때 버린다).
// 약관 개정으로 다시 동의하는 계정은 서버에 남은 마케팅(선택) 동의로 시작하고, 고르지 않으면 그 값을 보낸다 (#113).
// 마케팅을 '골랐는지'는 값이 아니라 고른 일(상세 라디오·모든 약관 동의)로 기록한다: 지금 값과 같은 값을 골라도 고른 것이라,
// 그 뒤 늦게 온 서버 값이 덮지 않는다

export type TermsAgreementState = {
  agreement: TermsAgreement;
  /** 약관 하나를 동의·비동의로 (약관 상세 라디오) */
  choose: (type: TermsType, agreed: boolean) => void;
  /** 모두 동의·모두 끄기 (가입 약관 '모든 약관에 동의합니다') */
  agreeAll: (agreed: boolean) => void;
};

type Chosen = {
  agreement: TermsAgreement;
  /** 사용자가 마케팅(선택)을 골랐다. 고르기 전에는 서버 값을 따른다 */
  marketingChosen: boolean;
};

export function useTermsAgreementState(
  initialMarketing?: boolean,
): TermsAgreementState {
  const [chosen, setChosen] = useState<Chosen>({
    agreement: noTermsAgreed,
    marketingChosen: false,
  });
  const serverMarketing = initialMarketing ?? false;
  // 서버 마케팅 동의는 그린 뒤에 올 수 있다(켠 직후 서버 확인). 고르기 전에는 늘 지금 서버 값이다
  const agreement = useMemo(
    () =>
      chosen.marketingChosen
        ? chosen.agreement
        : { ...chosen.agreement, MARKETING: serverMarketing },
    [chosen, serverMarketing],
  );
  const choose = useCallback(
    (type: TermsType, agreed: boolean) =>
      setChosen(current => ({
        agreement: { ...current.agreement, [type]: agreed },
        marketingChosen: current.marketingChosen || type === 'MARKETING',
      })),
    [],
  );
  const agreeAll = useCallback(
    (agreed: boolean) =>
      setChosen({
        agreement: allTermsAgreedWith(agreed),
        marketingChosen: true,
      }),
    [],
  );
  return useMemo(
    () => ({ agreement, choose, agreeAll }),
    [agreement, choose, agreeAll],
  );
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
