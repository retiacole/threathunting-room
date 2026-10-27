'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
const {tasks, environments} = require('../src/catalog.cjs');
const {createPublicBundle} = require('../src/public-data.cjs');

const shared = environments.aonagi;
const canonical = new Map(shared.logs.map(row => [row.id, row]));
const cases = tasks.filter(task => task.chapter === 'C');
const bundle = createPublicBundle({tasks, environments});
const publicTasks = bundle.tasks.map(task => {
  if (!task.environment) return task;
  const records = new Map(bundle.environments[task.environment].logs.map(row => [row.id, row]));
  return {...task, logs: task.logIds.map(id => records.get(id))};
});

function fields(text) {
  const result = {};
  const pattern = /([A-Za-z_][A-Za-z0-9_-]*)=(?:"((?:\\"|[^"])*)"|'([^']*)'|([^\s]+))/g;
  for (const match of (text || '').matchAll(pattern)) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  return result;
}

test('ordinary activity varies in volume, application and minute rather than identifying incidents by extra rows', () => {
  const ordinary = shared.logs.filter(row => row.id.startsWith('normal-') && !['業務', '収集'].includes(row.source));
  const counts = new Map();
  for (const row of ordinary) {
    const businessDay = new Date(Date.parse(row.at) + 9 * 3600000).toISOString().slice(0, 10);
    const key = row.host + ' ' + businessDay;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert.ok(new Set(counts.values()).size >= 5, 'normal host-day totals must vary');
  assert.ok(new Set(ordinary.filter(row => row.sensor === 'win-edr').map(row => row.process)).size >= 5, 'multiple ordinary applications');
  const auth = ordinary.filter(row => row.host === 'SALES-WS-01' && row.sensor === 'windows-security');
  assert.ok(new Set(auth.map(row => row.at.slice(11, 16))).size >= 4, 'vary the minute, not only the second');
  const updates = ordinary.filter(row => row.sensor === 'update-client' && row.at.startsWith('2026-09-07'));
  assert.ok(new Set(updates.map(row => row.at.slice(11, 16))).size >= 4, 'updates do not all start at noon');
});

test('normalization retains acquired HTTP details, connection outcomes and transport in detail and raw', () => {
  const examples = [
    ['ops-d01-seed-net', {method: 'POST', path: '/status', status: '200'}],
    ['ops-d01-spread-net', {method: 'POST', path: '/status', status: '200'}],
    ['ops-d02-DESIGN-net', {action: 'connect', result: 'success', operator: 'support-aya', change: 'SUP-225'}],
    ['ops-d02-SALES-net', {action: 'connect', result: 'success', operator: 'support-aya', change: 'SUP-225'}],
    ['ops-e03-deny-1', {protocol: 'tcp', action: 'deny', bytes_out: '0', bytes_in: '0'}],
    ['ops-e03-normal', {protocol: 'tcp', action: 'allow', bytes_out: '960', bytes_in: '4096'}]
  ];
  for (const [id, expected] of examples) {
    const row = canonical.get(id);
    assert.ok(row, id);
    for (const representation of ['detail', 'raw']) {
      const actual = fields(row[representation]);
      for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `${id} ${representation} ${key}`);
    }
  }
});

test('shared and C validation records retain sensor identity and metadata for the actual host and time', () => {
  const records = [...shared.logs, ...cases.flatMap(task => task.rubric.query.validation.logs)];
  const deviceByHost = new Map(shared.assets.map(asset => [asset.host, asset.device_id]));
  assert.ok(records.some(row => row.id.startsWith('ops-')), 'include the previously missing operations sensors');
  for (const row of records) {
    assert.equal(typeof row.sensor, 'string', `${row.id} top-level sensor`);
    assert.ok(row.sensor.trim(), `${row.id} empty sensor`);
    assert.equal(row.sensor, row.provenance?.sensor, `${row.id} sensor provenance`);
    assert.equal(row.provenance.collectionId, `collection-${row.host.toLowerCase()}`, `${row.id} collection host`);
    assert.equal(row.device_id, deviceByHost.get(row.host), `${row.id} asset identity`);
    const native = fields(row.detail);
    if (native.computer) assert.equal(native.computer, row.host, `${row.id} native host`);
    if (native.utctime) assert.equal(native.utctime, row.at, `${row.id} native time`);
    if (native.event_time) assert.equal(native.event_time, row.at, `${row.id} flow time`);
  }
});

test('the same execution GUID has one full image path across endpoint and network observations', () => {
  let pairs = 0;
  for (const [name, logs] of [['shared', shared.logs], ...cases.map(task => [task.id, task.rubric.query.validation.logs])]) {
    const executions = new Map();
    for (const row of logs) {
      if (!row.process_guid) continue;
      const image = fields(row.detail).image;
      // A sensor reporting a basename cannot assert a conflicting full path.
      if (!image || !/[\\/]/.test(image)) continue;
      const key = `${row.host.toLowerCase()}\0${row.process_guid.toLowerCase()}`;
      const path = image.replaceAll('/', '\\').toLowerCase();
      if (executions.has(key)) {
        const previous = executions.get(key);
        assert.equal(path, previous.path, `${name}: ${previous.id} and ${row.id} share a GUID`);
        pairs++;
      } else executions.set(key, {id: row.id, path});
    }
  }
  assert.ok(pairs > 0, 'exercise actual process/network pairs');
  const validation = cases.find(task => task.id === 'c01').rubric.query.validation.logs;
  const child = validation.find(row => row.id === 'validation-c01-child');
  const network = validation.find(row => row.id === 'validation-c01-egress');
  assert.equal(child.process_guid, network.process_guid);
  assert.equal(fields(child.detail).image, fields(network.detail).image, 'C01 regression must compare both full paths');
});

