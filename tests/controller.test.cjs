'use strict';
// Controller/view integration in a minimal DOM stub. This does not test browser
// layout, native downloads, focus behavior, or real DOM selector wiring.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../src/engine.js');
const authoredTasks = [...require('../src/content-intro.cjs'), ...require('../src/content-hunts.cjs')];
const {boot,complete,clone}=require('./support/driver.cjs');

test('all 15 authored tasks can be completed through controller actions and rendered as complete', () => {
  const h=boot();assert.equal(h.tasks.length,15);assert.match(h.elements.app.innerHTML,/入門の6タスク/);
  for(const task of h.tasks) {
    complete(h,task);
    assert.equal(h.state.taskStates[task.id].completed,true,task.id+' must be reachable through the UI controller');
    assert.match(h.elements.app.innerHTML,/このタスクを完了しました/);
    h.click('hint');assert.equal(h.elements.dialog.open,true);h.click('close-dialog');
    h.click('solution');assert.match(h.elements.dialog.innerHTML,/解説・報告例/);h.click('close-dialog');
  }
  h.click('home');assert.match(h.elements.app.innerHTML,/15<span> \/ 15/);
  assert.equal(h.state.schemaVersion,3);
});

test('opening investigation tabs alone never records an operation', () => {
  const h=boot();h.click('start',{id:'i01'});
  for(const tab of ['logs','aggregate','compare','timeline','plan'])h.click('tab',{tab});
  assert.deepEqual(h.state.taskStates.i01.operations,[]);
  h.click('run-aggregate');assert.deepEqual(h.state.taskStates.i01.operations,['aggregate']);
  h.click('run-compare');assert.deepEqual(h.state.taskStates.i01.operations,['aggregate','compare']);
});

function correlatedTasks() {
  const tasks=clone(authoredTasks),base=tasks[0];
  const template={...base.logs.find(log=>log.period==='current'),source:base.sources[0].name,host:'WS-01',pid:42,session:'S-01',process:'agent.exe',parent:'services.exe',request_id:'REQ-01'};
  base.logs=[
    {...template,id:'corr-parent',process_guid:'PROC-A',parent_process_guid:'ROOT'},
    {...template,id:'corr-child',pid:43,process_guid:'PROC-B',parent_process_guid:'proc-a'},
    {...template,id:'corr-prefix',pid:420,session:'S-010',process_guid:'PROC-A2',parent_process_guid:'PROC-A20'},
    {...template,id:'corr-other-host',host:'WS-02',process_guid:'PROC-C',parent_process_guid:'ROOT'}
  ];
  return tasks;
}

test('GUID pivot searches both process and parent GUID through OR without prefix matches', () => {
  const h=boot({tasks:correlatedTasks()});h.click('start',{id:'i01'});
  h.click('pivot',{field:'process_guid',value:'PROC-A'});
  assert.equal(h.rendered.ui.filters.query,'process_guid:"PROC-A" OR parent_process_guid:"PROC-A"');
  assert.equal(h.rendered.ui.filters.period,'all');
  assert.deepEqual(E.filterLogs(h.tasks[0].logs,h.rendered.ui.filters).map(l=>l.id),['corr-parent','corr-child']);
  h.click('pivot',{field:'parent_process_guid',value:'PROC-A'});
  assert.deepEqual(E.filterLogs(h.tasks[0].logs,h.rendered.ui.filters).map(l=>l.id),['corr-parent','corr-child']);
  assert.ok(h.state.taskStates.i01.operations.includes('pivot'));
});

test('PID and session chips bind the exact host filter and use exact identifier matching', () => {
  const h=boot({tasks:correlatedTasks()});h.click('start',{id:'i01'});
  h.click('pivot',{field:'pid',value:'42',host:'WS-01'});
  assert.equal(h.rendered.ui.filters.host,'WS-01');
  assert.deepEqual(E.filterLogs(h.tasks[0].logs,h.rendered.ui.filters).map(l=>l.id),['corr-parent']);
  h.click('pivot',{field:'session',value:'S-01',host:'WS-01'});
  assert.deepEqual(E.filterLogs(h.tasks[0].logs,h.rendered.ui.filters).map(l=>l.id),['corr-parent','corr-child']);
  h.click('search-help');assert.match(h.elements.dialog.innerHTML,/同一番号だけで関連付けない/);
});

