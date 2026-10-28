'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {boot,complete,completeExit,clone}=require('./support/driver.cjs');
const {tasks,environments}=require('../src/catalog.cjs');
const {createPublicBundle}=require('../src/public-data.cjs');

const extended=tasks.filter(t=>t.extension);
function answer(h,t,correct=true){
 for(const q of t.extension.questions)h.change('[data-extension-answer]',{extensionAnswer:q.id},correct?q.answer:q.options.find(o=>o.id!==q.answer).id);
}

test('optional exercises open only after their investigation and any existing exit',()=>{
 for(const t of extended){
  const h=boot({tasks});h.click('start',{id:t.id});
  h.click('open-extension');assert.equal(h.elements.dialog.open,false);
  h.click('grade-extension');assert.equal(h.state.taskStates[t.id].extensionCompleted,false);
  complete(h,t);
  if(t.exit){h.click('open-extension');assert.equal(h.elements.dialog.open,false);completeExit(h,t);}
  assert.match(h.elements.app.innerHTML,/data-action="open-extension"/);
  h.click('open-extension');assert.equal(h.elements.dialog.open,true);
  assert.ok(h.elements.dialog.innerHTML.includes(t.extension.table.caption));
  assert.equal((h.elements.dialog.innerHTML.match(/<fieldset /g)||[]).length,t.extension.questions.length);
  assert.match(h.elements.dialog.innerHTML,/<caption>/);
  assert.match(h.elements.dialog.innerHTML,/role="region"/);
 }
});

test('all three experiences grade, retry and resume independently from completed investigations',()=>{
 assert.deepEqual(extended.map(t=>t.id).sort(),['a03','f01','f03']);
 for(const t of extended){
  const h=boot({tasks});complete(h,t);completeExit(h,t);
  const before=clone(h.state.taskStates[t.id]);h.click('open-extension');
  answer(h,t,false);h.click('grade-extension');
  assert.equal(h.state.taskStates[t.id].extensionCompleted,false);
  assert.equal(h.state.taskStates[t.id].completed,true);
  assert.equal(h.state.taskStates[t.id].exitCompleted,before.exitCompleted);
  assert.deepEqual(h.state.taskStates[t.id].draft,before.draft);
  assert.deepEqual(h.state.taskStates[t.id].exitDraft,before.exitDraft);
  for(const q of t.extension.questions)assert.ok(h.elements.dialog.innerHTML.includes(q.explanation));
  answer(h,t);h.click('grade-extension');assert.equal(h.state.taskStates[t.id].extensionCompleted,true);
  h.click('close-dialog');assert.match(h.elements.app.innerHTML,/追加体験を振り返る/);
  const restored=boot({tasks,stored:h.state,hash:'#'+t.id});restored.click('open-extension');
  assert.equal(restored.state.taskStates[t.id].extensionCompleted,true);
  assert.match(restored.elements.dialog.innerHTML,/追加体験を完了しました/);
  const q=t.extension.questions[0];restored.change('[data-extension-answer]',{extensionAnswer:q.id},q.options.find(o=>o.id!==q.answer).id);
  assert.equal(restored.state.taskStates[t.id].extensionCompleted,false);
  assert.equal(restored.rendered.ui.extensionGrade,null);
  assert.doesNotMatch(restored.elements.dialog.innerHTML,/extension-feedback/);
  assert.equal(restored.state.taskStates[t.id].completed,true);
 }
});

test('reading in-practice notes does not change answers or completion',()=>{
 const owners=tasks.filter(t=>t.practiceNotes||t.exit?.practiceNotes);
 assert.deepEqual(owners.map(t=>t.id).sort(),['c01','c05','f01','g02','i06','p03','p04']);
 for(const t of owners){
  const h=boot({tasks});h.click('start',{id:t.id});const before=h.state;
  h.click(t.practiceNotes?'solution':'exit-solution');
  assert.match(h.elements.dialog.innerHTML,/<details class="practice-notes"><summary>実務では<\/summary>/);
  assert.doesNotMatch(h.elements.dialog.innerHTML,/<details class="practice-notes" open/);
  for(const note of (t.practiceNotes||t.exit.practiceNotes))assert.ok(h.elements.dialog.innerHTML.includes(note.body.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))));
  assert.deepEqual(h.state,before);
 }
});

test('public IDs and JSON export/import preserve optional work without touching original completion',async()=>{
 const bundle=createPublicBundle({tasks,environments}),h=boot({tasks,bundle});
 const t=h.rendered.tasks.find(t=>t.id==='f01');complete(h,t);completeExit(h,t);h.click('open-extension');answer(h,t);h.click('grade-extension');h.click('close-dialog');h.click('export');
 const progress=JSON.parse(await h.downloads.at(-1).blob.text());
 assert.equal(progress.schemaVersion,3);assert.equal(progress.taskStates.f01.extensionCompleted,true);
 const restored=boot({tasks,bundle});await restored.importFile(progress);restored.click('confirm-import');
 assert.deepEqual(restored.state.taskStates.f01.extensionAnswers,progress.taskStates.f01.extensionAnswers);
 assert.equal(restored.state.taskStates.f01.completed,true);assert.equal(restored.state.taskStates.f01.exitCompleted,true);assert.equal(restored.state.taskStates.f01.extensionCompleted,true);
 restored.click('open-extension');assert.match(restored.elements.dialog.innerHTML,/追加体験を完了しました/);
});

test('exercise content is escaped and unsupported answer events are ignored',()=>{
 const copy=clone(tasks),t=copy.find(t=>t.id==='a03');t.extension.questions[0].prompt='<img src=x onerror=alert(1)>';
 t.extension.table.rows[0][t.extension.table.columns[0].key]='<svg onload=alert(1)>';
 const h=boot({tasks:copy});complete(h,t);h.click('open-extension');
 assert.doesNotMatch(h.elements.dialog.innerHTML,/<img|<svg/);assert.match(h.elements.dialog.innerHTML,/&lt;img/);assert.match(h.elements.dialog.innerHTML,/&lt;svg/);
 const before=h.state;
 h.change('[data-extension-answer]',{extensionAnswer:'__proto__'},'polluted');
 h.change('[data-extension-answer]',{extensionAnswer:t.extension.questions[0].id},'not-an-option');
 assert.deepEqual(h.state,before);
});
