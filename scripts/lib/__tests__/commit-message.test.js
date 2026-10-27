const { validateCommitMessage } = require('../commit-message');

describe('validateCommitMessage', () => {
  it.each([
    'feat(#12): 홈 화면 추가',
    'fix(#3): 앱 재시작 시 크래시 수정',
    'perf(#40)!: 리스트를 FlatList 로 교체',
    'test(#7): 프레임 모니터 테스트 보강',
  ])('티켓 번호가 있는 Conventional Commit 은 통과한다: %s', message => {
    expect(validateCommitMessage(message)).toEqual({ valid: true });
  });

  it('본문과 git 주석 줄은 무시하고 첫 줄만 검사한다', () => {
    const message = [
      '# 주석은 무시된다',
      'chore(#1): 레포지토리 초기 세팅',
      '',
      '본문 내용',
    ].join('\n');

    expect(validateCommitMessage(message)).toEqual({ valid: true });
  });

  it.each([
    'Merge branch "main" into feat/12-home',
    'Revert "feat(#12): 홈 화면 추가"',
    'fixup! feat(#12): 홈 화면 추가',
    'squash! feat(#12): 홈 화면 추가',
  ])('git 이 자동 생성하는 메시지는 예외로 통과한다: %s', message => {
    expect(validateCommitMessage(message)).toEqual({ valid: true });
  });

  it('티켓 번호가 없으면 실패한다', () => {
    const result = validateCommitMessage('feat: 홈 화면 추가');

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/티켓/);
  });

  it.each([
    'add home screen',
    'feature(#12): 홈 화면 추가',
    'feat(12): 홈 화면 추가',
    'feat(#12):홈 화면 추가',
    'feat(#12): ',
  ])('형식이 틀리면 실패한다: %s', message => {
    expect(validateCommitMessage(message).valid).toBe(false);
  });

  it('첫 줄이 100자를 넘으면 실패한다', () => {
    const result = validateCommitMessage(`feat(#1): ${'가'.repeat(100)}`);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/100/);
  });
});
