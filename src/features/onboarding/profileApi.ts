import { ApiError, ApiErrorMessage, type ApiClient } from '../../shared/api';
import { isRecord } from '../../shared/isRecord';
import type { ProfileInput } from '../my/model';
import type { TermsAgreement } from './model';

// 가입 단계 API (#113, 백엔드 §2.2 Profile). 사용법: `const profile = await fetchProfile(api, accountId)` → profile.nextStep 으로 화면을 정한다.
// 프로필 조회·입력·약관 동의는 가입 전에도 부를 수 있는 허용 목록이고, 모두 같은 ProfileResponse 를 돌려준다

/** 아직 끝내지 않은 가입 단계. 프로필 없음 → PROFILE, 프로필은 있으나 약관 동의(재동의 포함) 전 → TERMS, 이용 가능 → COMPLETED */
export type NextStep = 'PROFILE' | 'TERMS' | 'COMPLETED';
const NEXT_STEPS: readonly NextStep[] = ['PROFILE', 'TERMS', 'COMPLETED'];
type SignupStatus = 'PENDING_SIGNUP' | 'ACTIVE';
const SIGNUP_STATUSES: readonly SignupStatus[] = ['PENDING_SIGNUP', 'ACTIVE'];

/** ProfileResponse. 마이 탭의 Profile(화면 모델)과 달리 가입 전 값(null)을 담는다 */
export type AccountProfile = {
  accountId: number;
  status: SignupStatus;
  nextStep: NextStep;
  /** 프로필 입력 전 null */
  name: string | null;
  /** 숫자 11자리. 프로필 입력 전 null */
  phoneNumber: string | null;
  /** 가입을 마친 시각 (ISO, UTC) */
  signedUpAt: string | null;
  /** 약관 동의 전 null */
  marketingAgreed: boolean | null;
};

/** 가입 단계 오류 코드 (백엔드 ProfileErrorCode) */
export const ProfileErrorCode = {
  /** 이름·연락처 규칙 위반. 어느 칸인지 알려 주지 않는다 */
  invalidInput: 'PROFILE-001',
  /** 가입 또는 약관 재동의 전에는 허용 목록 밖 API 를 쓸 수 없다 */
  signupRequired: 'PROFILE-005',
} as const;

export const profilePath = (accountId: number) =>
  `/api/v1/profiles/${accountId}`;

const isOneOf = <T extends string>(
  values: readonly T[],
  value: unknown,
): value is T => values.includes(value as T);
// 값이 없는 필드는 null 로 온다(Jackson 기본). 키가 빠져 와도(NON_NULL) 같은 뜻으로 받는다
const isNullable = (type: 'string' | 'boolean', value: unknown) =>
  value === null || value === undefined || typeof value === type;

/** 서버 응답을 확인해 옮긴다. 모양이 다르면 서버 응답 오류로 던진다 */
export function parseProfile(value: unknown): AccountProfile {
  if (
    !isRecord(value) ||
    typeof value.accountId !== 'number' ||
    !isOneOf(SIGNUP_STATUSES, value.status) ||
    !isOneOf(NEXT_STEPS, value.nextStep) ||
    !isNullable('string', value.name) ||
    !isNullable('string', value.phoneNumber) ||
    !isNullable('string', value.signedUpAt) ||
    !isNullable('boolean', value.marketingAgreed)
  ) {
    throw new ApiError({
      kind: 'http',
      status: 200,
      message: ApiErrorMessage.invalidResponse,
    });
  }
  return {
    accountId: value.accountId,
    status: value.status,
    nextStep: value.nextStep,
    name: (value.name as string | undefined) ?? null,
    phoneNumber: (value.phoneNumber as string | undefined) ?? null,
    signedUpAt: (value.signedUpAt as string | undefined) ?? null,
    marketingAgreed: (value.marketingAgreed as boolean | undefined) ?? null,
  };
}

/**
 * 약관 동의 본문 (AgreeToTermsRequest). 서버 약관은 서비스·개인정보(필수)·마케팅(선택) 셋이다.
 * Figma 의 제3자 제공·위치기반은 서버 항목이 없어 앱에서만 필수로 확인한다 (#112 G10)
 */
export function toTermsAgreementRequest(agreement: TermsAgreement) {
  return {
    serviceTerms: agreement.SERVICE,
    privacyPolicy: agreement.PRIVACY,
    marketing: agreement.MARKETING,
  };
}

/** 로그인한 본인 accountId. 기기 세션(Keychain)에서 읽는다. 세션이 없으면 던진다 */
export async function currentAccountId(api: ApiClient): Promise<number> {
  const session = await api.session.getSession();
  if (session === null) {
    throw new Error('로그인 세션이 없다');
  }
  return session.accountId;
}

/** GET /api/v1/profiles/{accountId} */
export async function fetchProfile(
  api: ApiClient,
  accountId: number,
): Promise<AccountProfile> {
  return parseProfile(await api.get(profilePath(accountId)));
}

/** PUT /api/v1/profiles/{accountId}. 연락처는 숫자만 보낸다 (서버도 숫자 외 문자를 지운다) */
export async function saveProfile(
  api: ApiClient,
  accountId: number,
  { name, phoneNumber }: ProfileInput,
): Promise<AccountProfile> {
  return parseProfile(
    await api.put(profilePath(accountId), {
      name,
      phoneNumber: phoneNumber.replace(/\D/g, ''),
    }),
  );
}

/** POST /api/v1/profiles/{accountId}/terms-agreements. 필수 둘에 동의하면 가입이 끝난다(ACTIVE) */
export async function agreeToTerms(
  api: ApiClient,
  accountId: number,
  agreement: TermsAgreement,
): Promise<AccountProfile> {
  return parseProfile(
    await api.post(
      `${profilePath(accountId)}/terms-agreements`,
      toTermsAgreementRequest(agreement),
    ),
  );
}
