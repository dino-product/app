import { resolveWebOrigin, webOrigin } from '../../shared/api/config';
import type { TermsType } from '../onboarding/model';

// 약관 전문 (#192). 운영자가 웹 버킷 terms/{종류}/{버전}.txt 에 올린 UTF-8 텍스트(text/plain)를 받아 보인다.
// 웹 주소는 빌드 값 DEVELOP_ONLY 로 고른다 (dev.orbi-t.com / orbi-t.com, src/shared/api/config.ts).
// 백엔드도 같은 주소를 GET /api/v1/terms 로 알려 주지만, 지금은 정해 준 경로·버전을 그대로 쓴다

/**
 * 전문 종류 = 경로의 {종류}. 백엔드 약관 종류와 같다: service 서비스 이용약관(필수 동의), privacy-consent 개인정보 수집·이용 동의
 * (필수 동의, 서버 PRIVACY), privacy-policy 개인정보 처리방침(동의 대상 아님), marketing 마케팅 정보 수신 동의(선택)
 */
export type TermsDocument =
  | 'service'
  | 'privacy-consent'
  // 사용자 원문 경로는 privacy-ploicy 였으나 그 경로는 약관이 아닌 웹 페이지(HTML)를 돌려줘 privacy-policy 로 쓴다
  | 'privacy-policy'
  | 'marketing';

export const TERMS_DOCUMENTS: readonly TermsDocument[] = [
  'service',
  'privacy-consent',
  'privacy-policy',
  'marketing',
];

/** 시행 중인 약관 버전(시행일). 경로의 {버전} */
export const TERMS_VERSION = '2026-10-10';

/** 전문 주소. developOnly 를 주지 않으면 이 빌드의 웹 주소를 쓴다 */
export function termsDocumentUrl(
  document: TermsDocument,
  options?: { developOnly: boolean },
): string {
  const origin =
    options === undefined ? webOrigin : resolveWebOrigin(options.developOnly);
  return `${origin}/terms/${document}/${TERMS_VERSION}.txt`;
}

// 약관 행 ↔ 전문 대응표. 행은 가입 약관 넷(Figma 다섯에서 위치기반을 뺐다, #232), 마이 › 약관 둘이고, 전문은 원격 네 종류다.
// 가입의 '개인정보 처리방침 (필수)' 는 서버에 PRIVACY(개인정보 수집·이용 동의)로 보내므로 그 동의서를 보인다.
// 제3자 제공은 원격 전문이 없어(null) 상세에 준비 중 안내만 둔다 (사용자 확인 항목)
export const signUpTermsDocuments: Readonly<
  Record<TermsType, TermsDocument | null>
> = {
  SERVICE: 'service',
  PRIVACY: 'privacy-consent',
  THIRD_PARTY: null,
  MARKETING: 'marketing',
};

/** 마이 › 약관 및 앱 정보의 약관 행 */
export type MyPageTerms = 'service' | 'privacy';

/** 마이 › 약관 행 이름이자 그 상세의 제목 (Figma 2889:13917) */
export const myPageTermsTitles: Readonly<Record<MyPageTerms, string>> = {
  service: '서비스 이용약관',
  privacy: '개인정보 처리방침',
};

export const myPageTermsDocuments: Readonly<
  Record<MyPageTerms, TermsDocument>
> = {
  service: 'service',
  privacy: 'privacy-policy',
};
