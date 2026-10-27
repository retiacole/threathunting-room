'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {aliases, checkHtml} = require('./publication-checks.cjs');
const root = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(root, 'build.cjs')) || !fs.existsSync(path.join(root, 'src/catalog.cjs'))) {
  console.error('Finalized application source is missing. Import build.cjs and src/ before building. No placeholder HTML was generated.');
  process.exit(1);
}
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'threathunting-publication-'));
try {
  const result = spawnSync(process.execPath, [path.join(root, 'build.cjs')], {
    cwd: root, env: {...process.env, TH_OUTPUT_DIR: out}, stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Application build failed (exit ${result.status}).`);
  const htmlPath = path.join(out, 'index.html');
  if (!fs.existsSync(htmlPath)) throw new Error('Application build did not produce index.html.');
  const content = fs.readFileSync(htmlPath);
  const errors = checkHtml(content.toString('utf8'));
  if (errors.length) throw new Error(errors.join('\n'));
  for (const alias of aliases) {
    const target = path.join(root, alias);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target + '.tmp', content);
    fs.renameSync(target + '.tmp', target);
  }
  fs.writeFileSync(path.join(root, 'docs/.nojekyll'), '');
  console.log(`Prepared ${aliases.length} identical standalone HTML files (${content.length} bytes each).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(out, {recursive: true, force: true});
}
