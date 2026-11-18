import { isValidProfile, type ProfileInput } from '../my/model';

// 온보딩(#85)의 데이터 모양과 규칙. 서버 연동(로그인·가입 단계)은 login.ts·profileApi.ts (#113)

export type LoginMethod = 'KAKAO' | 'APPLE';

/** Apple 로그인은 Apple 기기에서만 보인다 (프로젝트 결정). 백엔드 Android 용 Apple 경로는 없앨 예정이다 */
export function loginMethodsFor(os: string): LoginMethod[] {
  return os === 'ios' ? ['KAKAO', 'APPLE'] : ['KAKAO'];
}

/** 이름 2~20자 한글·영문과 010 으로 시작하는 연락처 11자리를 모두 넣어야 등록할 수 있다 (Spec_프로필 입력 화면) */
export function canRegisterProfile(input: ProfileInput): boolean {
  return isValidProfile(input);
}

/**
 * 약관 종류. 백엔드 TermsType 은 SERVICE·PRIVACY(필수)·MARKETING(선택) 셋이고,
 * Figma 는 제3자 제공·위치기반 서비스를 더한 다섯이다. 앱은 Figma 대로 보이고, 서버에는 셋만 보낸다 (toTermsAgreementRequest, #112 G10)
 */
export type TermsType =
  | 'SERVICE'
  | 'PRIVACY'
  | 'THIRD_PARTY'
  | 'LOCATION'
  | 'MARKETING';

export type Terms = {
  type: TermsType;
  /** 약관 동의 화면의 행 이름 */
  title: string;
  required: boolean;
  /** 약관 상세에서 제목 아래 안내 (Figma 약관 상세 페이지 51019:16927 은 서비스 이용약관에만 있다) */
  intro?: string;
};

// Figma 약관 동의(3284:22327) 행. 전문은 원격 txt 다 (features/terms, 행 ↔ 전문 대응표 signUpTermsDocuments)
export const termsList: readonly Terms[] = [
  {
    type: 'SERVICE',
    title: '서비스 이용약관',
    required: true,
    intro:
      'Orbit 서비스를 이용하기 위해서는 서비스의 제공 목적과\n이용 범위, 회원의 권리·의무, 기사 및 고객 정보 관리 책임, 이용 제한 기준을 확인하고 약관에 동의해야 합니다. 아래 내용을 자세히 읽으신 후 동의 여부를 결정해 주세요',
  },
  { type: 'PRIVACY', title: '개인정보 처리방침', required: true },
  { type: 'THIRD_PARTY', title: '제3자 제공 동의', required: true },
  { type: 'LOCATION', title: '위치기반 서비스 이용약관', required: true },
  { type: 'MARKETING', title: '혜택 이벤트 알림 수신동의', required: false },
];

/** 모든 약관 (행 순서). '모든 약관에 동의합니다' 뒤 약관 상세가 이 순서로 보인다 */
export const ALL_TERMS_TYPES: readonly TermsType[] = termsList.map(
  terms => terms.type,
);

/** 행 끝에 붙는 (필수)·(선택) */
export const requiredLabel = (terms: Pick<Terms, 'required'>) =>
  terms.required ? '(필수)' : '(선택)';

/** 약관 상세의 큰 제목: '(필수) 서비스 이용약관' (Figma 51019:16927) */
export const termsDetailTitle = (terms: Pick<Terms, 'required' | 'title'>) =>
  `${requiredLabel(terms)} ${terms.title}`;

export type TermsAgreement = Readonly<Record<TermsType, boolean>>;

export const noTermsAgreed: TermsAgreement = {
  SERVICE: false,
  PRIVACY: false,
  THIRD_PARTY: false,
  LOCATION: false,
  MARKETING: false,
};

export function toggleTerm(
  agreement: TermsAgreement,
  type: TermsType,
): TermsAgreement {
  return { ...agreement, [type]: !agreement[type] };
}

export function allTermsAgreed(agreement: TermsAgreement): boolean {
  return termsList.every(terms => agreement[terms.type]);
}

/** 모든 약관을 같은 값으로 ('모든 약관에 동의합니다' 의 모두 동의·모두 끄기) */
export function allTermsAgreedWith(agreed: boolean): TermsAgreement {
  return {
    SERVICE: agreed,
    PRIVACY: agreed,
    THIRD_PARTY: agreed,
    LOCATION: agreed,
    MARKETING: agreed,
  };
}

export const isTermsType = (value: string): value is TermsType =>
  (ALL_TERMS_TYPES as readonly string[]).includes(value);

/** 하나라도 꺼져 있으면 모두 켜고, 모두 켜져 있으면 모두 끈다 */
export function toggleAllTerms(agreement: TermsAgreement): TermsAgreement {
  const next = !allTermsAgreed(agreement);
  return {
    SERVICE: next,
    PRIVACY: next,
    THIRD_PARTY: next,
    LOCATION: next,
    MARKETING: next,
  };
}

/** 필수 약관에 모두 동의해야 가입할 수 있다. 선택은 꺼져 있어도 된다 */
export function canSignUp(agreement: TermsAgreement): boolean {
  return termsList.every(terms => !terms.required || agreement[terms.type]);
}

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const FINAL_RIEUL = 8;

/** 조사 '(으)로': 받침이 없거나 ㄹ 받침이면 '로', 그 밖의 받침이면 '으로' (기사로, 직원으로, 사무실로) */
export function withRo(word: string): string {
  const code = word.charCodeAt(word.length - 1);
  if (code < HANGUL_START || code > HANGUL_END) {
    return '로';
  }
  const final = (code - HANGUL_START) % 28;
  return final === 0 || final === FINAL_RIEUL ? '로' : '으로';
}
