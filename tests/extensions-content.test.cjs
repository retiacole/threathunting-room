'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyExtensions, translations } = require('../src/content-extensions.cjs');
const foundation = require('../src/content-program.cjs');
const hunts = require('../src/content-hunts.cjs');
const copy = value => JSON.parse(JSON.stringify(value));
const sourceTasks = [
  ...foundation.filter(t => ['a03', 'c03'].includes(t.id)),
  ...hunts.filter(t => ['p01', 'f01', 'f03'].includes(t.id))
];
const tasks = applyExtensions(sourceTasks);
const extension = id => tasks.find(task => task.id === id).extension;
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function strings(value, found = []) {
  if (typeof value === 'string') found.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach(child => strings(child, found));
  return found;
}

test('extensions preserve the task list, original evidence and rubrics, and only clarify the existing C03 finding', () => {
  const input = freeze(copy(sourceTasks)), before = copy(input), result = applyExtensions(input);
  assert.equal(result.length, input.length);
  assert.deepEqual(result.map(t => t.id), input.map(t => t.id));
  assert.deepEqual(input, before, 'applying extensions never mutates the supplied task objects');
  assert.deepEqual(result.filter(t => t.extension).map(t => t.id).sort(), ['a03', 'f01', 'f03']);
  for (const task of result) {
    const original = input.find(t => t.id === task.id);
    const restored = copy(task);
    delete restored.extension;
    if (task.id === 'c03') {
      assert.equal(task.extension, undefined, 'C03 gains no extra exercise');
      assert.equal(task.rubric.finding, 'retained-objects');
      assert.equal(task.rubric.verdict, 'unsubstantiated');
      assert.deepEqual(task.findings.map(f => f.id), original.findings.map(f => f.id));
      const clarified = task.findings.find(f => f.id === 'retained-objects');
      assert.match(clarified.label, /痕跡/);
      assert.match(clarified.label, /実行/);
      assert.match(clarified.label, /一連の活動/);
      restored.findings.find(f => f.id === 'retained-objects').label = original.findings.find(f => f.id === 'retained-objects').label;
    }
    assert.deepEqual(restored, original, task.id + ': all other authored data remains unchanged');
  }
  assert.deepEqual(applyExtensions(result), result, 'reapplying does not duplicate exercises or change answers');
  const another = applyExtensions(input);
  result.find(t => t.id === 'a03').extension.table.rows[0].eventId = 'LOCAL-EDIT';
  assert.equal(another.find(t => t.id === 'a03').extension.table.rows[0].eventId, 'DELAY-01', 'independent applications do not share mutable mini-tables');
});

test('the three mini-exercises each provide two unambiguous questions and a complete independent table', () => {
  for (const id of ['a03', 'f01', 'f03']) {
    const x = extension(id);
    for (const key of ['title', 'intro', 'minutes', 'takeaway']) assert.ok(typeof x[key] === 'string' && x[key].trim(), id + ' ' + key);
    assert.ok(x.table.caption.trim());
    assert.equal(new Set(x.table.columns.map(c => c.key)).size, x.table.columns.length);
    for (const column of x.table.columns) {
      assert.match(column.key, /^[A-Za-z][A-Za-z0-9]*$/);
      assert.ok(column.label.trim());
    }
    const columnKeys = x.table.columns.map(c => c.key).sort();
    for (const row of x.table.rows) {
      assert.deepEqual(Object.keys(row).sort(), columnKeys, id + ': every displayed cell has a declared column');
      for (const value of Object.values(row)) assert.ok(typeof value === 'string' && value.trim());
    }
    assert.equal(x.questions.length, 2);
    assert.equal(new Set(x.questions.map(q => q.id)).size, 2);
    for (const question of x.questions) {
      assert.match(question.id, /^[a-z][a-z0-9]*$/);
      assert.ok(question.prompt.trim() && question.explanation.trim());
      assert.equal(question.options.length, 3);
      assert.equal(new Set(question.options.map(o => o.id)).size, question.options.length);
      assert.equal(question.options.filter(o => o.id === question.answer).length, 1);
      for (const option of question.options) { assert.match(option.id, /^[a-z][a-z0-9]*$/); assert.ok(option.label.trim()); }
    }
    assert.equal(Object.hasOwn(x, 'logs'), false, 'mini-table does not replace the evidence/query dataset');
  }
});

