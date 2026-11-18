import {
  myPageTermsDocuments,
  signUpTermsDocuments,
  TERMS_DOCUMENTS,
  termsDocumentUrl,
} from './documents';

// 약관 전문 주소 (#192). 웹 버킷 terms/{종류}/{버전}.txt
describe('termsDocumentUrl', () => {
  it('develop_only=true 면 호스트는 dev.orbi-t.com 이다', () => {
    const url = new URL(termsDocumentUrl('service', { developOnly: true }));

    expect(url.host).toBe('dev.orbi-t.com');
    expect(url.href).toBe(
      'https://dev.orbi-t.com/terms/service/2026-10-10.txt',
    );
  });

  it('develop_only=false 면 호스트는 orbi-t.com 이다 (dev. 없음)', () => {
    const url = new URL(termsDocumentUrl('service', { developOnly: false }));

    expect(url.host).toBe('orbi-t.com');
    expect(url.href).toBe('https://orbi-t.com/terms/service/2026-10-10.txt');
  });

  it('약관 네 종류의 경로', () => {
    expect(
      TERMS_DOCUMENTS.map(document =>
        termsDocumentUrl(document, { developOnly: true }),
      ),
    ).toEqual([
      'https://dev.orbi-t.com/terms/service/2026-10-10.txt',
      'https://dev.orbi-t.com/terms/privacy-consent/2026-10-10.txt',
      // 사용자 원문 경로는 privacy-ploicy 였으나 그 경로는 약관이 아닌 웹 페이지(HTML)를 돌려줘 privacy-policy 로 쓴다
      'https://dev.orbi-t.com/terms/privacy-policy/2026-10-10.txt',
      'https://dev.orbi-t.com/terms/marketing/2026-10-10.txt',
    ]);
  });

  it('빌드 값을 주지 않으면 이 빌드의 웹 주소(테스트는 Debug 라 개발)를 쓴다', () => {
    expect(termsDocumentUrl('marketing')).toBe(
      'https://dev.orbi-t.com/terms/marketing/2026-10-10.txt',
    );
  });
});

describe('약관 행 ↔ 전문 대응표', () => {
  it('가입 약관: 서비스→service, 개인정보 처리방침(필수)→privacy-consent, 혜택 알림→marketing, 제3자·위치기반은 전문 없음', () => {
    expect(signUpTermsDocuments).toEqual({
      SERVICE: 'service',
      PRIVACY: 'privacy-consent',
      THIRD_PARTY: null,
      LOCATION: null,
      MARKETING: 'marketing',
    });
  });

  it('마이 › 약관: 서비스 이용약관→service, 개인정보 처리방침→privacy-policy', () => {
    expect(myPageTermsDocuments).toEqual({
      service: 'service',
      privacy: 'privacy-policy',
    });
  });
});
