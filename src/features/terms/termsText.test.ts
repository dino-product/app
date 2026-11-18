import type { TermsDocument } from './documents';
import { toTermsBlocks, type TermsBlock } from './termsText';

// 약관 전문(txt)을 Figma 약관 상세(51019:16927) 모양의 덩어리로 나눈다 (#192).
// 빈 줄로 나뉜 덩어리마다 한 칸이고, '제N조' 한 줄은 글머리표 조 제목, 그 아래 글은 들여 쓴다.
// Figma 본문(51028:17061)은 '제1조'부터 시작하고 문서 이름은 큰 제목이 보이므로, 첫 조 앞의 머리말(문서 이름·버전 줄)은 뺀다

// 테스트는 Node 에서 돈다 (@types/node 를 두지 않아 쓰는 것만 선언)
declare const require: (name: 'fs') => {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
declare const __dirname: string;

/** 웹 버킷에서 받은 전문 그대로 (2026-10-10, dev·운영 같음. __fixtures__ 는 curl 로 받은 사본) */
const fixture = (document: TermsDocument) =>
  require('fs').readFileSync(
    `${__dirname}/__fixtures__/${document}.txt`,
    'utf8',
  );

const texts = (blocks: TermsBlock[]) => blocks.map(block => block.text);
const articles = (blocks: TermsBlock[]) =>
  blocks.filter(block => block.kind === 'article');

describe('toTermsBlocks', () => {
  it('빈 줄로 덩어리를 나누고, 조 제목 아래 글은 들여 쓴다. 첫 조 앞의 문서 이름·버전 줄은 뺀다', () => {
    const text = [
      'Orbit 서비스 이용약관',
      '',
      '버전(시행일) [시행일]',
      '',
      '제1조(목적)',
      '',
      '이 약관은 목적을 규정합니다.',
      '',
      '제2조(용어의 정의)',
      '',
      '① 용어의 뜻은 다음과 같습니다.',
      '',
      '1. "서비스"란 ...',
      '2. "회원"이란 ...',
    ].join('\n');

    expect(toTermsBlocks(text)).toEqual([
      { kind: 'article', text: '제1조(목적)' },
      {
        kind: 'paragraph',
        text: '이 약관은 목적을 규정합니다.',
        indented: true,
      },
      { kind: 'article', text: '제2조(용어의 정의)' },
      {
        kind: 'paragraph',
        text: '① 용어의 뜻은 다음과 같습니다.',
        indented: true,
      },
      {
        kind: 'paragraph',
        text: '1. "서비스"란 ...\n2. "회원"이란 ...',
        indented: true,
      },
    ]);
  });

  it('첫 조 앞이라도 문장(서문)은 내용이라 남긴다', () => {
    expect(
      toTermsBlocks(
        [
          '문서 이름',
          '',
          '회사는 다음과 같이 정합니다.',
          '',
          '제1조(목적)',
        ].join('\n'),
      ),
    ).toEqual([
      {
        kind: 'paragraph',
        text: '회사는 다음과 같이 정합니다.',
        indented: false,
      },
      { kind: 'article', text: '제1조(목적)' },
    ]);
  });

  it('조가 없는 문서(동의서)는 머리말도 그대로 둔다', () => {
    expect(toTermsBlocks('동의서 이름\n\n버전 1\n\n본문입니다.')).toEqual([
      { kind: 'paragraph', text: '동의서 이름', indented: false },
      { kind: 'paragraph', text: '버전 1', indented: false },
      { kind: 'paragraph', text: '본문입니다.', indented: false },
    ]);
  });

  it('CRLF·여러 빈 줄·앞뒤 공백을 정리한다', () => {
    expect(toTermsBlocks('\r\n 첫 줄 \r\n\r\n\r\n  \r\n둘째\r\n')).toEqual([
      { kind: 'paragraph', text: '첫 줄', indented: false },
      { kind: 'paragraph', text: '둘째', indented: false },
    ]);
  });

  it('조 제목으로 시작해도 여러 줄 덩어리면 본문이다', () => {
    expect(toTermsBlocks('제3조 내용이\n이어진다')).toEqual([
      { kind: 'paragraph', text: '제3조 내용이\n이어진다', indented: false },
    ]);
  });

  it('비어 있으면 덩어리가 없다', () => {
    expect(toTermsBlocks(' \n\n ')).toEqual([]);
  });
});

// 실제 전문 4종이 어떻게 잘리는지 고정한다
describe('toTermsBlocks — 웹 버킷 전문 (2026-10-10)', () => {
  it("service: 'Orbit 서비스 이용약관'·버전 줄을 빼고 제1조부터 21개 조", () => {
    const blocks = toTermsBlocks(fixture('service'));

    expect(blocks[0]).toEqual({ kind: 'article', text: '제1조(목적)' });
    expect(texts(blocks)).not.toContain('Orbit 서비스 이용약관');
    expect(texts(blocks)).not.toContain('버전(시행일) [시행일]');
    expect(articles(blocks)).toHaveLength(21);
    expect(blocks).toHaveLength(97);
  });

  it("privacy-policy: 'Orbit 개인정보 처리방침'·버전 줄은 빼고, 제1조 앞 서문 문단은 남긴다", () => {
    const blocks = toTermsBlocks(fixture('privacy-policy'));

    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      text: expect.stringMatching(
        /^\[상호\]\(이하 "회사"라 합니다\)은 「개인정보 보호법」 제30조에 따라 .*수립·공개합니다\.$/,
      ),
      indented: false,
    });
    expect(blocks[1]).toEqual({
      kind: 'article',
      text: '제1조(개인정보의 처리 목적)',
    });
    expect(texts(blocks)).not.toContain('Orbit 개인정보 처리방침');
    expect(texts(blocks)).not.toContain('버전(시행일) [시행일]');
    expect(articles(blocks)).toHaveLength(15);
    expect(blocks).toHaveLength(77);
  });

  it('privacy-consent: 조가 없어 문서 이름·버전 줄부터 그대로 18덩어리', () => {
    const blocks = toTermsBlocks(fixture('privacy-consent'));

    expect(texts(blocks).slice(0, 2)).toEqual([
      '개인정보 수집·이용 동의 (필수)',
      '버전(시행일) [시행일]',
    ]);
    expect(articles(blocks)).toHaveLength(0);
    expect(blocks).toHaveLength(18);
  });

  it('marketing: 조가 없어 문서 이름·버전 줄부터 그대로 11덩어리', () => {
    const blocks = toTermsBlocks(fixture('marketing'));

    expect(texts(blocks).slice(0, 2)).toEqual([
      '마케팅 정보 수신 동의 (선택)',
      '버전(시행일) [시행일]',
    ]);
    expect(articles(blocks)).toHaveLength(0);
    expect(blocks).toHaveLength(11);
  });
});
