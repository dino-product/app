import {
  rawResponse,
  type FakeResponse,
  type FakeServer,
} from '../../shared/testing/fakeServer';
import {
  TERMS_DOCUMENTS,
  termsDocumentUrl,
  type TermsDocument,
} from './documents';

// 약관 전문 테스트 도구 (#192). 웹 버킷이 주는 모양(text/plain; charset=utf-8)으로 답한다

/** 웹 버킷이 주는 약관 전문 응답 */
export const termsText = (text: string): FakeResponse =>
  rawResponse(200, text, { 'Content-Type': 'text/plain; charset=utf-8' });

/** 전문마다 다른 짧은 본문. 첫 조 제목으로 어느 전문인지 알 수 있다 */
export const sampleTermsText = (document: TermsDocument) =>
  [
    `${document} 전문`,
    '',
    `제1조(${document} 목적)`,
    '',
    `${document} 의 목적을 규정합니다.`,
  ].join('\n');

/** 가짜 서버에 약관 전문 네 종류의 응답을 정한다. 따로 주지 않은 전문은 sampleTermsText 다 */
export function withTermsDocuments(
  server: FakeServer,
  responses: Partial<Record<TermsDocument, FakeResponse>> = {},
): FakeServer {
  for (const document of TERMS_DOCUMENTS) {
    server.on(
      'GET',
      termsDocumentUrl(document),
      responses[document] ?? termsText(sampleTermsText(document)),
    );
  }
  return server;
}
