import { toTermsBlocks } from './termsText';

// 약관 전문(txt)을 Figma 약관 상세(51019:16927) 모양의 덩어리로 나눈다 (#192).
// 빈 줄로 나뉜 덩어리마다 한 칸이고, '제N조' 한 줄은 글머리표 조 제목, 그 아래 글은 들여 쓴다
describe('toTermsBlocks', () => {
  it('빈 줄로 덩어리를 나누고, 조 제목 아래 글은 들여 쓴다', () => {
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
      { kind: 'paragraph', text: 'Orbit 서비스 이용약관', indented: false },
      { kind: 'paragraph', text: '버전(시행일) [시행일]', indented: false },
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