test('learner hypothesis persists and is escaped in model comparison, solution, and report views', () => {
  const tasks=clone(authoredTasks),field=tasks.find(t=>t.id==='f01');
  field.hypothesisPrompt='何を検証するか、自分の言葉で書きましょう。';field.modelHypothesis='端末の親子プロセスと通信を確かめる。';
  const h=boot({tasks});h.click('start',{id:'f01'});
  assert.equal(h.rendered.ui.tab,'plan');assert.match(h.elements.app.innerHTML,/data-draft="ownHypothesis"/);
  h.click('compare-hypothesis');assert.equal(h.elements.dialog.open,false);assert.match(h.elements.toast.textContent,/先に/);
  const own='<img src=x onerror=alert(1)>\n環境全体に同じ活動があるか確かめる。';
  h.input('[data-draft]',{draft:'ownHypothesis'},own);
  assert.equal(h.state.taskStates.f01.draft.ownHypothesis,own);
  h.click('compare-hypothesis');assert.match(h.elements.dialog.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(h.elements.dialog.innerHTML,/<img src=x/);
  assert.match(h.elements.dialog.innerHTML,/端末の親子プロセスと通信を確かめる/);
  h.click('close-dialog');h.click('solution');assert.doesNotMatch(h.elements.dialog.innerHTML,/<img src=x/);h.click('close-dialog');
  h.click('report-tab',{tab:'answers'});assert.match(h.elements.app.innerHTML,/&lt;img src=x/);
  h.input('[data-draft]',{draft:'ownHypothesis'},'仮'.repeat(4001));assert.equal(h.state.taskStates.f01.draft.ownHypothesis.length,4000);
});

test('CSV export contains correlation columns and protects spreadsheet formula cells', async () => {
  const tasks=correlatedTasks();tasks[0].logs[0].detail='=HYPERLINK("https://invalid.example")';
  const h=boot({tasks});h.click('start',{id:'i01'});h.click('export-logs');
  const download=h.downloads.at(-1),csv=await download.blob.text();
  assert.match(download.filename,/-logs\.csv$/);
  assert.match(csv.split('\r\n')[0],/parent,session,pid,process_guid,parent_process_guid,request_id,device_id,hash,raw,bytes/);
  assert.match(csv,/'=HYPERLINK/);assert.match(csv,/PROC-A/);assert.match(csv,/REQ-01/);
  assert.equal(csv.split('\r\n').length,5);
});

function blankLegacyTask(task) {
  return {draft:{hypothesis:'',targets:[],sources:[],verdict:'',finding:'',from:task.periods.current.from,to:task.periods.current.to,evidence:[],summary:'旧版の調査メモ'},operations:[],completed:true,hintLevel:0,guideStep:0};
}

test('v1 stored progress is migrated with a visible notice and exported as schema3', async () => {
  const first=authoredTasks[0],old={schemaVersion:1,taskStates:{[first.id]:blankLegacyTask(first)},lastTask:first.id};
  const h=boot({stored:old,hash:'#'+first.id});
  assert.match(h.elements.app.innerHTML,/旧版の記録ID・選択肢を対応づけ/);
  assert.match(h.elements.app.innerHTML,/保存した検索式やメモの時刻も見直し/);
  assert.equal(h.state.schemaVersion,3);assert.equal(h.state.taskStates[first.id].completed,false);
  assert.equal(h.state.taskStates[first.id].draft.summary,'旧版の調査メモ');
  h.click('export');const file=JSON.parse(await h.downloads.at(-1).blob.text());
  assert.equal(file.schemaVersion,3);assert.equal(file.migrated,undefined);assert.equal(file.taskStates[first.id].draft.ownHypothesis,'');
});

test('JSON v1 import needs confirmation, merges tasks, and invalid imports preserve existing state', async () => {
  const h=boot();h.click('start',{id:'i01'});h.input('[data-draft]',{draft:'summary'},'今のメモ');
  const second=authoredTasks[1],old={schemaVersion:1,taskStates:{[second.id]:blankLegacyTask(second)},lastTask:second.id};
  await h.importFile(old,'<script>progress</script>.json');
  assert.match(h.elements.dialog.innerHTML,/旧版の記録ID・選択肢を対応づけ/);assert.match(h.elements.dialog.innerHTML,/保存した検索式・自由記述の時刻は自動変換しない/);assert.match(h.elements.dialog.innerHTML,/&lt;script&gt;progress/);
  assert.equal(h.state.taskStates[second.id],undefined,'reading does not apply progress before confirmation');
  h.click('confirm-import');assert.equal(h.state.schemaVersion,3);assert.equal(h.state.taskStates.i01.draft.summary,'今のメモ');
  assert.equal(h.state.taskStates[second.id].draft.summary,'旧版の調査メモ');assert.match(h.elements.toast.textContent,/旧版の進捗/);
  const before=h.state;await h.importFile('{broken');assert.deepEqual(h.state,before);assert.match(h.elements.dialog.innerHTML,/現在の進捗は変更していません/);
});

test('invalid OR does not record search or aggregation, and unrelated evidence fails in the UI result', () => {
  const h=boot();h.click('start',{id:'i01'});h.search('host:x OR');assert.deepEqual(h.state.taskStates.i01.operations,[]);
  assert.match(h.elements.app.innerHTML,/ORの前後には検索条件が必要/);
  h.click('run-aggregate');assert.deepEqual(h.state.taskStates.i01.operations,[]);
  complete(h,h.tasks[0]);
  const allowed=new Set([...(h.tasks[0].rubric.evidenceGroups || []).flatMap(g=>g.anyOf),...(h.tasks[0].rubric.evidenceExtras || []).map(e=>e.id)]);
  const unrelated=h.tasks[0].logs.find(l=>!allowed.has(l.id));assert.ok(unrelated);
  h.click('add-evidence',{id:unrelated.id});h.click('grade');
  assert.equal(h.state.taskStates.i01.completed,false);assert.match(h.elements.app.innerHTML,new RegExp(unrelated.id));
  assert.equal(h.rendered.ui.grade.criteria.find(c=>c.id==='evidence-precision').passed,false);
});

test('storage failure retains in-memory work and still allows JSON export', async () => {
  const h=boot({storageError:true});h.click('start',{id:'i01'});h.input('[data-draft]',{draft:'summary'},'保存先がなくても保持');h.click('export');
  const file=JSON.parse(await h.downloads.at(-1).blob.text());assert.equal(file.taskStates.i01.draft.summary,'保存先がなくても保持');
  assert.match(h.elements.app.innerHTML,/自動保存できません/);
});
