#!/usr/bin/env node
// Release JS 번들을 플랫폼별로 만들어 performance-budget.json 의 bundle 예산과 비교한다.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const budget = require('../performance-budget.json');
const {
  evaluateBundleSize,
  formatBundleReport,
} = require('./lib/bundle-budget');

const root = path.resolve(__dirname, '..');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dino-bundle-'));

const results = Object.entries(budget.bundle.maxJsBundleKb).map(
  ([platform, maxKb]) => {
    const bundleOutput = path.join(outDir, `${platform}.jsbundle`);
    execFileSync(
      'npx',
      [
        'react-native',
        'bundle',
        '--platform',
        platform,
        '--dev',
        'false',
        '--minify',
        'true',
        '--entry-file',
        'index.js',
        '--bundle-output',
        bundleOutput,
        '--assets-dest',
        path.join(outDir, `assets-${platform}`),
      ],
      { cwd: root, stdio: 'ignore' },
    );
    return evaluateBundleSize({
      platform,
      bytes: fs.statSync(bundleOutput).size,
      maxKb,
    });
  },
);

fs.rmSync(outDir, { recursive: true, force: true });
console.log(formatBundleReport(results));

if (results.some(result => !result.withinBudget)) {
  console.error(
    '\n번들 예산 초과. 의존성을 줄이거나, 예산 상향은 type:perf 티켓으로 근거를 남기세요.',
  );
  process.exit(1);
}