test('all five C query exercises use unseen positive and negative records with passing model expressions', () => {
  assert.deepEqual(cases.map(task => task.id), ['c01', 'c02', 'c03', 'c04', 'c05']);
  for (const task of publicTasks.filter(item => item.chapter === 'C')) {
    const spec = task.rubric.query;
    assert.ok(spec.validation?.logs.length, `${task.id} independent corpus`);
    assert.ok(spec.validation.expected.length, `${task.id} positive samples`);
    assert.ok(spec.validation.logs.some(row => !spec.validation.expected.includes(row.id)), `${task.id} negative samples`);
    const visible = new Set(task.logs.map(row => row.id));
    assert.ok(spec.validation.logs.every(row => !visible.has(row.id)), `${task.id} independent record identities`);
    assert.equal(E.gradeQuery(task.logs, task.explanation.sampleQuery, spec).passed, true, `${task.id} model query`);
    const memorized = spec.expected.map(id => `"${id}"`).join(' OR ');
    const result = E.gradeQuery(task.logs, memorized, spec);
    assert.deepEqual(result.missing, [], `${task.id} enumeration matches visible positives`);
    assert.deepEqual(result.unexpected, [], `${task.id} enumeration matches only visible positives`);
    assert.equal(result.passed, false, `${task.id} enumeration must fail independent validation`);
  }
});

test('public query exercises reject the observed single-word shortcuts while C03 accepts the exact hash field', () => {
  const shortcuts = ['RDP', '"LogonType=10"', 'powershell', 'process:powershell.exe', 'parent:docview.exe', 'user:ops-admin',
    'source:認証', 'source:通信', 'source:端末', 'source:ファイル', 'destination:session-api.example',
    'quarantine', 'original_sha256', 'SHARE-911', 'session:SHARE-911', '"path=/download"',
    'relay-room.example', 'destination:relay-room.example', '"tls=true"', 'sync-agent.exe', 'sync-node.example',
    'normal-', 'event-', 'ops-', 'validation-'];
  for (const task of publicTasks) {
    for (const exercise of [task, task.exit].filter(item => item?.rubric.query)) {
      for (const query of shortcuts) {
        assert.equal(E.gradeQuery(exercise.logs || task.logs, query, exercise.rubric.query).passed, false,
          `${task.id}${exercise === task ? '' : ' exit'} shortcut ${query}`);
      }
    }
  }
  const hashTask = publicTasks.find(task => task.id === 'c03');
  const hash = hashTask.logs.find(row => hashTask.rubric.query.expected.includes(row.id)).hash;
  assert.equal(E.gradeQuery(hashTask.logs, `hash:${hash}`, hashTask.rubric.query).passed, true,
    'an exact indicator lookup is the intended C03 query, not a shortcut');
  assert.equal(E.gradeQuery(hashTask.logs, hash, hashTask.rubric.query).passed, false,
    'the same hash mentioned only in a document must not count as an observed object');
});

function passingDraft(task) {
  const rubric = task.rubric;
  const evidence = [];
  for (const group of rubric.evidenceGroups || []) {
    if (!evidence.some(item => item.id === group.anyOf[0])) evidence.push({id: group.anyOf[0], role: group.role});
  }
  const ownHypothesis = task.modelHypothesis || '比較する仮説';
  const reflection = task.modelReflection || '比較した根拠と判断';
  return {hypothesis: rubric.hypotheses?.[0] || '', targets: rubric.targets || [], sources: rubric.sources || [],
    verdict: rubric.verdict || '', finding: rubric.finding || '', alternative: rubric.alternative || '', from: task.periods.current.from, to: task.periods.current.to,
    evidence, query: task.explanation.sampleQuery || '', ownHypothesis, reviewedHypothesis: ownHypothesis,
    reflection, reviewedReflection: reflection};
}

test('supported conclusions require both the benign comparison activity and its applicable business conditions', () => {
  const comparisons = {
    p01: [['p01-r01', 'p01-r02'], ['p01-r03']],
    p04: [['p04-r01'], ['p04-r02']],
    f01: [['f01-r01'], ['f01-r02']],
    c01: [['event-win-20260915-140506'], ['business-finance-export']],
    d01: [['ops-d01-other'], ['ops-d01-other-plan']],
    l01: [['ops-l01-oneoff-auth'], ['ops-l01-oneoff-plan']]
  };
  assert.deepEqual(tasks.filter(task => task.rubric.verdict === 'supported').map(task => task.id).sort(), Object.keys(comparisons).sort());
  for (const [id, [activity, conditions]] of Object.entries(comparisons)) {
    const task = tasks.find(item => item.id === id);
    const draft = passingDraft(task);
    assert.equal(E.gradeTask(task, draft, task.rubric.operations).passed, true, `${id} comparison-inclusive answer`);
    for (const [kind, accepted] of [['activity', activity], ['conditions', conditions]]) {
      const group = task.rubric.evidenceGroups.find(item => item.role === 'context' && item.anyOf.length && item.anyOf.every(record => accepted.includes(record)));
      assert.ok(group, `${id} required ${kind} comparison group`);
      const reduced = draft.evidence.filter(item => !group.anyOf.includes(item.id));
      assert.equal(E.gradeTask(task, {...draft, evidence: reduced}, task.rubric.operations).passed, false,
        `${id} cannot skip benign ${kind} comparison`);
    }
  }
});
