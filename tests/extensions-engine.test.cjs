'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');

const extension = {
  title: '追加の判断', intro: '資料を照合して判断する。', minutes: '3–5',
  table: {caption: '判断資料', columns: [{key: 'event', label: '出来事'}], rows: [{event: '入力待ち'}]},
  questions: [
    {id: 'dedup', prompt: '同じ記録の再送をどう扱うか', options: [{id: 'event-key', label: 'イベント識別子で照合'}, {id: 'host-only', label: '端末全体を除外'}], answer: 'event-key', explanation: '別実行を消さない。'},
    {id: 'missing', prompt: '必須項目がないときの判断', options: [{id: 'wait', label: '観測不足を残す'}, {id: 'safe', label: '活動なしとする'}], answer: 'wait', explanation: '欠測と活動なしを区別する。'}
  ], takeaway: '観測した範囲で判断する。'
};
const task = {
  id: 'fixture', logs: [], assets: [], sources: [], hypotheses: [], findings: [], guide: [],
  choices: [{id: 'bounded', label: '範囲を限定'}, {id: 'broad', label: '全体へ拡張'}],
  rubric: {choice: 'bounded'}, extension
};
const withExit = {...task, exit: {title: '成果物', choices: [{id: 'handoff', label: '担当へ渡す'}, {id: 'discard', label: '破棄する'}], rubric: {choice: 'handoff'}}};
const correct = () => ({dedup: 'event-key', missing: 'wait'});
const state = patch => ({draft: {choice: 'bounded', summary: '既存の調査メモ'}, operations: [], completed: true, exitDraft: {choice: 'handoff', summary: '既存の成果物メモ'}, exitCompleted: true, ...patch});
const progress = (saved, version = 3) => ({schemaVersion: version, taskStates: {fixture: saved}, lastTask: 'fixture'});
const restore = (saved, item = withExit, version = 3) => E.validateProgress(progress(saved, version), [item]).taskStates.fixture;
const clone = value => JSON.parse(JSON.stringify(value));

test('extension decisions are graded independently and expose per-question results', () => {
  const answers = correct(), before = clone(answers);
  assert.deepEqual(E.gradeExtension(task, answers), {passed: true, earned: 2, total: 2, criteria: [{id: 'dedup', passed: true}, {id: 'missing', passed: true}]});
  assert.deepEqual(answers, before, 'grading does not mutate learner answers');
  const wrong = E.gradeExtension(task, {...answers, missing: 'safe'});
  assert.equal(wrong.passed, false);
  assert.equal(wrong.earned, 1);
  assert.deepEqual(wrong.criteria, [{id: 'dedup', passed: true}, {id: 'missing', passed: false}]);
  assert.equal(E.gradeExtension(task, {dedup: 'event-key'}).earned, 1);
  assert.equal(E.gradeExtension(task, {dedup: 'event-key', missing: ''}).passed, false);
  assert.equal(E.gradeTask(task, {choice: 'bounded'}, []).passed, true, 'unanswered extensions never gate the investigation');
  assert.equal(E.gradeExit(withExit, {choice: 'handoff'}).passed, true, 'unanswered extensions never gate the exit');
});

test('missing, malformed and unknown extension answers cannot pass', () => {
  for (const answers of [undefined, null, true, 5, 'answers', [], {}, {dedup: 'event-key', missing: 'unknown'}, {...correct(), extra: 'wait'}, {...correct(), missing: 1}, {...correct(), missing: 'wait\u0000'}, Object.create(correct())]) {
    assert.equal(E.gradeExtension(task, answers).passed, false);
  }
  assert.equal(E.gradeExtension(task, Object.assign(Object.create(null), correct())).passed, true, 'JSON-compatible dictionaries are accepted');
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const answers = JSON.parse(JSON.stringify(correct()).slice(0, -1) + ',"' + key + '":"wait"}');
    assert.equal(E.gradeExtension(task, answers).passed, false);
  }
});

test('absent or malformed exercise definitions never yield a vacuous completion', () => {
  for (const item of [{}, {...task, extension: undefined}, {...task, extension: {questions: []}}, {...task, extension: {questions: [extension.questions[0], extension.questions[0]]}}, {...task, extension: {questions: [{...extension.questions[0], answer: 'unknown'}]}}, {...task, extension: {questions: [{...extension.questions[0], options: [{id: 'event-key'}, {id: 'event-key'}]}]}}]) {
    assert.deepEqual(E.gradeExtension(item, correct()), {passed: false, earned: 0, total: 0, criteria: []});
  }
});

test('old v1, v2 and v3 completions retain investigations, exits and notes without extension answers', () => {
  for (const version of [1, 2, 3]) {
    const saved = restore(state(), withExit, version);
    assert.equal(saved.completed, true);
    assert.equal(saved.exitCompleted, true);
    assert.equal(saved.draft.summary, '既存の調査メモ');
    assert.equal(saved.exitDraft.summary, '既存の成果物メモ');
    assert.deepEqual(saved.extensionAnswers, {});
    assert.equal(saved.extensionCompleted, false);
  }
});

test('extension completion is recomputed, never trusted from saved booleans', () => {
  for (const extensionCompleted of [true, false, 'true', 1, {}, null]) {
    assert.equal(restore(state({extensionCompleted})).extensionCompleted, false);
    assert.equal(restore(state({extensionAnswers: correct(), extensionCompleted})).extensionCompleted, true);
    assert.equal(restore(state({extensionAnswers: {...correct(), missing: 'safe'}, extensionCompleted})).extensionCompleted, false);
  }
});

