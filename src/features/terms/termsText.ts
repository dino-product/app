// 약관 전문(txt)을 Figma 약관 상세(51019:16927) 모양의 덩어리로 나눈다 (#192).
// 운영자가 올리는 전문은 빈 줄로 문단을 나누고 '제N조(제목)' 를 한 줄로 쓴다. Figma 는 조 제목을 글머리표 줄로,
// 그 아래 글을 18 들여 쓴다. 조 제목보다 앞의 글(문서 이름·버전)과 조가 없는 동의서는 들여 쓰지 않는다

export type TermsBlock =
  | { kind: 'article'; text: string }
  | { kind: 'paragraph'; text: string; indented: boolean };

const ARTICLE_TITLE = /^제\d+조/;

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
  return blocks;
}
