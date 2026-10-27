'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../src/engine.js'),{tasks,environments}=require('../src/catalog.cjs');
const {boot,clone,complete}=require('./support/driver.cjs');
const {createPublicBundle}=require('../src/public-data.cjs');
const R=require('../src/reports.js');
const scope={window:{THEngine:E}};
vm.runInNewContext(fs.readFileSync(require.resolve('../src/views.js'),'utf8'),scope);
const V=scope.window.THView;

test('JST labels cross month and year boundaries and preserve fractions without changing UTC',()=>{
 const value=V.timeMarkup('2026-12-31T23:52:13.250Z','utc-jst');
 assert.match(value,/2026-12-31 23:52:13.250 UTC/);
 assert.match(value,/2027-01-01 08:52:13.250 JST \(\+09:00\)/);
 assert.match(value,/datetime="2026-12-31T23:52:13.250Z"/);
 assert.doesNotMatch(V.timeMarkup('2026-12-31T23:52:13.250Z','utc'),/JST/);
 assert.match(V.periodJST({from:'2026-09-30',to:'2026-09-30'},'utc-jst'),/2026-09-30 09:00 ～ 2026-10-01 09:00 未満/);
 assert.match(V.periodJST({from:'2026-09-14',to:'2026-09-16',timezone:'Asia/Tokyo'},'utc'),/UTC: 2026-09-13 15:00 ～ 2026-09-16 15:00 未満/);
 assert.equal(V.periodJST({from:'invalid',to:'invalid'},'utc-jst'),'');
 assert.equal(V.timeMarkup('<img src=x>','utc-jst'),'&lt;img src=x&gt;');
});

test('Aonagi date controls use Japanese days, preserve UTC syntax, and retain the selected zone on reload',()=>{
 const t=clone(tasks.find(t=>t.id==='c05'));
 t.periods.current.timezone='Asia/Tokyo';
 const sample=t.logs[0];
 t.logs=[
  {...sample,id:'before-jst',period:'current',at:'2026-09-14T14:59:59Z'},
  {...sample,id:'start-jst',period:'current',at:'2026-09-14T15:00:00Z'},
  {...sample,id:'end-jst',period:'current',at:'2026-09-15T14:59:59Z'},
  {...sample,id:'next-jst',period:'current',at:'2026-09-15T15:00:00Z'}
 ];
 const h=boot({tasks:[t],hash:'#c05'});h.click('tab',{tab:'logs'});
 assert.equal(h.rendered.ui.filters.timezone,'Asia/Tokyo');
 assert.match(h.elements.app.innerHTML,/開始日（JST）/);
 const dates={from:{value:'2026-09-15'},to:{value:'2026-09-15'}};
 h.elements.app.querySelector=s=>s.includes('"from"')?dates.from:s.includes('"to"')?dates.to:null;
 h.click('apply-date');
 const ids=()=>E.filterLogs(t.logs,h.rendered.ui.filters).map(l=>l.id);
 assert.deepEqual(ids(),['start-jst','end-jst']);
 h.search('after:2026-09-15 before:2026-09-15');
 assert.deepEqual(ids(),['end-jst'],'UTC query predicates intersect with the JST day filter');
 h.search('');h.change('[data-filter]',{filter:'timezone'},'UTC');
 assert.deepEqual(ids(),['end-jst','next-jst']);
 assert.match(h.elements.app.innerHTML,/開始日（UTC）/);
 const reload=boot({tasks:[t],stored:h.state,hash:'#c05'});
 assert.equal(reload.rendered.ui.filters.timezone,'UTC');
 reload.click('clear-filters');assert.equal(reload.rendered.ui.filters.timezone,'Asia/Tokyo');
});

