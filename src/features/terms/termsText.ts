// 약관 전문(txt)을 Figma 약관 상세(51019:16927) 모양의 덩어리로 나눈다 (#192).
// 운영자가 올리는 전문은 빈 줄로 문단을 나누고 '제N조(제목)' 를 한 줄로 쓴다. Figma 는 조 제목을 글머리표 줄로,
// 그 아래 글을 18 들여 쓴다. 조 밖의 글(첫 조 앞 서문, 마지막 조 뒤 꼬리, 조가 없는 동의서)은 들여 쓰지 않는다.
// - 조 제목: 줄 전체가 '제N조', '제N조의M', 뒤에 '(제목)' 이 붙는 모양일 때만 ('제13조를 위반한…' 같은 문장은 본문)
// - 머리말: 조가 있는 문서에서 첫 조 앞의 문서 이름 줄(첫 줄)과 '버전(시행일) …' 줄은 뺀다. 화면의 큰 제목과 겹치고
//   Figma 본문(51028:17061)은 '제1조' 부터 시작한다. 그 밖의 서문은 내용이라 남긴다
// - 꼬리: 마지막 조 뒤의 '부칙'·'개정 이력'·'사업자 정보' 같은 짧은 제목 줄부터는 조 밖이다. Figma 에 이 자리가 없어
//   안내 글처럼 왼쪽에 둔다 (기본안)

export type TermsBlock =
  | { kind: 'article'; text: string }
  | { kind: 'paragraph'; text: string; indented: boolean };

const ARTICLE_TITLE = /^제\d+조(의\d+)?\s*(\([^)]*\))?$/;
const VERSION_LINE = /^버전\s*\(시행일\)/;
/** 꼬리 제목('부칙', '개정 이력', '사업자 정보')의 최대 길이. 본문 문장보다 훨씬 짧다 */
const SECTION_TITLE_MAX = 20;
/** 문장 끝·항목 표시. 이것으로 끝나거나 들어 있으면 꼬리 제목이 아니다 */
const SENTENCE_END = /[.。:]$/;

/** 조 밖의 짧은 제목 줄 (마지막 조 뒤 꼬리의 시작) */
const isSectionTitle = (lines: readonly string[]) =>
  lines.length === 1 &&
  lines[0].length <= SECTION_TITLE_MAX &&
  !SENTENCE_END.test(lines[0]) &&
  !lines[0].includes(':');

export function toTermsBlocks(text: string): TermsBlock[] {
  const chunks = text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map(chunk =>
      chunk
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== ''),
    )
    .filter(lines => lines.length > 0);
  const isArticle = (lines: readonly string[]) =>
    lines.length === 1 && ARTICLE_TITLE.test(lines[0]);
  const firstArticle = chunks.findIndex(isArticle);

  const blocks: TermsBlock[] = [];
  let inArticle = false;
  chunks.forEach((lines, index) => {
    if (isArticle(lines)) {
      inArticle = true;
      blocks.push({ kind: 'article', text: lines[0] });
      return;
    }
    if (index < firstArticle && isHeader(lines, index)) {
      return;
    }
    if (inArticle && isSectionTitle(lines)) {
      inArticle = false;
    }
    blocks.push({
      kind: 'paragraph',
      text: lines.join('\n'),
      indented: inArticle,
    });
  });
  return blocks;
}

/** 첫 조 앞의 머리말: 문서 이름 줄(첫 덩어리의 한 줄)과 '버전(시행일)' 줄 */
const isHeader = (lines: readonly string[], index: number) =>
  lines.length === 1 && (index === 0 || VERSION_LINE.test(lines[0]));
