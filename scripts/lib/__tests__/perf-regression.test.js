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

  describe('예산 예외 (performance-budget.json 의 render.exceptions)', () => {
    const renderBudget = {
      maxInitialUpdateCount: 0,
      maxRedundantUpdates: 0,
      exceptions: [
        {
          scenario: 'App 다시 열기',
          maxInitialUpdateCount: 4,
          ticket: 92,
          reason: '나갈 때 묻기 등록',
        },
      ],
    };
    const issues = (name, initialUpdateCount, redundantUpdates = []) =>
      compareResult({
        renderIssues: [
          entry({
            name,
            current: {
              meanCount: 1,
              issues: { initialUpdateCount, redundantUpdates },
            },
          }),
        ],
      });

    it('예외로 둔 시나리오는 허용 횟수까지 실패 대신 경고로 남긴다', () => {
      expect(
        findPerfRegressions(issues('App 다시 열기', 4), renderBudget),
      ).toEqual({
        failures: [],
        warnings: [
          'App 다시 열기: 마운트 직후 추가 렌더 4회 — 예산 예외 #92 (4회까지, 나갈 때 묻기 등록)',
        ],
      });
    });

    it('허용 횟수를 넘으면 실패다', () => {
      expect(
        findPerfRegressions(issues('App 다시 열기', 5), renderBudget).failures,
      ).toEqual(['App 다시 열기: 마운트 직후 추가 렌더 5회, 중복 렌더 0회']);
    });

    it('예외 시나리오도 중복 렌더는 예산대로 본다', () => {
      expect(
        findPerfRegressions(issues('App 다시 열기', 2, [3]), renderBudget)
          .failures,
      ).toEqual(['App 다시 열기: 마운트 직후 추가 렌더 2회, 중복 렌더 1회']);
    });

    it('다른 시나리오는 예외를 받지 않는다', () => {
      expect(
        findPerfRegressions(issues('App 첫 실행', 1), renderBudget).failures,
      ).toEqual(['App 첫 실행: 마운트 직후 추가 렌더 1회, 중복 렌더 0회']);
    });

    it('예산을 따로 주지 않으면 저장소의 performance-budget.json 을 쓴다', () => {
      const budget = require('../../../performance-budget.json');
      const [exception] = budget.render.exceptions;

      expect(
        findPerfRegressions(
          issues(exception.scenario, exception.maxInitialUpdateCount),
        ).failures,
      ).toEqual([]);
    });
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
