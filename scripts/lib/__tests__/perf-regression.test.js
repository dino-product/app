const { findPerfRegressions } = require('../perf-regression');

function entry(overrides = {}) {
  return {
    name: 'HomeScreen mount',
    type: 'render',
    current: {
      meanCount: 1,
      issues: { initialUpdateCount: 0, redundantUpdates: [] },
    },
    baseline: { meanCount: 1 },
    durationDiff: 0,
    relativeDurationDiff: 0,
    isDurationDiffSignificant: false,
    countDiff: 0,
    relativeCountDiff: 0,
    ...overrides,
  };
}

function compareResult(overrides = {}) {
  return {
    significant: [],
    meaningless: [],
    countChanged: [],
    renderIssues: [],
    added: [],
    removed: [],
    errors: [],
    warnings: [],
    ...overrides,
  };
}

describe('findPerfRegressions', () => {
  it('변화가 없으면 실패도 경고도 없다', () => {
    expect(findPerfRegressions(compareResult())).toEqual({
      failures: [],
      warnings: [],
    });
  });

  it('렌더 횟수가 늘어나면 실패로 본다 (결정적 지표)', () => {
    const result = findPerfRegressions(
      compareResult({
        countChanged: [
          entry({
            current: {
              meanCount: 3,
              issues: { initialUpdateCount: 0, redundantUpdates: [] },
            },
            countDiff: 2,
          }),
        ],
      }),
    );

    expect(result.failures).toEqual([
      'HomeScreen mount: 렌더 횟수 +2 (baseline 1 → current 3)',
    ]);
  });

  it('렌더 횟수가 줄어든 것은 실패가 아니다', () => {
    const result = findPerfRegressions(
      compareResult({ countChanged: [entry({ countDiff: -1 })] }),
    );

    expect(result.failures).toEqual([]);
  });

  it('불필요한 렌더(초기 업데이트, 중복 렌더)가 있으면 실패로 본다', () => {
    const result = findPerfRegressions(
      compareResult({
        renderIssues: [
          entry({
            current: {
              meanCount: 3,
              issues: { initialUpdateCount: 1, redundantUpdates: [2] },
            },
          }),
        ],
      }),
    );

    expect(result.failures).toEqual([
      'HomeScreen mount: 마운트 직후 추가 렌더 1회, 중복 렌더 1회',
    ]);
  });

  it('통계적으로 유의한 렌더 시간 증가는 경고로만 남긴다 (CI 머신 노이즈)', () => {
    const result = findPerfRegressions(
      compareResult({
        significant: [
          entry({
            durationDiff: 3.2,
            relativeDurationDiff: 0.25,
            isDurationDiffSignificant: true,
          }),
          entry({
            name: 'faster',
            durationDiff: -1,
            relativeDurationDiff: -0.1,
            isDurationDiffSignificant: true,
          }),
        ],
      }),
    );

    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual([
      'HomeScreen mount: 렌더 시간 +3.2ms (+25.0%)',
    ]);
  });

  it('reassure 비교 자체의 에러는 실패로 본다', () => {
    const result = findPerfRegressions(
      compareResult({ errors: ['baseline 파일 형식 오류'] }),
    );

    expect(result.failures).toEqual(['baseline 파일 형식 오류']);
  });
});
