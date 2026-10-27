#!/usr/bin/env node
// reassure 비교 결과에서 렌더 회귀를 찾아 CI 를 실패시킨다.
const fs = require('node:fs');
const path = require('node:path');
const { findPerfRegressions } = require('./lib/perf-regression');

const outputFile = path.resolve(__dirname, '..', '.reassure', 'output.json');

if (!fs.existsSync(outputFile)) {
  console.warn(
    '비교할 baseline 이 없어 회귀 검사를 건너뜁니다 (.reassure/output.json 없음).',
  );
  process.exit(0);
}

const { failures, warnings } = findPerfRegressions(
  JSON.parse(fs.readFileSync(outputFile, 'utf8')),
);

warnings.forEach(message => console.warn(`⚠️  ${message}`));
failures.forEach(message => console.error(`❌ ${message}`));

if (failures.length > 0) {
  process.exit(1);
}
console.log('✅ 렌더 성능 회귀 없음');
