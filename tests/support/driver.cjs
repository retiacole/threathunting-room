'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const authoredTasks=[...require('../../src/content-intro.cjs'),...require('../../src/content-hunts.cjs')];
const scripts = Object.fromEntries(['i18n.js','engine.js','tutorial.js','reports.js','course-views.js','views.js','app.js'].map(name=>[name,fs.readFileSync(path.join(__dirname,'../../src',name),'utf8')]));
const clone = value => JSON.parse(JSON.stringify(value));

function boot(options={}) {
  const tasks=clone(options.tasks || authoredTasks), listeners={}, downloads=[], blobs=new Map(), errors=[];
  let stored=options.stored ? JSON.stringify(options.stored) : null, language=options.language||'ja', lastRender=null, nextBlob=0;
  function node(id) {
    const handlers={};
    return {id,innerHTML:'',textContent:'',value:'',handlers,
      classList:{add(){},remove(){}},contains(){return false;},querySelector(){return null;},querySelectorAll(){return [];},
      addEventListener:(name,callback)=>(handlers[name]??=[]).push(callback),focus(){},scrollIntoView(){}};
  }
  const translations=options.translations||JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/i18n-ui.en.json'),'utf8'));
  const elements={'translation-data':{textContent:JSON.stringify(translations)},app:node('app'),dialog:node('dialog'),toast:node('toast'),'import-file':node('import-file'),'task-data':{textContent:JSON.stringify(options.bundle||tasks)},query:node('query')};
  Object.assign(elements.dialog,{open:false,showModal(){this.open=true;},close(){this.open=false;}});
  elements['import-file'].click=()=>{};
  const document={getElementById:id=>elements[id] || null,activeElement:{tagName:'BODY'},title:'',
    addEventListener:(name,callback)=>(listeners[name]??=[]).push(callback),body:{appendChild(){}},
    createElement:()=>({href:'',download:'',click(){downloads.push({filename:this.download,blob:blobs.get(this.href)});},remove(){}})};
  const context={document,console:{log(){},error:err=>errors.push(err)},
    location:{hash:options.hash || ''},history:{pushState(_state,_unused,url){context.location.hash=url;}},
    localStorage:{getItem(key){if(options.storageError)throw Error('storage unavailable');return key==='threat-hunting-room.language.v1'?language:stored;},setItem(key,value){if(options.storageError)throw Error('storage unavailable');if(key==='threat-hunting-room.language.v1')language=value;else stored=value;}},
    setTimeout(){return 1;},clearTimeout(){},Blob,
    URL:{createObjectURL(blob){const url='blob:stub-'+(++nextBlob);blobs.set(url,blob);return url;},revokeObjectURL(url){blobs.delete(url);}},
    scrollTo(){},addEventListener(){}};
  context.window=context;
  vm.createContext(context);
  if(options.i18n)vm.runInContext(scripts['i18n.js'],context,{filename:'i18n.js'});
  vm.runInContext(scripts['engine.js'],context,{filename:'engine.js'});
  for(const name of ['tutorial.js','reports.js','course-views.js','views.js'])vm.runInContext(scripts[name],context,{filename:name});
  const render=context.THView.render;
  context.THView.render=input=>{lastRender={...input,ui:clone(input.ui),saved:clone(input.saved)};return render(input);};
  vm.runInContext(scripts['app.js'],context,{filename:'app.js'});
  function dispatch(name,event){for(const callback of listeners[name] || [])callback(event);assert.equal(errors.length,0,errors.map(e=>e.stack).join('\n'));}
  return {
    elements,downloads,tasks,
    get language(){return language;},
    get documentTitle(){return document.title;},
    get state(){return stored ? JSON.parse(stored) : null;},
    get rendered(){return lastRender;},
    click(action,data={}){const button={dataset:{action,...data}};dispatch('click',{target:{closest:()=>button},preventDefault(){}});},
    input(selector,dataset,value){dispatch('input',{target:{dataset,value,matches:q=>q===selector}});},
    change(selector,dataset,value,checked=true,id=''){dispatch('change',{target:{id,dataset,value,checked,matches:q=>q===selector}});},
    search(query){elements.query.value=query;dispatch('submit',{target:{id:'search-form'},preventDefault(){}});},
    async importFile(data,name='progress.json'){
      const text=typeof data==='string' ? data : JSON.stringify(data);
      elements['import-file'].files=[{name,size:Buffer.byteLength(text),text:async()=>text}];
      for(const callback of elements['import-file'].handlers.change || [])await callback({});
      assert.equal(errors.length,0);
    }
  };
}

function complete(harness,task) {
  const r=task.rubric;
  harness.click('start',{id:task.id});
  if(r.hypotheses)harness.change('[data-draft]',{draft:'hypothesis'},r.hypotheses[0]);
  for(const value of r.targets || [])harness.change('[data-array]',{array:'targets'},value);
  for(const value of r.sources || [])harness.change('[data-array]',{array:'sources'},value);
  if(r.verdict)harness.change('[data-draft]',{draft:'verdict'},r.verdict);
  if(r.finding)harness.change('[data-draft]',{draft:'finding'},r.finding);
  if(r.alternative)harness.change('[data-draft]',{draft:'alternative'},r.alternative);
  const registered=new Set();
  for(const group of r.evidenceGroups || []) {
    const id=group.anyOf.find(id=>!registered.has(id))||group.anyOf[0];
    if(!registered.has(id)){harness.click('add-evidence',{id});registered.add(id);}
    harness.change('[data-evidence-role]',{evidenceRole:id},group.role);
  }
  for(const op of r.operations || []) {
    if(op==='aggregate')harness.click('run-aggregate');
    if(op==='compare')harness.click('run-compare');
    if(op==='search' || op==='pivot')harness.click('pivot',{field:'host',value:task.logs[0].host});
  }
  if(r.choice)harness.change('[data-draft]',{draft:'choice'},r.choice);
  for(const value of r.selections||[])harness.change('[data-array]',{array:'selections'},value);
  if(r.query){harness.input('[data-draft]',{draft:'query'},task.explanation.sampleQuery);harness.click('test-query');}
  if(r.selfReview){harness.input('[data-draft]',{draft:'ownHypothesis'},task.modelHypothesis);harness.click('compare-hypothesis');harness.click('confirm-comparison',{kind:'hypothesis'});}
  if(r.reflection){harness.input('[data-draft]',{draft:'reflection'},task.modelReflection);harness.click('compare-reflection');harness.click('confirm-comparison',{kind:'reflection'});}
  harness.click('grade');
}


function completeExit(h,task){
 const x=task.exit;if(!x)return;
 h.click('report-tab',{tab:'exit'});
 if(x.rubric.query){h.input('[data-exit]',{exit:'query'},x.explanation.sampleQuery);h.click('test-exit-query');}
 if(x.rubric.choice)h.change('[data-exit]',{exit:'choice'},x.rubric.choice);
 for(const value of x.rubric.selections||[])h.change('[data-exit-array]',{exitArray:'selections'},value);
 if(x.rubric.reflection){h.input('[data-exit]',{exit:'reflection'},x.modelReflection);h.click('compare-exit-reflection');h.click('confirm-comparison',{kind:'exit'});}
 h.click('grade-exit');
}
module.exports={boot,complete,completeExit,clone,authoredTasks};
