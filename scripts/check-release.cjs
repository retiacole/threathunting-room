'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {aliases, checkHtml} = require('./publication-checks.cjs');
const root = path.resolve(__dirname, '..');
const errors = [];
for (const name of ['README.md', 'README.en.md', 'LICENSE', 'SECURITY.md', 'CONTRACT.md', 'build.cjs', 'src/catalog.cjs', 'tests/build.test.cjs', 'docs/.nojekyll', ...aliases]) {
  if (!fs.existsSync(path.join(root, name))) errors.push(`Missing required file: ${name}`);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.name !== 'threathunting-room' || pkg.author !== 'retiacole' || pkg.license !== 'MIT' || pkg.private !== true) errors.push('Unexpected package identity, license or private flag.');
for (const name of ['README.md', 'README.en.md', 'CONTRACT.md', 'docs/CURRICULUM.md', 'docs/CURRICULUM.en.md']) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) { errors.push(`Missing versioned document: ${name}`); continue; }
  const heading = fs.readFileSync(file, 'utf8').split('\n').find(line => /^# /.test(line));
  const version = heading && heading.match(/\bv(\d+\.\d+\.\d+)\b/);
  if (!version || version[1] !== pkg.version) errors.push(`Document heading must match v${pkg.version}: ${name}`);
}
const changelogPath = path.join(root, 'CHANGELOG.md');
const latestRelease = fs.existsSync(changelogPath) && fs.readFileSync(changelogPath, 'utf8').match(/^## v(\d+\.\d+\.\d+)\b/m);
if (!latestRelease || latestRelease[1] !== pkg.version) errors.push(`CHANGELOG.md must start with a release entry for v${pkg.version}.`);
if (fs.existsSync(path.join(root, aliases[0]))) {
  const reference = fs.readFileSync(path.join(root, aliases[0]));
  errors.push(...checkHtml(reference.toString('utf8')));
  for (const alias of aliases.slice(1)) {
    const target = path.join(root, alias);
    if (fs.existsSync(target) && !reference.equals(fs.readFileSync(target))) errors.push(`HTML differs from dist/index.html: ${alias}`);
  }
  if (!errors.length) console.log(`HTML SHA-256: ${crypto.createHash('sha256').update(reference).digest('hex')}`);
}
if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else console.log('Static release checks passed. Browser behavior, language coverage and personal-data review remain separate checks.');
