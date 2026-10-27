'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {boot,complete,completeExit,clone}=require('./support/driver.cjs');
const {tasks,environments}=require('../src/catalog.cjs');const E=require('../src/engine.js');const R=require('../src/reports.js');

test('all 38 main tasks and 9 exits are reachable through real controller actions',()=>{
 const h=boot({tasks});assert.equal(h.rendered.ui.task,'tutorial');
 for(const t of tasks.filter(t=>t.id!=='tutorial')){
  complete(h,t);assert.equal(h.state.taskStates[t.id].completed,true,t.id+': '+JSON.stringify(h.rendered.ui.grade));
  if(t.exit){assert.equal(h.state.taskStates[t.id].exitCompleted,false);completeExit(h,t);assert.equal(h.state.taskStates[t.id].exitCompleted,true,t.id+': '+JSON.stringify(h.rendered.ui.exitGrade));}
 }
 h.click('home');h.click('part',{part:'2'});assert.match(h.elements.app.innerHTML,/38<span> \/ 38/);assert.match(h.elements.app.innerHTML,/追加ステップ：9 \/ 9/);
 const restored=boot({tasks,stored:h.state,hash:'#g02'});assert.equal(Object.values(restored.state.taskStates).filter(s=>s.completed).length,38);assert.equal(Object.values(restored.state.taskStates).filter(s=>s.exitCompleted).length,9);
});
test('every program panel and answer form renders without unresolved content',()=>{
 const h=boot({tasks});
 for(const t of tasks.filter(t=>t.part===2)){
  h.click('start',{id:t.id});for(const tab of ['plan','logs','aggregate','compare','timeline']){h.click('tab',{tab});assert.doesNotMatch(h.elements.app.innerHTML,/undefined|NaN/,t.id+' '+tab);}
  h.click('report-tab',{tab:'answers'});assert.doesNotMatch(h.elements.app.innerHTML,/undefined|NaN/,t.id+' answers');
 }
});
test('asset registry pivots use actual stable device IDs, including an empty result for unobserved assets',()=>{
 const h=boot({tasks});h.click('start',{id:'a01'});const env=Object.values(environments)[0],asset=env.assets.find(a=>env.logs.some(l=>l.device_id===a.device_id&&l.source==='端末'));
 assert.ok(h.elements.app.innerHTML.includes('data-value="'+asset.device_id+'"'));h.click('pivot',{field:'device_id',value:asset.device_id});assert.ok(E.filterLogs(tasks.find(t=>t.id==='a01').logs,h.rendered.ui.filters).length>0);
 h.click('report-tab',{tab:'answers'});for(const a of env.assets)assert.ok(h.elements.app.innerHTML.includes(a.host));
});
test('query results and self-comparison confirmation disappear immediately when their inputs change',()=>{
 const h=boot({tasks});const c=tasks.find(t=>t.id==='c01');h.click('start',{id:c.id});h.click('report-tab',{tab:'answers'});h.input('[data-draft]',{draft:'query'},c.explanation.sampleQuery);h.click('test-query');assert.ok(h.rendered.ui.queryResult.passed);
 h.input('[data-draft]',{draft:'query'},'process:absent');assert.equal(h.rendered.ui.queryResult,null);assert.doesNotMatch(h.elements.app.innerHTML,/適合率 100%/);
 const b=tasks.find(t=>t.id==='b01');h.click('start',{id:b.id});h.input('[data-draft]',{draft:'reflection'},b.modelReflection);h.click('compare-reflection');h.click('confirm-comparison',{kind:'reflection'});assert.match(h.elements.app.innerHTML,/比較したことを記録済み/);
 h.input('[data-draft]',{draft:'reflection'},'別の観察');assert.equal(h.state.taskStates.b01.draft.reviewedReflection,'');assert.doesNotMatch(h.elements.app.innerHTML,/比較したことを記録済み/);
});
test('submitted queries survive navigation independently of exploratory filters and use fixed grading scope',()=>{
 const h=boot({tasks}),t=tasks.find(t=>t.id==='c01');h.click('start',{id:t.id});h.input('[data-draft]',{draft:'query'},t.explanation.sampleQuery);h.search('device_id:missing');h.change('[data-filter]',{filter:'period'},'baseline');h.click('test-query');assert.equal(h.rendered.ui.queryResult.passed,true);
 h.click('start',{id:'a01'});h.click('start',{id:t.id});assert.equal(h.state.taskStates.c01.draft.query,t.explanation.sampleQuery);assert.equal(h.rendered.ui.filters.query,'device_id:missing');assert.equal(h.rendered.ui.filters.period,'baseline');
});
test('importing the active task does not replace imported filters with current screen filters',async()=>{
 const h=boot({tasks});h.click('start',{id:'c01'});h.search('process:old-screen');const incoming=clone(h.state);incoming.taskStates.c01.filters.query='parent:imported-parent';incoming.activeTask='c01';
 await h.importFile(incoming);h.click('confirm-import');assert.equal(h.rendered.ui.filters.query,'parent:imported-parent');assert.equal(h.state.taskStates.c01.filters.query,'parent:imported-parent');
});
test('an old paused tutorial does not hijack normal progress JSON import',async()=>{
 const h=boot({tasks});h.click('guide-next');h.click('start',{id:'c01'});h.input('[data-draft]',{draft:'summary'},'通常の調査');const normalSave=h.state;
 const other=boot({tasks});await other.importFile(normalSave);other.click('confirm-import');assert.equal(other.rendered.ui.task,'c01');assert.equal(other.state.taskStates.tutorial.guideStep,1);
});
test('baseline exercise begins in the baseline and parent/child aggregation exposes composite pivots',()=>{
 const h=boot({tasks});h.click('start',{id:'b01'});assert.equal(h.rendered.ui.filters.period,'baseline');h.click('start',{id:'b02'});h.change('[data-filter]',{filter:'source'},'端末');h.change('',{},'parent_process',true,'aggregate-field');h.change('',{},'count-asc',true,'aggregate-sort');h.click('tab',{tab:'aggregate'});h.click('run-aggregate');assert.match(h.elements.app.innerHTML,/data-parent=/);
 h.click('pivot',{field:'parent_process',value:'docview.exe → powershell.exe',parent:'docview.exe',process:'powershell.exe'});assert.equal(h.rendered.ui.filters.query,'parent:"docview.exe" process:"powershell.exe"');
});
test('hunt record and first-hunt plan include learner work, seven sections and incomplete markers',async()=>{
 const h=boot({tasks}),t=tasks.find(t=>t.id==='c01');complete(h,t);h.click('export-report');const report=await h.downloads.at(-1).blob.text();for(const title of ['仮説','起点','使ったログ','検索条件','結果','限界','次の行動'])assert.ok(report.includes(title));assert.ok(report.includes(t.explanation.sampleQuery));assert.ok(report.includes(t.modelHypothesis));
 h.click('export-plan');const plan=await h.downloads.at(-1).blob.text();assert.ok(plan.includes('可視性の棚卸し'));assert.ok(plan.includes(t.modelHypothesis));assert.match(plan,/未完了/);assert.ok(plan.includes('担当・レビュー相手'));
});
test('bundled shared data hydrates in the browser runtime without duplicate embedded task logs',()=>{
 const compact=tasks.map(t=>{if(!t.environment)return t;const {logs,assets,...definition}=t;return definition;});const bundle={version:3,tasks:compact,environments};
 const h=boot({tasks,bundle});h.click('start',{id:'a01'});assert.equal(h.rendered.tasks.find(t=>t.id==='a01').assets.length,20);assert.ok(h.rendered.tasks.find(t=>t.id==='a01').logs.length>0);assert.match(h.elements.app.innerHTML,/環境の資産台帳/);
});
test('large timelines paginate chronologically without losing records or leaking pages across filters',()=>{
 const h=boot({tasks}),t=tasks.find(t=>t.id==='a01');h.click('start',{id:t.id});h.click('tab',{tab:'timeline'});
 const found=E.filterLogs(t.logs,h.rendered.ui.filters).sort((a,b)=>a.at.localeCompare(b.at));assert.ok(found.length>50);
 assert.equal((h.elements.app.innerHTML.match(/class="timeline-item"/g)||[]).length,50);assert.ok(h.elements.app.innerHTML.includes('data-id="'+found[0].id+'"'));assert.ok(!h.elements.app.innerHTML.includes('data-id="'+found[50].id+'"'));
 h.click('page-next');assert.ok(h.elements.app.innerHTML.includes('data-id="'+found[50].id+'"'));assert.ok(!h.elements.app.innerHTML.includes('data-id="'+found[0].id+'"'));
 h.search('no-matching-timeline-record');assert.equal(h.rendered.ui.page,0);assert.equal((h.elements.app.innerHTML.match(/class="timeline-item"/g)||[]).length,0);
});
