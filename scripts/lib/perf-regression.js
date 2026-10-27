/**
 * reassure 비교 결과(.reassure/output.json)에서 PR 을 막을 회귀를 고른다.
 * - 렌더 횟수 증가, 불필요한 렌더: 결정적이므로 실패
 * - 렌더 시간 증가: CI 머신 노이즈가 있으므로 경고
 */
function findPerfRegressions(compareResult) {
  const failures = [...compareResult.errors];
  const warnings = [];

  for (const entry of compareResult.countChanged) {
    if (entry.countDiff > 0) {
      failures.push(
        `${entry.name}: 렌더 횟수 +${entry.countDiff} (baseline ${entry.baseline.meanCount} → current ${entry.current.meanCount})`,
      );
    }
  }

  for (const entry of compareResult.renderIssues) {
    const { initialUpdateCount, redundantUpdates } = entry.current.issues;
    failures.push(
      `${entry.name}: 마운트 직후 추가 렌더 ${initialUpdateCount}회, 중복 렌더 ${redundantUpdates.length}회`,
    );
  }

  for (const entry of compareResult.significant) {
    if (entry.durationDiff > 0) {
      warnings.push(
        `${entry.name}: 렌더 시간 +${entry.durationDiff.toFixed(1)}ms (+${(
          entry.relativeDurationDiff * 100
        ).toFixed(1)}%)`,
      );
    }
  }

  return { failures, warnings };
}

module.exports = { findPerfRegressions };
