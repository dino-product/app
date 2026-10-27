const TYPES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'test',
  'docs',
  'chore',
  'ci',
  'build',
  'style',
  'revert',
];
const MAX_HEADER_LENGTH = 100;

// <type>(#<issue>)[!]: <subject>
const HEADER_PATTERN = new RegExp(`^(${TYPES.join('|')})\\(#\\d+\\)!?: \\S`);
const TYPE_WITHOUT_TICKET_PATTERN = new RegExp(
  `^(${TYPES.join('|')})(\\([^)]*\\))?!?: `,
);
// git 이 자동으로 만드는 메시지
const EXEMPT_PATTERNS = [/^Merge /, /^Revert "/, /^(fixup|squash|amend)! /];

const FORMAT_HINT = `형식: <type>(#<티켓번호>): <내용>  예) feat(#12): 홈 화면 추가\n  type: ${TYPES.join(
  ', ',
)}`;

function validateCommitMessage(message) {
  const header =
    message
      .split('\n')
      .find(line => line.trim() !== '' && !line.startsWith('#')) ?? '';

  if (EXEMPT_PATTERNS.some(pattern => pattern.test(header))) {
    return { valid: true };
  }
  if (header.length > MAX_HEADER_LENGTH) {
    return {
      valid: false,
      error: `첫 줄은 ${MAX_HEADER_LENGTH}자 이하여야 합니다 (현재 ${header.length}자).`,
    };
  }
  if (HEADER_PATTERN.test(header)) {
    return { valid: true };
  }
  if (TYPE_WITHOUT_TICKET_PATTERN.test(header)) {
    return {
      valid: false,
      error: `티켓(이슈) 번호가 없습니다. 모든 커밋은 티켓에 연결되어야 합니다.\n  ${FORMAT_HINT}`,
    };
  }
  return {
    valid: false,
    error: `커밋 메시지 형식이 올바르지 않습니다.\n  ${FORMAT_HINT}`,
  };
}

module.exports = { validateCommitMessage };
