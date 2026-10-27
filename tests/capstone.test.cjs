'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {tasks,environments}=require('../src/catalog.cjs'),E=require('../src/engine.js');
const {createPublicBundle}=require('../src/public-data.cjs');
const {boot,complete,clone}=require('./support/driver.cjs');
const {answer}=require('./support/capstone.cjs');
const task=tasks.find(t=>t.id==='x01'),ops=task.rubric.operations;
function submit(h,t){
 const d=answer(t);h.click('start',{id:t.id});
 for(const field of ['targets','sources'])for(const value of d[field])h.change('[data-array]',{array:field},value);
 for(const field of ['verdict','ownHypothesis','reflection','query','summary','limitations','nextAction'])h.input('[data-draft]',{draft:field},d[field]);
 for(const e of d.evidence){h.click('add-evidence',{id:e.id});h.change('[data-evidence-role]',{evidenceRole:e.id},e.role);h.input('[data-evidence-note]',{evidenceNote:e.id},e.note);}
 h.click('run-aggregate');h.click('run-compare');h.click('test-query');
 for(const kind of ['hypothesis','reflection']){h.click('compare-'+kind);h.click('confirm-comparison',{kind});}
 h.click('grade');return d;
}
test('independent hunt validates bounded structure and reproduction without grading prose or fixed conclusions',()=>{
 const d=answer(task),g=E.gradeTask(task,d,ops);assert.equal(g.passed,true,JSON.stringify(g));
 assert.ok(g.query.openHunt);assert.equal(g.query.precision,undefined);assert.equal(g.query.recall,undefined);
 assert.ok(!g.criteria.some(c=>['evidence-precision','verdict','targets'].includes(c.id)));
 assert.equal(E.gradeTask(task,{...d,verdict:'insufficient'},ops).passed,true,'conclusion meaning is not automatically certified');
 const failures=[
  {...d,query:''},{...d,query:'source:'},{...d,query:'host:CEDAR'},{...d,query:'host:CEDAR-WEB-01'},
  {...d,evidence:d.evidence.slice(0,3)},{...d,evidence:[...d.evidence,d.evidence[0]]},
  {...d,evidence:d.evidence.map(e=>({...e,note:''}))},{...d,evidence:d.evidence.map(e=>({...e,role:'support'}))},
  {...d,evidence:d.evidence.filter(e=>task.logs.find(l=>l.id===e.id).period==='current')},
  {...d,sources:['端末']},{...d,sources:[...d.sources,'認証']},{...d,targets:[]},{...d,targets:['invented']},
  {...d,summary:''},{...d,limitations:''},{...d,nextAction:''},{...d,to:'2026-10-14'},
  {...d,ownHypothesis:'edited after comparison'},{...d,reflection:'edited after comparison'}
 ];
 for(const draft of failures)assert.equal(E.gradeTask(task,draft,ops).passed,false,JSON.stringify(draft));
 assert.equal(E.gradeTask(task,d,[]).passed,false);
 // A different question and host can also meet the same structural contract.
 const web=task.logs.filter(l=>l.host==='CEDAR-WEB-01');
 const other={...d,targets:['CEDAR-WEB-01'],sources:['認証','収集'],verdict:'insufficient',query:'host:CEDAR-WEB-01',evidence:[
  {id:web.find(l=>l.period==='baseline').id,role:'context',note:'Earlier deployment context.'},
  {id:web.find(l=>l.period==='current'&&l.event==='Authentication').id,role:'context',note:'Known current deployment activity.'},
  {id:web.find(l=>l.event==='Authentication failures').id,role:'counter',note:'Failed authentication is not a successful login.'},
  {id:web.find(l=>l.source==='収集').id,role:'gap',note:'Later execution is not observable.'}
 ]};
 assert.equal(E.gradeTask(task,other,ops).passed,true);

});
test('optional task remains outside main route and old saves, while its own completion round-trips and regrades',()=>{
 const h=boot({tasks}),d=answer(task);h.click('home');assert.match(h.elements.app.innerHTML,/0<span> \/ 38/);
 const old=clone(require('./fixtures/v05-progress.json'));const published=boot({tasks,bundle:createPublicBundle({tasks,environments})}).rendered.tasks;const restored=E.validateProgress(old,published);assert.equal(Object.keys(restored.taskStates).length,39);assert.equal(restored.taskStates.x01,undefined);
 const progress={schemaVersion:3,taskStates:{x01:{draft:d,operations:ops,completed:true}},lastTask:'x01',activeTask:'x01'};
 assert.equal(E.validateProgress(progress,tasks).taskStates.x01.completed,true);
 progress.taskStates.x01.draft.evidence[0].note='';assert.equal(E.validateProgress(progress,tasks).taskStates.x01.completed,false);
 complete(h,tasks.find(t=>t.id==='g02'));assert.match(h.elements.app.innerHTML,/data-id="x01"/);assert.match(h.elements.app.innerHTML,/学習マップで続ける/);
});
test('published capstone works through the controller with opaque evidence, saves and an honest report',async()=>{
 const bundle=createPublicBundle({tasks,environments}),h=boot({tasks,bundle}),t=h.rendered.tasks.find(t=>t.id==='x01');
 assert.equal(t.logs.length,task.logs.length);assert.ok(t.logs.every(l=>/^rec-/.test(l.id)));
 const d=submit(h,t);assert.equal(h.state.taskStates.x01.completed,true,JSON.stringify(h.rendered.ui.grade));
 h.click('roles-help');assert.match(h.elements.dialog.innerHTML,/関連性・役割・文章の意味は自動判定しません/);h.click('close-dialog');
 assert.match(h.elements.app.innerHTML,/提出構成と自己比較を確認しました/);assert.doesNotMatch(h.elements.app.innerHTML,/適合率 \d+%|再現率 \d+%/);
 for(const tab of ['plan','logs','aggregate','compare','timeline']){h.click('tab',{tab});assert.doesNotMatch(h.elements.app.innerHTML,/undefined|NaN/);}
 h.click('report-tab',{tab:'answers'});assert.match(h.elements.app.innerHTML,/観測上の限界（必須）/);
 h.click('test-query');assert.equal(h.rendered.ui.queryResult.passed,true);
 h.input('[data-evidence-note]',{evidenceNote:d.evidence[0].id},'');assert.equal(h.state.taskStates.x01.completed,false);assert.equal(h.rendered.ui.queryResult,null);
 h.input('[data-evidence-note]',{evidenceNote:d.evidence[0].id},d.evidence[0].note);h.click('grade');h.click('export-report');
 const report=await h.downloads.at(-1).blob.text();assert.match(report,/提出構成と自己比較を確認（内容の意味は未評価）/);assert.ok(report.includes(d.query));assert.ok(report.includes(d.limitations));
 const reloaded=boot({tasks,bundle,stored:h.state,hash:'#x01'});assert.equal(reloaded.state.taskStates.x01.completed,true);
 reloaded.click('home');assert.match(reloaded.elements.app.innerHTML,/0<span> \/ 38/);assert.match(reloaded.elements.app.innerHTML,/卒業演習を振り返る/);
 assert.ok(reloaded.elements.app.innerHTML.indexOf('v'+bundle.releaseVersion)<reloaded.elements.app.innerHTML.indexOf('<main'));
});
test('A01 optional inventory aid keeps the corpus and checklist and opens collection records without stale filters',()=>{
 const h=boot({tasks});h.click('start',{id:'a01'});assert.equal(tasks.find(t=>t.id==='a01').logs.length,1470);
 assert.match(h.elements.app.innerHTML,/時刻の小確認/);assert.match(h.elements.app.innerHTML,/INVESTIGATION CHECKLIST/);
 h.search('nothing-matches');h.change('[data-filter]',{filter:'host'},'FIN-WS-01');h.click('inventory-sources');
 const f=h.rendered.ui.filters;assert.equal(f.source,'収集');assert.equal(f.query,'');assert.equal(f.host,'');assert.equal(f.period,'all');
 assert.ok(E.filterLogs(tasks.find(t=>t.id==='a01').logs,f).length>0);assert.equal(h.rendered.tasks.find(t=>t.id==='a01').logs.length,1470);
});
