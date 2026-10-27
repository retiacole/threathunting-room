'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
const catalog = require('../src/catalog.cjs');
const { createPublicBundle } = require('../src/public-data.cjs');
const cases = catalog.tasks.filter(task => task.chapter === 'C');
const environment = catalog.environments.aonagi;
const bundle = createPublicBundle(catalog);
const publicCases = bundle.tasks.filter(task => task.chapter === 'C').map(task => {
  const records = new Map(bundle.environments[task.environment].logs.map(row => [row.id, row]));
  return { ...task, logs: task.logIds.map(id => records.get(id)) };
});
function field(row, name) {
  return row.detail.match(new RegExp(`(?:^| )${name}=(?:"([^"]*)"|([^ ]+))`, 'i'))?.slice(1).find(Boolean);
}

test('C query scopes are explicit and identical across the visible and independent corpora', () => {
  for (const task of cases) {
    const expected = task.id <= 'c03'
      ? { period: 'current', timezone: 'Asia/Tokyo', from: '2026-09-14', to: '2026-09-16' }
      : { period: 'current', timezone: 'Asia/Tokyo', from: '2026-09-15', to: '2026-09-15' };
    assert.deepEqual(task.rubric.query.filters, expected, task.id);
    assert.equal(task.rubric.query.validation.filters, undefined, `${task.id} inherits the same visible scope`);
    for (const row of task.rubric.query.validation.logs) {
      const period = environment.periods[row.period];
      assert.ok(period, row.id);
      const localDay = new Date(Date.parse(row.at) + 9 * 3600000).toISOString().slice(0, 10);
      assert.ok(localDay >= period.from && localDay <= period.to, `${row.id} truthful JST period label`);
    }
  }
  for (const task of publicCases) assert.equal(E.gradeQuery(task.logs, task.explanation.sampleQuery, task.rubric.query).passed, true, `${task.id} public model`);
});

test('C01 behavior query works without repeating dates in OR branches and keeps benign comparisons distinct', () => {
  const task = cases.find(item => item.id === 'c01');
  assert.doesNotMatch(task.explanation.sampleQuery, /(?:after|before):/);
  assert.equal(E.gradeQuery(task.logs, task.explanation.sampleQuery, task.rubric.query).passed, true);
  const validation = task.rubric.query.validation;
  const byId = new Map(validation.logs.map(row => [row.id, row]));
  for (const id of ['validation-c01-same-parent', 'validation-c01-same-child', 'validation-c01-browser-destination', 'validation-c01-other-destination']) {
    assert.ok(byId.has(id));
    assert.equal(validation.expected.includes(id), false, id);
  }
  assert.ok(validation.logs.filter(row => row.source === '業務').length >= 3, 'comparison activities have applicable business context');
  assert.equal(byId.get('validation-c01-same-child').process_guid, byId.get('validation-c01-other-destination').process_guid);
  assert.match(byId.get('validation-c01-same-child').detail, /QuarterlyExport/);
});

test('C01 requires a selected evidence-based reason why the finance authorization does not apply', () => {
  const task = cases.find(item => item.id === 'c01'), rubric = task.rubric;
  const draft = { targets: rubric.targets, sources: rubric.sources, verdict: rubric.verdict, finding: rubric.finding,
    alternative: rubric.alternative, from: task.periods.current.from, to: task.periods.current.to,
    query: task.explanation.sampleQuery, ownHypothesis: task.modelHypothesis, reviewedHypothesis: task.modelHypothesis,
    evidence: rubric.evidenceGroups.map(group => ({ id: group.anyOf[0], role: group.role })) };
  assert.equal(task.alternativeExplanations.length, 3);
  assert.equal(E.gradeTask(task, draft, rubric.operations).passed, true);
  for (const alternative of ['', ...task.alternativeExplanations.map(item => item.id).filter(id => id !== rubric.alternative)]) {
    assert.equal(E.gradeTask(task, { ...draft, alternative }, rubric.operations).passed, false, `alternative ${alternative}`);
  }
  assert.ok(rubric.evidenceGroups.some(group => group.role === 'context' && group.anyOf.includes('business-finance-export')));
});

test('C04 asks for download responses, excludes portal list/status and never reuses the chosen session on another day', () => {
  const task = cases.find(item => item.id === 'c04');
  assert.match(task.brief, /path=\/download/);
  const validation = task.rubric.query.validation;
  const targetSessions = new Set(validation.logs.filter(row => validation.expected.includes(row.id)).map(row => row.session));
  for (const session of targetSessions) {
    const dates = new Set(validation.logs.filter(row => row.session === session).map(row => new Date(Date.parse(row.at) + 9 * 3600000).toISOString().slice(0, 10)));
    assert.deepEqual([...dates], ['2026-09-15']);
  }
  for (const row of validation.logs.filter(row => /path=\/(list|status)\b/.test(row.detail))) {
    assert.equal(validation.expected.includes(row.id), false);
    assert.ok(row.bytes < 10000, 'ordinary navigation response volume');
  }
});

test('C05 includes both port 80 and 443 boundary flows without imposing an unstated TLS requirement', () => {
  for (const task of [cases.find(item => item.id === 'c05'), publicCases.find(item => item.id === 'c05')]) {
    assert.doesNotMatch(task.explanation.sampleQuery, /tls=true/);
    assert.match(task.explanation.sampleQuery, /sensor:edge-flow/);
    assert.match(task.context, /ポート80/);
    for (const [rows, expected] of [[task.logs, task.rubric.query.expected], [task.rubric.query.validation.logs, task.rubric.query.validation.expected]]) {
      const positives = rows.filter(row => expected.includes(row.id));
      assert.deepEqual(positives.map(row => Number(field(row, 'dst_port'))).sort((a, b) => a - b), [80, 443]);
      assert.ok(positives.every(row => row.sensor === 'edge-flow' && row.host === 'FIN-WS-03'));
      assert.equal(new Set(positives.map(row => row.bytes)).size, 2);
    }
    assert.equal(E.gradeQuery(task.logs, task.explanation.sampleQuery, task.rubric.query).passed, true);
    assert.equal(E.gradeQuery(task.logs, `${task.explanation.sampleQuery} "tls=true"`, task.rubric.query).passed, false, 'TLS-only omits the requested port 80 flow');
  }
});

test('ordinary edge flows vary ephemeral source ports across days', () => {
  const rows = environment.logs.filter(row => /^normal-edge-.*-09\d\d-0$/.test(row.id));
  const hosts = new Set(rows.map(row => row.host));
  for (const host of hosts) {
    const ports = new Set(rows.filter(row => row.host === host).map(row => field(row, 'src_port')));
    assert.ok(ports.size >= 5, `${host} does not repeat one source port daily`);
    assert.ok([...ports].every(port => Number(port) >= 49152 && Number(port) <= 65535));
  }
});