test('saved extension answers survive JSON round trips and retain schema3', () => {
  const input = progress(state({extensionAnswers: correct(), extensionCompleted: false}));
  const before = clone(input), first = E.validateProgress(input, [withExit]);
  assert.equal(first.schemaVersion, 3);
  assert.deepEqual(first.taskStates.fixture.extensionAnswers, correct());
  assert.equal(first.taskStates.fixture.extensionCompleted, true);
  assert.deepEqual(E.validateProgress(clone(first), [withExit]), first);
  assert.deepEqual(input, before, 'normalization leaves imported data untouched');
});

test('investigation and exit prerequisites gate only extension completion, retaining answers', () => {
  const failedMain = restore(state({draft: {choice: 'broad'}, extensionAnswers: correct(), extensionCompleted: true}));
  assert.equal(failedMain.completed, false);
  assert.equal(failedMain.exitCompleted, false);
  assert.equal(failedMain.extensionCompleted, false);
  assert.deepEqual(failedMain.extensionAnswers, correct());
  const failedExit = restore(state({exitDraft: {choice: 'discard'}, extensionAnswers: correct(), extensionCompleted: true}));
  assert.equal(failedExit.completed, true);
  assert.equal(failedExit.exitCompleted, false);
  assert.equal(failedExit.extensionCompleted, false);
  assert.deepEqual(failedExit.extensionAnswers, correct());
  const noExit = restore(state({exitDraft: {}, extensionAnswers: correct()}), task);
  assert.equal(noExit.completed, true);
  assert.equal(noExit.exitCompleted, false);
  assert.equal(noExit.extensionCompleted, true, 'tasks without exits need only the main completion');
});

test('editing a saved extension answer clears only its completion and permits correction', () => {
  const saved = restore(state({extensionAnswers: correct()}));
  saved.extensionAnswers.missing = 'safe';
  const changed = restore(saved);
  assert.equal(changed.completed, true);
  assert.equal(changed.exitCompleted, true);
  assert.equal(changed.extensionCompleted, false);
  changed.extensionAnswers.missing = 'wait';
  assert.equal(restore(changed).extensionCompleted, true);
  delete changed.extensionAnswers.dedup;
  assert.equal(restore(changed).extensionCompleted, false);
});

test('empty maps and blank options remain unanswered without losing prior completions', () => {
  for (const extensionAnswers of [undefined, null, {}, {dedup: ''}]) {
    const saved = restore(state({extensionAnswers}));
    assert.deepEqual(saved.extensionAnswers, {});
    assert.equal(saved.extensionCompleted, false);
    assert.equal(saved.completed, true);
    assert.equal(saved.exitCompleted, true);
  }
  const plainTask = {...task, extension: undefined};
  const saved = restore(state({exitDraft: {}, extensionCompleted: true}), plainTask);
  assert.equal(saved.completed, true);
  assert.equal(saved.extensionCompleted, false);
});

test('import rejects unknown questions/options, dangerous keys, invalid types and excessive input', () => {
  const invalid = [[], false, 2, 'answer', {unknown: 'wait'}, {...correct(), missing: 'unknown'}, {...correct(), missing: null}, {...correct(), missing: {}}, {...correct(), missing: ['wait']}, {...correct(), missing: 'x'.repeat(201)}, {...correct(), missing: 'wait\u0000'}, Object.fromEntries(Array.from({length: 101}, (_, i) => ['question-' + i, 'wait']))];
  for (const key of ['__proto__', 'constructor', 'prototype']) invalid.push(JSON.parse('{"' + key + '":"wait"}'));
  for (const extensionAnswers of invalid) assert.throws(() => restore(state({extensionAnswers})), /進捗ファイルを読み込めません/);
  assert.throws(() => restore(state({exitDraft: {}, extensionAnswers: correct()}), {...task, extension: undefined}), /追加体験/);
  const huge = progress(state({extensionAnswers: {dedup: 'x'.repeat(4000000)}}));
  assert.throws(() => E.validateProgress(huge, [withExit]), /上限4MB/);
  assert.equal({}.polluted, undefined);
});

test('existing C03 answers and the 38-task main catalog remain independent of extensions', () => {
  const {tasks} = require('../src/catalog.cjs');
  assert.equal(tasks.filter(item => item.id !== 'tutorial' && !item.optional).length, 38);
  const item = tasks.find(item => item.id === 'c03'), rubric = item.rubric;
  assert.equal(rubric.finding, 'retained-objects');
  assert.equal(rubric.verdict, 'unsubstantiated');
  assert.deepEqual(rubric.query.expected, ['event-file-20260915-071211', 'event-file-20260915-071217']);
  const draft = {targets: rubric.targets, sources: rubric.sources, verdict: rubric.verdict, finding: rubric.finding,
    from: item.periods.current.from, to: item.periods.current.to, query: item.explanation.sampleQuery,
    ownHypothesis: item.modelHypothesis, reviewedHypothesis: item.modelHypothesis,
    evidence: rubric.evidenceGroups.map(group => ({id: group.anyOf[0], role: group.role}))};
  const result = E.gradeTask(item, draft, rubric.operations);
  assert.equal(result.passed, true);
  assert.deepEqual(E.gradeTask({...item, extension}, draft, rubric.operations), result);
  const restored = E.validateProgress({schemaVersion: 3, taskStates: {c03: {draft, operations: rubric.operations}}, lastTask: 'c03'}, [{...item, extension}]).taskStates.c03;
  assert.equal(restored.completed, true);
  assert.equal(restored.extensionCompleted, false);
});
