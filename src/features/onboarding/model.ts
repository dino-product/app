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
  /** 약관 시트의 항목 이름 */
  sheetTitle: string;
  required: boolean;
  body: string;
};

// Figma 약관 동의 시트(3569:7702)의 본문. 실제 약관이 나오기 전까지 모든 약관에 자리표시로 쓴다
const placeholderBody = [
  '제1조 (목적)',
  '본 약관은 Orbit(이하 "서비스")가 제공하는 기사 관리 및 업무 운영 서비스의 이용과 관련하여 서비스 운영자와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.',
  '제2조 (서비스의 내용)',
  '서비스는 회원에게 기사 등록 및 관리, 업무 일정 관리, 기사 배정, 작업 현황 확인, 고객 정보 관리, 업무 내역 기록 등의 기능을 제공합니다. 서비스 운영자는 효율적인 업무 환경을 제공하기 위해 일부 기능을 추가하거나 변경할 수 있습니다.',
  '제3조 (회원의 의무)',
  '회원은 본 약관 및 관계 법령을 준수하여야 하며, 타인의 계정을 무단으로 사용하거나 허위 업무 정보를 등록해서는 안 됩니다. 또한 회원은 기사 및 고객의 개인정보를 안전하게 관리하고, 서비스를 정해진 목적에 따라 이용하여야 합니다.',
  '제4조 (서비스 이용 제한)',
  '회원이 관련 법령 또는 본 약관을 위반하거나 서비스의 정상적인 운영을 방해하는 경우, 서비스 운영자는 위반 행위의 정도에 따라 이용을 일시적으로 제한하거나 회원 자격을 정지할 수 있습니다. 이용 제한 시에는 원칙적으로 사유를 사전에 안내합니다.',
].join('\n');

// Figma 약관 동의(3284:22327). 시트의 항목 이름은 Figma 두 상자가 모두 '서비스 이용약관 동의' 라 약관별로 썼다 (디자인 확인 항목)
export const termsList: readonly Terms[] = [
  {
    type: 'SERVICE',
    title: '서비스 이용약관',
    sheetTitle: '서비스 이용약관 동의',
    required: true,
    body: placeholderBody,
  },
  {
    type: 'PRIVACY',
    title: '개인정보 처리방침',
    sheetTitle: '개인정보 처리방침 동의',
    required: true,
    body: placeholderBody,
  },
  {
    type: 'THIRD_PARTY',
    title: '제3자 제공 동의',
    sheetTitle: '제3자 제공 동의',
    required: true,
    body: placeholderBody,
  },
  {
    type: 'LOCATION',
    title: '위치기반 서비스 이용약관',
    sheetTitle: '위치기반 서비스 이용약관 동의',
    required: true,
    body: placeholderBody,
  },
  {
    type: 'MARKETING',
    title: '혜택 이벤트 알림 수신동의',
    sheetTitle: '혜택 이벤트 알림 수신동의',
    required: false,
    body: placeholderBody,
  },
];

/** 행 끝에 붙는 (필수)·(선택) */
export const requiredLabel = (terms: Pick<Terms, 'required'>) =>
  terms.required ? '(필수)' : '(선택)';

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
