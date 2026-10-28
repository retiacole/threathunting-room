'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {boot,complete,completeExit,clone}=require('./support/driver.cjs');
const {tasks}=require('../src/catalog.cjs');
const {applyPracticeNotes}=require('../src/content-practice-notes.cjs');
const escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('comparison checklists are optional for hypothesis, reflection, capstone and deliverables',()=>{
 const h=boot({tasks});
 for(const [id,kind,field] of [['f01','hypothesis','ownHypothesis'],['b01','reflection','reflection'],['x01','reflection','reflection'],['f01','exit','reflection']]){
  h.click('start',{id});
  const isExit=kind==='exit';
  h.input(isExit?'[data-exit]':'[data-draft]',isExit?{exit:field}:{draft:field},'My own observations and limits');
  const before=clone(h.state);
  const action=isExit?'compare-exit-reflection':'compare-'+kind;
  h.click(action);
  const html=h.elements.dialog.innerHTML;
  assert.equal((html.match(/data-self-review/g)||[]).length,5,id+' '+kind);
  assert.match(html,/代替説明を1つ以上/);
  assert.match(html,/観測できていない範囲/);
  assert.doesNotMatch(html,/data-self-review[^>]*(?:checked|required)/);
  h.change('[data-self-review]',{},'',true);
  assert.deepEqual(h.state,before,'checking a prompt does not write progress');
  h.click('close-dialog');h.click(action);
  assert.doesNotMatch(h.elements.dialog.innerHTML,/data-self-review[^>]*checked/);
  h.click('confirm-comparison',{kind});
  const d=isExit?h.state.taskStates[id].exitDraft:h.state.taskStates[id].draft;
  assert.equal(d[kind==='hypothesis'?'reviewedHypothesis':'reviewedReflection'],d[field]);
 }
 const t=tasks.find(t=>t.id==='f01');complete(h,t);completeExit(h,t);
 assert.equal(h.state.taskStates.f01.completed,true);
 assert.equal(h.state.taskStates.f01.exitCompleted,true);
 for(const action of ['solution','exit-solution']){
  const before=clone(h.state);h.click(action);
  assert.match(h.elements.dialog.innerHTML,/self-review-checklist/);
  assert.deepEqual(h.state,before);
 }
});

test('all self-review prompts have English translations',()=>{
 const h=boot({tasks}),ui=JSON.parse(fs.readFileSync(require.resolve('../src/i18n-ui.en.json'),'utf8'));
 h.click('start',{id:'b01'});h.input('[data-draft]',{draft:'reflection'},'Review');h.click('compare-reflection');
 const checklist=h.elements.dialog.innerHTML.match(/<fieldset class="self-review-checklist[\s\S]*?<\/fieldset>/)[0];
 const labels=[...checklist.matchAll(/<(?:legend|p|span)[^>]*>([^<]+)<\//g)].map(m=>m[1]);
 assert.equal(labels.length,7);
 for(const label of labels)assert.ok(ui[label]&&!/[\u3040-\u30ff\u3400-\u9fff]/.test(ui[label]),label);
});

test('practice examples are escaped reading material and independent copies',()=>{
 const source=tasks.find(t=>t.id==='f01');
 const first=applyPracticeNotes([source]),second=applyPracticeNotes([source]);
 const examples=first[0].exit.practiceNotes.find(n=>n.examples).examples;
 examples[0].query='<script>not executable</script>';
 examples[0].label='<img src=x onerror=alert(1)>';
 assert.notEqual(second[0].exit.practiceNotes.find(n=>n.examples).examples[0].query,examples[0].query);
 const h=boot({tasks:first});h.click('start',{id:'f01'});const before=clone(h.state);h.click('exit-solution');
 assert.ok(h.elements.dialog.innerHTML.includes(escape(examples[0].query)));
 assert.ok(h.elements.dialog.innerHTML.includes(escape(examples[0].label)));
 assert.doesNotMatch(h.elements.dialog.innerHTML,/<script>|<img/);
 assert.deepEqual(h.state,before);
 const original=second[0].exit.practiceNotes.find(n=>n.examples).examples;
 for(const example of original)assert.ok(example.query.trim());
 assert.match(original[2].query,/InitiatingProcessFileName =~ "docview.exe"/);
 assert.match(original[3].query,/ParentImage\|endswith: '\\docview.exe'/);
});
