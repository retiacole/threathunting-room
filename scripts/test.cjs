'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = path.join(root, 'tests');
if (!fs.existsSync(tests)) {
  console.error('Application tests are not present. Import the finalized application source before running npm test.');
  process.exit(1);
}
const files = fs.readdirSync(tests).filter(name => name.endsWith('.test.cjs')).sort();
if (!files.length) {
  console.error('No application tests found in tests/.');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...files.map(name => path.join(tests, name))], {cwd: root, stdio: 'inherit'});
if (result.error) console.error(result.error.message);
process.exit(result.status === null ? 1 : result.status);
