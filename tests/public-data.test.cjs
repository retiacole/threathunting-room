'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {tasks,environments}=require('../src/catalog.cjs');
const {recordId,createPublicBundle}=require('../src/public-data.cjs');
const {boot,complete,completeExit}=require('./support/driver.cjs');
const E=require('../src/engine.js'),R=require('../src/reports.js');

test('published record IDs are stable, opaque and used consistently by shared snapshots',()=>{
 const bundle=createPublicBundle({tasks,environments}),env=Object.values(bundle.environments)[0],ids=new Set(env.logs.map(l=>l.id));
 assert.ok(env.logs.every(l=>/^rec-[0-9a-f]{16}$/.test(l.id)));assert.equal(ids.size,env.logs.length);
 for(const t of bundle.tasks){
  const records=t.environment?t.logIds:t.logs.map(l=>l.id);
  assert.ok(records.every(id=>/^rec-[0-9a-f]{16}$/.test(id)),t.id);
  if(t.environment)assert.ok(records.every(id=>ids.has(id)),t.id);
  for(const g of t.rubric.evidenceGroups||[])assert.ok(g.anyOf.every(id=>records.includes(id)),t.id);
 }
 const example=tasks.find(t=>t.id==='c01').logs[0].id;
 assert.equal(bundle.tasks.find(t=>t.id==='c01').logAliases[example],recordId(example));
 const reversed=createPublicBundle({tasks:[...tasks].reverse(),environments});
 assert.equal(reversed.tasks.find(t=>t.id==='c01').logAliases[example],recordId(example));
});

test('public tutorial completes with opaque IDs and does not expose authoring keys in detail, solution or CSV',async()=>{
 const h=boot({tasks,bundle:createPublicBundle({tasks,environments})}),t=h.rendered.tasks.find(t=>t.id==='tutorial'),id=t.rubric.evidenceGroups[0].anyOf[0];
 h.click('guide-next');h.search('destination:sync-demo.example');h.click('guide-next');
 h.click('log-detail',{id});assert.ok(h.elements.dialog.innerHTML.includes(id));assert.doesNotMatch(h.elements.dialog.innerHTML,/tutorial-net[12]/);
 h.click('close-dialog');h.click('guide-next');h.click('add-evidence',{id});h.click('guide-next');
 h.change('[data-evidence-role]',{evidenceRole:id},'support');h.click('guide-next');h.click('report-tab',{tab:'answers'});h.click('guide-next');
 h.change('[data-array]',{array:'targets'},'DEMO-WS-02');h.click('guide-next');h.click('grade');h.click('guide-next');h.click('solution');
 assert.doesNotMatch(h.elements.dialog.innerHTML,/tutorial-net[12]/);h.click('close-dialog');h.click('guide-next');
 assert.equal(h.state.taskStates.tutorial.guideStep,9);assert.equal(h.state.taskStates.tutorial.completed,true);
 h.click('export-logs');const csv=await h.downloads.at(-1).blob.text();assert.doesNotMatch(csv,/tutorial-(net|normal)/);
 assert.ok(csv.split('\r\n').slice(1).every(line=>/^"rec-[0-9a-f]{16}"/.test(line)));
});

test('public bundle grades both investigations and detection exits and imports previous evidence IDs',()=>{
 const bundle=createPublicBundle({tasks,environments}),h=boot({tasks,bundle});
 for(const id of ['p01','f01','c01','c02','c03','c04','c05']){
  const t=h.rendered.tasks.find(t=>t.id===id);complete(h,t);
  assert.equal(h.state.taskStates[id].completed,true,id+': '+JSON.stringify(h.rendered.ui.grade));
  if(t.exit){completeExit(h,t);assert.equal(h.state.taskStates[id].exitCompleted,true,id);}
 }
 const old=boot({tasks}),original=tasks.find(t=>t.id==='i01');complete(old,original);
 old.input('[data-draft]',{draft:'summary'},'以前の調査メモは保持する');old.click('grade');
 const imported=E.validateProgress(old.state,h.rendered.tasks);
 assert.equal(imported.taskStates.i01.completed,true);assert.equal(imported.taskStates.i01.draft.summary,'以前の調査メモは保持する');
 assert.ok(imported.taskStates.i01.draft.evidence.every(e=>e.id.startsWith('rec-')));
});

test('hunt records keep facts, reflection, limitations and next action as separate learner fields',()=>{
 const t=tasks.find(t=>t.id==='c02'),d={summary:'確認した接続の事実',reflection:'承認の範囲を比べた理由',limitations:'操作内容は今回の記録には含まれない',nextAction:'担当：運用チーム。期限：翌営業日。対象作業の記録を確認する。',finding:t.rubric.finding};
 const text=R.record(t,{draft:d}),limits=text.split('6. 限界\n')[1].split('\n7. 次の行動')[0],next=text.split('7. 次の行動\n')[1];
 assert.ok(text.includes(d.summary));assert.ok(text.includes(d.reflection));assert.ok(limits.includes(d.limitations));assert.ok(!limits.includes(d.nextAction));assert.ok(next.includes(d.nextAction));
 assert.ok(!limits.includes(t.findings.find(f=>f.id===d.finding).label));
 const h=boot({tasks});h.click('start',{id:'c02'});h.input('[data-draft]',{draft:'limitations'},d.limitations);h.input('[data-draft]',{draft:'nextAction'},d.nextAction);
 const reloaded=boot({tasks,stored:h.state,hash:'#c02'});assert.equal(reloaded.state.taskStates.c02.draft.limitations,d.limitations);assert.equal(reloaded.state.taskStates.c02.draft.nextAction,d.nextAction);
});

test('genuine pre-review v0.3 progress keeps notes and evidence while requesting newly required comparisons',()=>{
 const previous=require('./fixtures/v03-progress.json'),h=boot({tasks,bundle:createPublicBundle({tasks,environments})}),current=E.validateProgress(previous,h.rendered.tasks);
 assert.equal(Object.keys(current.taskStates).length,39);assert.equal(current.migrated,true);
 for(const [id,before] of Object.entries(previous.taskStates)){
  const after=current.taskStates[id],task=h.rendered.tasks.find(t=>t.id===id);
  assert.equal(after.draft.summary,before.draft.summary,id+' notes');
  for(const e of before.draft.evidence)assert.ok(after.draft.evidence.some(n=>n.id===task.logAliases[e.id]&&n.note===e.note),id+' evidence '+e.id);
  assert.equal(after.draft.limitations,'');assert.equal(after.draft.nextAction,'');
 }
 assert.equal(current.taskStates.i01.completed,true);
 assert.equal(current.taskStates.p01.completed,false,'old answer needs the newly required benign comparison');
 assert.equal(current.taskStates.p01.exitCompleted,false,'exit cannot stay complete after investigation needs review');
});