test('sensor pivots, grouping and CSV preserve the observation source',async()=>{
 const t=tasks.find(t=>t.id==='c05'),h=boot({tasks:[t],hash:'#c05'});
 h.click('pivot',{field:'sensor',value:'edge-flow'});
 assert.equal(h.rendered.ui.filters.query,'sensor:"edge-flow"');
 const found=E.filterLogs(t.logs,h.rendered.ui.filters);
 assert.ok(found.length>0);assert.ok(found.every(l=>l.sensor==='edge-flow'));
 h.click('tab',{tab:'aggregate'});h.change('',{},'sensor',true,'aggregate-field');h.click('run-aggregate');
 assert.match(h.elements.app.innerHTML,/<th>センサー<\/th>/);
 h.click('export-logs');const csv=await h.downloads.at(-1).blob.text();
 assert.match(csv,/source,sensor,host/);assert.match(csv,/"edge-flow"/);
 h.click('search-help');assert.match(h.elements.dialog.innerHTML,/sensor:edge-flow/);
});

test('time display persists but does not change search membership, evidence or UTC CSV values',async()=>{
 const task=clone(tasks.find(t=>t.id==='i01')),example=task.logs.find(l=>l.period==='current');
 task.logs=[{...example,id:'late-event',at:'2026-09-14T23:52:13Z'},{...example,id:'following-event',at:'2026-09-15T00:01:00Z'}];
 const h=boot({tasks:[task],hash:'#i01'});h.search('after:2026-09-14 before:2026-09-14');h.click('add-evidence',{id:'late-event'});
 const before=h.state.taskStates.i01;
 h.click('toggle-time');
 assert.equal(h.state.timeDisplay,'utc-jst');
 assert.deepEqual(h.state.taskStates.i01,before);
 assert.match(h.elements.app.innerHTML,/2026-09-15 08:52:13 JST/);
 assert.doesNotMatch(h.elements.app.innerHTML,/data-id="following-event"/);
 h.click('log-detail',{id:'late-event'});assert.match(h.elements.dialog.innerHTML,/2026-09-15 08:52:13 JST/);h.click('close-dialog');
 h.click('export-logs');const csv=await h.downloads.at(-1).blob.text();
 assert.match(csv,/2026-09-14T23:52:13Z/);assert.doesNotMatch(csv,/08:52:13|following-event/);
 const reload=boot({tasks:[task],stored:h.state,hash:'#i01'});assert.equal(reload.rendered.ui.timeDisplay,'utc-jst');
 const imported=boot({tasks:[task],hash:'#i01'});await imported.importFile(h.state);imported.click('confirm-import');
 assert.equal(imported.rendered.ui.timeDisplay,'utc-jst');
});

test('supported decisions persist the rejected benign explanation and require it again after removal',async()=>{
 const h=boot({tasks,bundle:createPublicBundle({tasks,environments})});
 for(const id of ['p01','p04','f01','c01','d01','l01']){
  const task=h.rendered.tasks.find(t=>t.id===id);assert.ok(task.rubric.alternative,id);
  complete(h,task);assert.equal(h.state.taskStates[id].completed,true,id);
  h.click('report-tab',{tab:'answers'});assert.match(h.elements.app.innerHTML,/良性の説明を検討した結果/);
  const expected=task.alternativeExplanations.find(a=>a.id===task.rubric.alternative).label;
  assert.ok(R.record(task,h.state.taskStates[id]).includes('良性の説明を検討した結果：'+expected));
  h.change('[data-draft]',{draft:'alternative'},'');h.click('grade');
  assert.equal(h.state.taskStates[id].completed,false,id+' cannot omit the judgment');
 }
});

test('help explains OR-local dates and snapshots explain task-specific record counts',()=>{
 const h=boot({tasks,bundle:createPublicBundle({tasks,environments})});h.click('start',{id:'c01'});
 assert.match(h.elements.app.innerHTML,/別の課題とは件数が異なります/);
 h.click('search-help');assert.match(h.elements.dialog.innerHTML,/固定範囲より狭い日/);
 assert.match(h.elements.dialog.innerHTML,/destination:alpha.example OR after:2026-09-15 before:2026-09-15/);
 assert.match(h.elements.dialog.innerHTML,/JST併記をオンにしても検索式の日付条件はUTC/);
});

