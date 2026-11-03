import { isValidProfile, type ProfileInput } from '../my/model';

// 온보딩(#85)의 데이터 모양과 규칙. 실제 로그인을 붙이기 전까지 더미 계정으로 흐름을 끝까지 볼 수 있게 한다.
// 백엔드: 카카오 /api/v1/auth/kakao, Apple /api/v1/auth/apple, 프로필 PUT /api/v1/profiles/{accountId},
// 약관 POST /api/v1/profiles/{accountId}/terms-agreements, 마케팅 POST .../marketing-consents

export type LoginMethod = 'KAKAO' | 'APPLE';

/** Apple 로그인은 Apple 기기에서만 보인다 (프로젝트 결정). 백엔드 Android 용 Apple 경로는 없앨 예정이다 */
export function loginMethodsFor(os: string): LoginMethod[] {
  return os === 'ios' ? ['KAKAO', 'APPLE'] : ['KAKAO'];
}

/**
 * 더미 로그인 상태. 메모리에만 두므로 앱을 다시 켜면 처음(로그아웃)으로 돌아간다 (영구 저장은 실제 로그인 연동 티켓).
 * 카카오와 Apple 은 서버에서 다른 계정이라 방식마다 가입 여부를 따로 둔다
 */
export type AuthState = {
  /** 로그인한 방식. null 이면 로그아웃 상태다 */
  signedIn: LoginMethod | null;
  /** 온보딩을 마친(가입한) 방식. 이 방식으로 로그인하면 기존 사용자라 바로 메인으로 간다 */
  registered: readonly LoginMethod[];
  /** 마지막으로 로그인한 방식. 로그인 화면이 그 버튼 위에 '최근에 로그인 했어요!' 를 띄운다 */
  lastMethod: LoginMethod | null;
};

export const initialAuthState: AuthState = {
  signedIn: null,
  registered: [],
  lastMethod: null,
};

export function isRegistered(state: AuthState, method: LoginMethod): boolean {
  return state.registered.includes(method);
}

/** 가입한 계정으로 로그인한다. 신규 사용자는 이 대신 온보딩으로 가서 completeOnboarding 으로 끝낸다 */
export function signIn(state: AuthState, method: LoginMethod): AuthState {
  return { ...state, signedIn: method, lastMethod: method };
}

/** 온보딩을 마치면 그 방식의 계정이 생기고 로그인 상태가 된다 */
export function completeOnboarding(
  state: AuthState,
  method: LoginMethod,
): AuthState {
  return {
    signedIn: method,
    registered: isRegistered(state, method)
      ? state.registered
      : [...state.registered, method],
    lastMethod: method,
  };
}

export function signOut(state: AuthState): AuthState {
  return { ...state, signedIn: null };
}

/** 탈퇴하면 그 계정이 사라진다. 다시 로그인하면 신규 사용자이고, 최근 로그인 표시도 지운다 */
export function withdraw(state: AuthState): AuthState {
  return {
    signedIn: null,
    registered: state.registered.filter(method => method !== state.signedIn),
    lastMethod: null,
  };
}

/** 온보딩을 마친 계정으로 로그인해 있는 상태. 테스트가 메인에서 시작할 때 쓴다 */
export function signedInAuth(method: LoginMethod = 'KAKAO'): AuthState {
  return completeOnboarding(initialAuthState, method);
}

/** 이름 2~20자 한글·영문과 010 으로 시작하는 연락처 11자리를 모두 넣어야 등록할 수 있다 (Spec_프로필 입력 화면) */
export function canRegisterProfile(input: ProfileInput): boolean {
  return isValidProfile(input);
}

/**
 * 약관 종류. 백엔드 TermsType 은 SERVICE·PRIVACY(필수)·MARKETING(선택) 셋이고,
 * Figma 는 제3자 제공·위치기반 서비스를 더한 다섯이다. 앱은 Figma 대로 보이고 연동 티켓에서 맞춘다
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
