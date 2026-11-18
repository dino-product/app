// 약관 전문(txt)을 Figma 약관 상세(51019:16927) 모양의 덩어리로 나눈다 (#192).
// 운영자가 올리는 전문은 빈 줄로 문단을 나누고 '제N조(제목)' 를 한 줄로 쓴다. Figma 는 조 제목을 글머리표 줄로,
// 그 아래 글을 18 들여 쓴다. 조 제목보다 앞의 글과 조가 없는 동의서는 들여 쓰지 않는다.
// 전문 첫머리의 머리말('Orbit 서비스 이용약관', '버전(시행일) …')은 화면의 큰 제목과 겹치고 Figma 본문(51028:17061)은
// '제1조' 부터 시작하므로, 조가 있는 문서에서 첫 조 앞의 머리말 줄은 뺀다. 머리말은 문장으로 끝나지 않는 한 줄이다.
// 첫 조 앞이라도 문장(개인정보 처리방침의 서문 등)은 내용이라 남기고, 조가 없는 문서(동의서)는 그대로 둔다

export type TermsBlock =
  | { kind: 'article'; text: string }
  | { kind: 'paragraph'; text: string; indented: boolean };

const ARTICLE_TITLE = /^제\d+조/;
/** 문장 끝 ('…합니다.' 등). 머리말 줄은 이것으로 끝나지 않는다 */
const SENTENCE_END = /[.。]$/;

const isHeading = (block: TermsBlock) =>
  block.kind === 'paragraph' &&
  !block.text.includes('\n') &&
  !SENTENCE_END.test(block.text);

export function toTermsBlocks(text: string): TermsBlock[] {
  const blocks: TermsBlock[] = [];
  let inArticle = false;
  for (const chunk of text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)) {
    const lines = chunk
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');
    if (lines.length === 0) {
      continue;
    }
    const [first] = lines;
    if (lines.length === 1 && ARTICLE_TITLE.test(first)) {
      inArticle = true;
      blocks.push({ kind: 'article', text: first });
    } else {
      blocks.push({
        kind: 'paragraph',
        text: lines.join('\n'),
        indented: inArticle,
      });
    }
  }
  const firstArticle = blocks.findIndex(block => block.kind === 'article');
  if (firstArticle <= 0) {
    return blocks;
  }
  return [
    ...blocks.slice(0, firstArticle).filter(block => !isHeading(block)),
    ...blocks.slice(firstArticle),
  ];
}