test('changing time display preserves unsubmitted search text and pending date input',()=>{
 const h=boot({tasks,hash:'#i01'});h.search('source:通信');
 const before=h.state.taskStates.i01.filters;
 h.elements.query.value='process:unfinished OR';
 const from={value:'2026-09-15'},to={value:'2026-09-16'};
 h.elements.app.querySelector=selector=>selector==='[data-filter-date="from"]'?from:selector==='[data-filter-date="to"]'?to:null;
 h.click('toggle-time');
 assert.equal(h.elements.query.value,'process:unfinished OR');
 assert.equal(from.value,'2026-09-15');assert.equal(to.value,'2026-09-16');
 assert.deepEqual(h.state.taskStates.i01.filters,before);
});

test('applying dates or switching their zone retains an unfinished search without applying it',()=>{
 const h=boot({tasks,hash:'#c05'});h.click('tab',{tab:'logs'});h.search('source:通信');
 const from={value:'2026-09-15'},to={value:'2026-09-15'};
 h.elements.app.querySelector=s=>s.includes('"from"')?from:s.includes('"to"')?to:null;
 h.elements.query.value='sensor:edge-flow OR';
 h.click('apply-date');
 assert.equal(h.elements.query.value,'sensor:edge-flow OR');
 assert.equal(h.state.taskStates.c05.filters.query,'source:通信');
 from.value='2026-09-14';
 h.change('[data-filter]',{filter:'timezone'},'UTC');
 assert.equal(h.elements.query.value,'sensor:edge-flow OR');assert.equal(from.value,'2026-09-14');
 assert.equal(h.state.taskStates.c05.filters.from,'2026-09-15','pending date is not applied by changing the zone');
});

test('reports preserve fixed query scopes separately from investigation and exploration scopes',()=>{
 for(const id of ['c04','c05']){
  const task=tasks.find(t=>t.id===id),draft={from:'2026-09-14',to:'2026-09-16',query:task.explanation.sampleQuery};
  const report=R.record(task,{draft,filters:{period:'all'}});
  const querySection=report.split('4. 検索条件\n')[1].split('5. 結果\n')[0];
  assert.match(report,/調査期間（JST）：2026-09-14 ～ 2026-09-16/);
  assert.match(querySection,/提出式の固定評価範囲（JST）：.*開始 2026-09-15.*終了 2026-09-15/);
  assert.match(querySection,/別評価の固定範囲（JST）：.*開始 2026-09-15.*終了 2026-09-15/);
 }
 const t=clone(tasks.find(t=>t.id==='c01'));t.rubric.query.validation.filters={source:'通信'};
 const report=R.record(t,{});assert.match(report,/別評価の固定範囲（JST）：今回の期間 \/ 通信.*開始 2026-09-14.*終了 2026-09-16/);
 const h=boot({tasks:[t],hash:'#c01'});h.click('report-tab',{tab:'answers'});
 assert.match(h.elements.app.innerHTML,/別評価の範囲：今回の期間 \/ 通信.*開始 2026-09-14 JST.*終了 2026-09-16 JST/);
});

test('reports distinguish JST corpus dates from optional UTC exploration bounds',()=>{
 const t=tasks.find(t=>t.id==='g02');
 const report=R.record(t,{filters:{period:'all',from:'2026-09-14',to:'2026-09-14',timezone:'UTC'}});
 assert.match(report,/収録期間（JST）：比較用 2026-09-07 ～ 2026-09-09、今回 2026-09-14 ～ 2026-09-16/);
 assert.match(report,/探索の日付範囲（UTC）：2026-09-14 ～ 2026-09-14（当日を含む）/);
 assert.doesNotMatch(report,/調査期間（UTC）/);
 const oneSided=R.record(t,{filters:{period:'current',from:'2026-09-15',timezone:'UTC'}});
 assert.match(oneSided,/探索の日付範囲（UTC）：2026-09-15 ～ 終了制限なし/);
 assert.match(oneSided,/収録期間（JST）：2026-09-14 ～ 2026-09-16/);
});
