'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {boot,complete}=require('./support/driver.cjs');
const runtime=fs.readFileSync(path.join(__dirname,'../src/i18n.js'),'utf8');
const ui=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/i18n-ui.en.json'),'utf8'));
function environment(dictionary=ui,language='ja') {
  const writes=[],nodes=[],elements=[],document={body:null,documentElement:{lang:'ja'},
    getElementById:id=>id==='translation-data'?{textContent:JSON.stringify(dictionary)}:null,
    createTreeWalker(){let index=0;return {nextNode:()=>nodes[index++]||null};}};
  const body={querySelectorAll:selector=>selector==='[data-language]'?[]:elements,getAttribute:()=>null,hasAttribute:()=>false};document.body=body;
  const context={document,localStorage:{getItem:()=>language,setItem:(key,value)=>writes.push([key,value])}};context.window=context;vm.createContext(context);vm.runInContext(runtime,context);
  function add(text,protectedContent=false){const parentElement={closest:()=>protectedContent?{}:null,matches:()=>false};const node={nodeValue:text,parentElement};nodes.push(node);return node;}
  function attribute(values){const original={...values};const element={getAttribute:key=>values[key],setAttribute:(key,value)=>values[key]=value,hasAttribute:key=>Object.hasOwn(values,key),closest:()=>null};elements.push(element);return {values,original};}
  return {I:context.THI18n,context,document,writes,add,attribute};
}
test('language changes are reversible and leave raw records, query values and learner notes unchanged',()=>{
 const e=environment({...ui,'高':'High'}),label=e.add('保存'),content=e.add('支持 — 事実・仮説の根拠'),raw=e.add('保存',true),note=e.add('仮説を支持',true),query=e.add('source:端末 -source:業務',true);
 const accessible=e.attribute({'aria-label':'学習マップへ','placeholder':'端末・ユーザー・通信先などで検索'});
 e.I.setLanguage('en');
 assert.equal(label.nodeValue,'Save');assert.equal(content.nodeValue,'Support — evidence for a fact or hypothesis');
 assert.equal(raw.nodeValue,'保存');assert.equal(note.nodeValue,'仮説を支持');assert.equal(query.nodeValue,'source:端末 -source:業務');
 assert.equal(accessible.values['aria-label'],'Go to learning map');assert.equal(e.document.documentElement.lang,'en');
 e.I.setLanguage('ja');assert.equal(label.nodeValue,'保存');assert.deepEqual(accessible.values,accessible.original);
 e.I.setLanguage('en');assert.equal(label.nodeValue,'Save');assert.equal(raw.nodeValue,'保存');
 assert.ok(e.writes.every(([key])=>key==='threat-hunting-room.language.v1'));
 assert.equal(e.I.text('高'),'High');assert.equal(e.I.text('入力中'), '入力中');
});
test('translation uses exact long phrases and task headings without rewriting short characters inside words',()=>{
 const e=environment({...ui,'高':'High','中':'Medium','低':'Low'},'en');
 assert.equal(e.I.text('JSTを併記：オン'),'Display JST: On');
 assert.equal(e.I.text('入門の6タスク'),'Foundations — 6 tasks');
 assert.equal(e.I.text('  保存  '),'  Save  ');
 assert.equal(e.I.text('高低差'),'高低差');
 assert.equal(e.I.text('保存されている進捗：1タスク（採点条件達成：0件）'),'Saved progress: 1 task (grading requirements met: 0).');
 assert.equal(e.I.text('開始日（UTC）'),'Start date (UTC)');
 assert.equal(e.I.text('「source:」の後に値を入力してください。'),'Enter a value after “source:”.');
 assert.equal(e.I.sourceName('通信'),'Network (通信)');
 assert.equal(e.I.text('source:端末'), 'source:Endpoint'); // Raw queries are protected by DOM boundary, never passed here.
});
test('controller language switch keeps pending query, selected filters, grade and progress byte-for-byte',()=>{
 const h=boot({i18n:true});const task=h.tasks[0];complete(h,task);
 h.elements.query.value='source:端末 pending / phrase';
 const before=JSON.stringify(h.state),rendered=JSON.stringify(h.rendered),pending=h.elements.query.value;
 h.change('[data-language]',{},'en');
 assert.equal(h.language,'en');assert.equal(JSON.stringify(h.state),before);assert.equal(JSON.stringify(h.rendered),rendered);assert.equal(h.elements.query.value,pending);
 h.change('[data-language]',{},'ja');assert.equal(h.language,'ja');assert.equal(JSON.stringify(h.state),before);assert.equal(h.elements.query.value,pending);
});
test('report headings translate while user writing, queries and log details remain verbatim',()=>{
 const e=environment(ui,'en');vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/reports.js'),'utf8'),e.context);
 const task={id:'demo',title:'操作チュートリアル',brief:'仮説を支持',focus:'検索',periods:{current:{from:'2026-09-14',to:'2026-09-16'},baseline:{from:'2026-09-07',to:'2026-09-09'}},rubric:{},logs:[{id:'r1',source:'通信',host:'WS-01',at:'2026-09-15T00:00:00Z',detail:'保存 / 仮説を支持'}]};
 const report=e.context.THReports.record(task,{draft:{ownHypothesis:'保存',summary:'調査計画',query:'source:端末',limitations:'観測不足',nextAction:'次の行動',evidence:[{id:'r1',role:'support',note:'反証'}]},filters:{query:'source:通信'}});
 assert.match(report,/Hunt record/);assert.match(report,/1\. Hypothesis\n保存\n/);assert.match(report,/Observed facts \/ investigation notes:調査計画/);assert.match(report,/Submitted query:source:端末/);assert.match(report,/保存 \/ 仮説を支持/);assert.match(report,/Note:反証/);
});
test('every authored Japanese learner-facing field in the public bundle has an exact English translation',()=>{
 const {tasks,environments}=require('../src/catalog.cjs');
 const {createPublicBundle}=require('../src/public-data.cjs');
 const bundle=createPublicBundle({tasks,environments});
 const dictionary=Object.assign({},require('../src/content-capstone.cjs').translations,require('../src/content-extensions.cjs').translations,require('../src/content-practice-notes.cjs').translations,...['ui','part1','part2'].map(name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../src/i18n-'+name+'.en.json'),'utf8'))));
 const missing=[];let checked=0;
 function visit(value,location=[]){
   const key=location.join('.');
   // Source names are query/grading identifiers. Menus show bilingual display labels.
   if(/\.sources\.\d+\.name$/.test(key)||/\.rubric\.sources\./.test(key))return;
   if(typeof value==='string'&&/[\u3040-\u30ff\u3400-\u9fff]/.test(value)){
     checked++;if(typeof dictionary[value]!=='string'||!dictionary[value].trim())missing.push(key+': '+value);
   }else if(Array.isArray(value))value.forEach((entry,index)=>visit(entry,[...location,index]));
   else if(value&&typeof value==='object')for(const [name,entry]of Object.entries(value)){
     // Raw event content and executable queries are intentionally unchanged in English.
     if(['logs','evaluationLogs','aliases','aliasMap','query','sampleQuery'].includes(name))continue;
     visit(entry,[...location,name]);
   }
 }
 visit(bundle);
 assert.ok(checked>=1800,'coverage must include tutorial, all tasks, source descriptions and environment metadata');
 assert.deepEqual(missing,[]);
});
