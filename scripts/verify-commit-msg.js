#!/usr/bin/env node
// husky commit-msg 훅: 모든 커밋이 티켓(이슈)에 연결되도록 강제한다.
const fs = require('node:fs');
const { validateCommitMessage } = require('./lib/commit-message');

const result = validateCommitMessage(fs.readFileSync(process.argv[2], 'utf8'));

if (!result.valid) {
  console.error(`\n❌ ${result.error}\n`);
  process.exit(1);
}