test('every Japanese extension string and the revised finding have English translations', () => {
  const japanese = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
  const relevant = ['a03', 'f01', 'f03'].flatMap(id => strings(extension(id)));
  relevant.push(tasks.find(t => t.id === 'c03').findings.find(f => f.id === 'retained-objects').label);
  for (const text of new Set(relevant.filter(text => japanese.test(text)))) {
    assert.equal(typeof translations[text], 'string', 'missing translation: ' + text);
    assert.ok(translations[text].trim(), text);
    assert.equal(japanese.test(translations[text]), false, 'English translation contains Japanese: ' + text);
  }
});

test('A03 keeps event order separate from ingestion order and from its unrecoverable main-task gap', () => {
  const x = extension('a03'), rows = x.table.rows;
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map(row => row.host)).size, 1);
  assert.equal(rows[0].host, 'LAB-LT-09');
  for (const row of rows) {
    assert.match(row.eventAt, /Z$/); assert.match(row.ingestedAt, /Z$/);
    assert.ok(Date.parse(row.ingestedAt) >= Date.parse(row.eventAt));
  }
  assert.deepEqual([...rows].sort((a, b) => Date.parse(a.eventAt) - Date.parse(b.eventAt)).map(r => r.event), ['process_start', 'network_connection', 'process_exit']);
  assert.deepEqual([...rows].sort((a, b) => Date.parse(a.ingestedAt) - Date.parse(b.ingestedAt)).map(r => r.event), ['network_connection', 'process_exit', 'process_start']);
  const at = Date.parse('2026-10-01T09:05:00Z');
  assert.deepEqual(rows.filter(r => Date.parse(r.ingestedAt) <= at).map(r => r.event), ['network_connection', 'process_exit']);
  assert.deepEqual(x.questions.map(q => q.answer), ['eventorder', 'checkdelivery']);
  assert.match(x.intro, /同期済み.*UTC/);
  assert.match(x.intro, /本編の復元不能な欠測とは関係ありません/);
  assert.match(x.questions[1].explanation, /本編A03の失われた記録が同じように届く.*意味ではありません/);
});

test('F01 has five delivered rows, four original events and two executions without discarding the second execution', () => {
  const x = extension('f01'), rows = x.table.rows;
  assert.equal(rows.length, 5);
  assert.equal(new Set(rows.map(r => r.eventId)).size, 4);
  const groups = new Map();
  for (const row of rows) {
    const key = row.host + '/' + row.executionId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  assert.equal(groups.size, 2);
  for (const group of groups.values()) assert.deepEqual([...new Set(group.map(r => r.event))].sort(), ['network_connection', 'process_start']);
  const replay = rows.filter(r => r.eventId === 'GROUP-02');
  assert.equal(replay.length, 2);
  const { ingestedAt: firstDelivery, ...firstEvent } = replay[0];
  const { ingestedAt: secondDelivery, ...secondEvent } = replay[1];
  assert.deepEqual(firstEvent, secondEvent, 'the replay retains the same original event identity and payload');
  assert.ok(Date.parse(secondDelivery) > Date.parse(firstDelivery));
  assert.deepEqual(x.questions.map(q => q.answer), ['two', 'keepevents']);
  assert.match(x.intro, /同じ端末と同じ実行IDの組を1候補/);
  assert.match(x.questions[1].explanation, /悪性や通信目的は確定しません/);
});

test('F03 proves later-session field correlation, distinguishes denied reads and leaves historical objects unresolved', () => {
  const x = extension('f03'), rows = x.table.rows;
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map(r => r.requestId)).size, 2);
  assert.equal(new Set(rows.map(r => r.session)).size, 1);
  assert.ok(rows.every(r => r.eventAt.startsWith('2026-09-17T') && r.eventAt.endsWith('Z')));
  assert.deepEqual(rows.map(r => [r.classification, r.operation, r.result]), [['public', 'read', 'success'], ['confidential', 'read', 'denied']]);
  assert.ok(rows.every(r => r.objectId && r.requestId && r.session));
  assert.deepEqual(x.questions.map(q => q.answer), ['linkedresults', 'keeplimit']);
  assert.match(x.intro, /本編の9月15日.*未解決のまま/);
  assert.match(x.intro, /保持期間全体や本番の全経路を検証したことにはなりません/);
  assert.match(x.questions[1].explanation, /過去の取得物の証拠にはなりません/);
});
