'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {boot,complete,authoredTasks}=require('./support/driver.cjs');
const tutorial=require('../src/content-tutorial.cjs');const T=require('../src/tutorial.js');
const tasks=[tutorial,...authoredTasks];
function advance(h,n){for(let i=0;i<n;i++)h.click('guide-next');}
function prepareTutorialForGrade(h){
 h.click('tutorial-start');h.click('guide-next');h.search('destination:sync-demo.example');h.click('guide-next');
 h.click('log-detail',{id:'tutorial-net1'});h.click('close-dialog');h.click('guide-next');
 h.click('add-evidence',{id:'tutorial-net1'});h.click('guide-next');
 h.change('[data-evidence-role]',{evidenceRole:'tutorial-net1'},'support');h.click('guide-next');
 h.click('report-tab',{tab:'answers'});h.click('guide-next');
 h.change('[data-array]',{array:'targets'},'DEMO-WS-02');h.click('guide-next');
}
function finishTutorial(h){
 prepareTutorialForGrade(h);
 h.click('grade');h.click('guide-next');h.click('solution');h.click('close-dialog');h.click('guide-next');
}
test('first run opens the dedicated tutorial and does not change normal task resume state',()=>{
 const h=boot({tasks});assert.equal(h.rendered.ui.task,'tutorial');assert.equal(h.state.lastTask,null);
 assert.match(h.elements.app.innerHTML,/画面の3つの場所/);assert.match(h.elements.app.innerHTML,/中断して教材一覧へ/);
 h.click('home');assert.match(h.elements.app.innerHTML,/チュートリアルの続きから/);assert.equal(h.state.lastTask,null);
});
test('tutorial next button requires the actual corresponding operation and blocks step jumps',()=>{
 const h=boot({tasks});h.click('guide-next');assert.equal(h.state.taskStates.tutorial.guideStep,1);
 advance(h,3);assert.equal(h.state.taskStates.tutorial.guideStep,1);
 h.click('guide-step',{step:'9'});assert.equal(h.state.taskStates.tutorial.guideStep,1);
 h.search('destination:docs.example');h.click('guide-next');assert.equal(h.state.taskStates.tutorial.guideStep,1);
 h.search('destination:sync-demo.example');h.click('guide-next');assert.equal(h.state.taskStates.tutorial.guideStep,2);
 h.click('log-detail',{id:'tutorial-normal1'});h.click('close-dialog');h.click('guide-next');assert.equal(h.state.taskStates.tutorial.guideStep,2);
 h.click('log-detail',{id:'tutorial-net2'});h.click('close-dialog');h.click('guide-next');assert.equal(h.state.taskStates.tutorial.guideStep,3);
 h.click('add-evidence',{id:'tutorial-net2'});h.click('guide-next');assert.equal(h.state.taskStates.tutorial.guideStep,4);
 h.click('guide-next');assert.equal(h.state.taskStates.tutorial.guideStep,4);
 h.change('[data-evidence-role]',{evidenceRole:'tutorial-net2'},'support');h.click('guide-next');assert.equal(h.state.taskStates.tutorial.guideStep,5);
});
test('tutorial can be completed through 10 guided steps and resumed/replayed without touching main progress',()=>{
 const h=boot({tasks});complete(h,authoredTasks[0]);const before=h.state.taskStates.i01;
 finishTutorial(h);assert.equal(T.finished(h.state.taskStates.tutorial),true);assert.equal(h.state.taskStates.tutorial.guideStep,9);
 assert.match(h.elements.app.innerHTML,/入門01へ進む/);assert.equal(h.state.lastTask,'i01');assert.deepEqual(h.state.taskStates.i01,before);
 h.click('home');assert.match(h.elements.app.innerHTML,/チュートリアルを最初から練習/);
 h.click('tutorial-start',{reset:'true'});assert.equal(h.state.taskStates.tutorial.guideStep,0);assert.equal(h.state.taskStates.tutorial.completed,false);assert.deepEqual(h.state.taskStates.i01,before);
 h.click('guide-next');h.search('destination:sync-demo.example');h.click('guide-next');
 const resumed=boot({tasks,stored:h.state,hash:'#tutorial'});assert.equal(resumed.state.taskStates.tutorial.guideStep,2);assert.equal(resumed.rendered.ui.filters.query,'destination:sync-demo.example');assert.deepEqual(resumed.state.taskStates.i01,before);
});
test('every guided operation points at a real element in its rendered screen',()=>{
 const h=boot({tasks});finishTutorial(h);
 for(let i=0;i<tutorial.guide.length-1;i++){
  const saved=h.state;saved.taskStates.tutorial.guideStep=i;
  const view=boot({tasks,stored:saved,hash:'#tutorial'});
  assert.ok(view.elements.app.innerHTML.includes('data-tutorial-target="'+tutorial.guide[i].focus+'"'),tutorial.guide[i].title);
 }
});
test('tutorial progress JSON imports restore the tutorial while retaining normal work',async()=>{
 const h=boot({tasks});h.click('guide-next');h.search('destination:sync-demo.example');h.click('guide-next');const tutorialSave=h.state;
 const other=boot({tasks});other.click('start',{id:'i02'});other.input('[data-draft]',{draft:'summary'},'通常の調査メモ');
 await other.importFile(tutorialSave);other.click('confirm-import');assert.equal(other.rendered.ui.task,'tutorial');assert.equal(other.state.taskStates.tutorial.guideStep,2);assert.equal(other.state.taskStates.i02.draft.summary,'通常の調査メモ');
});
test('reload and JSON import cannot replace the required successful grade-button operation',async()=>{
 const h=boot({tasks});prepareTutorialForGrade(h);
 assert.equal(h.state.taskStates.tutorial.guideStep,7);
 assert.equal(h.state.taskStates.tutorial.completed,false);
 assert.ok(!h.state.taskStates.tutorial.tutorialActions.includes('graded'));
 const savedBeforeGrade=h.state;
 const resumed=boot({tasks,stored:savedBeforeGrade,hash:'#tutorial'});
 assert.equal(resumed.state.taskStates.tutorial.completed,true,'answers are still revalidated on load');
 resumed.click('guide-next');assert.equal(resumed.state.taskStates.tutorial.guideStep,7,'a recomputed passing answer is not a grade-button operation');
 resumed.click('solution');resumed.click('close-dialog');resumed.click('guide-next');
 assert.equal(resumed.state.taskStates.tutorial.guideStep,7);assert.equal(T.finished(resumed.state.taskStates.tutorial),false);

 const imported=boot({tasks});imported.click('start',{id:'i02'});imported.input('[data-draft]',{draft:'summary'},'継続中の調査を残す');
 await imported.importFile(savedBeforeGrade);imported.click('confirm-import');
 assert.equal(imported.rendered.ui.task,'tutorial');imported.click('guide-next');
 assert.equal(imported.state.taskStates.tutorial.guideStep,7);assert.equal(imported.state.taskStates.i02.draft.summary,'継続中の調査を残す');
 imported.change('[data-array]',{array:'targets'},'DEMO-WS-02',false);imported.click('grade');
 assert.ok(!imported.state.taskStates.tutorial.tutorialActions.includes('graded'),'an unsuccessful grade does not count as completing the operation');
 imported.change('[data-array]',{array:'targets'},'DEMO-WS-02');imported.click('grade');
 assert.ok(imported.state.taskStates.tutorial.tutorialActions.includes('graded'));imported.click('guide-next');assert.equal(imported.state.taskStates.tutorial.guideStep,8);
 const afterGrade=boot({tasks,stored:imported.state,hash:'#tutorial'});
 assert.ok(afterGrade.state.taskStates.tutorial.tutorialActions.includes('graded'),'the explicit operation survives schema normalization');
});
test('editing a finished tutorial returns to answer checking and cannot retain the completion announcement',()=>{
 const h=boot({tasks});complete(h,authoredTasks[0]);const normal=JSON.stringify(h.state.taskStates.i01);
 finishTutorial(h);assert.equal(T.finished(h.state.taskStates.tutorial),true);
 h.input('[data-draft]',{draft:'summary'},'完了後に振り返りを追記');
 assert.equal(h.state.taskStates.tutorial.completed,false);assert.equal(T.finished(h.state.taskStates.tutorial),false);
 assert.equal(h.state.taskStates.tutorial.guideStep,7);assert.doesNotMatch(h.elements.app.innerHTML,/基本の操作を体験できました。/);
 assert.doesNotMatch(h.elements.app.innerHTML,/<h2>操作チュートリアル完了<\/h2>/);
 assert.equal(JSON.stringify(h.state.taskStates.i01),normal);
 h.click('grade');h.click('guide-next');h.click('solution');h.click('close-dialog');h.click('guide-next');assert.equal(T.finished(h.state.taskStates.tutorial),true);
 h.change('[data-array]',{array:'targets'},'DEMO-WS-01');
 assert.equal(h.state.taskStates.tutorial.guideStep,7);assert.equal(T.finished(h.state.taskStates.tutorial),false);
 assert.doesNotMatch(h.elements.app.innerHTML,/基本の操作を体験できました。/);
 h.click('grade');h.click('guide-next');assert.equal(h.state.taskStates.tutorial.guideStep,7,'an invalid edited answer still requires correction');
 assert.equal(JSON.stringify(h.state.taskStates.i01),normal);
});
