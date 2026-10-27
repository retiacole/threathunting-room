const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const tasks=[...require('../src/content-intro.cjs'),...require('../src/content-hunts.cjs')];const E=require('../src/engine.js');
const context={window:{THEngine:E}};for(const name of ['tutorial.js','course-views.js','views.js'])vm.runInNewContext(fs.readFileSync(require.resolve('../src/'+name),'utf8'),context);const V=context.window.THView;
const blank=t=>({draft:{hypothesis:'',targets:[],verdict:'',sources:[],from:t.periods.current.from,to:t.periods.current.to,finding:'',evidence:[],summary:''},operations:[],completed:false,hintLevel:0,guideStep:0});
const ui=t=>({task:t?.id||null,level:t?.level||'intro',tab:'logs',reportTab:'evidence',filters:{query:'',source:'',host:'',period:'current',from:'',to:''},page:0,group:'host',aggregateRan:true,compareRan:true,compareSource:'',compareField:'host',grade:null,guideVisible:true});
test('all 15 authored tasks render all investigation panels and progressive answer forms',()=>{for(const t of tasks){const s=blank(t),c={tasks,saved:{taskStates:{[t.id]:s},lastTask:t.id},ui:ui(t),storageWarning:''};for(const tab of ['plan','logs','aggregate','compare','timeline']){c.ui.tab=tab;const html=V.render(c);assert.ok(html.includes(t.title),t.id+' '+tab);assert.ok(!html.includes('undefined'),t.id+' unresolved field');}c.ui.reportTab='answers';const html=V.render(c);assert.equal(html.includes('id="answer-verdict"'),Boolean(t.rubric.verdict));assert.equal(html.includes('id="answer-hypothesis"'),Boolean(t.rubric.hypotheses));}});
test('restored learner text cannot become executable markup in any rendered surface',()=>{const t=tasks[0],s=blank(t);s.draft.summary='<img src=x onerror=alert(1)>';s.draft.evidence=[{id:t.logs[0].id,role:'context',note:'" autofocus onfocus="alert(1)'}];const c={tasks,saved:{taskStates:{[t.id]:s},lastTask:t.id},ui:ui(t),storageWarning:''};let html=V.render(c);assert.ok(html.includes('&quot; autofocus onfocus=&quot;'));assert.ok(!html.includes('value="" autofocus'));c.ui.reportTab='answers';html=V.render(c);assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!html.includes('<img src=x'));});
test('a new learner can open the home map before any task state exists',()=>{const html=V.render({tasks,saved:{taskStates:{},lastTask:null},ui:ui(),storageWarning:''});assert.ok(html.includes('入門の6タスク'));assert.equal((html.match(/class="task-row/g)||[]).length,6);});
test('reported scope cannot claim unobserved years as investigated',()=>{const t=tasks.find(t=>t.id==='i06');const s=blank(t);s.draft.from='1900-01-01';s.draft.to='2099-12-31';assert.equal(E.gradeTask(t,s.draft,[]).criteria.find(c=>c.id==='scope').passed,false);s.draft.from=t.periods.current.from;s.draft.to=t.periods.current.to;assert.equal(E.gradeTask(t,s.draft,[]).criteria.find(c=>c.id==='scope').passed,true);});

test('structured correlation values are labeled and actionable in logs and timeline',()=>{
  const base=tasks.find(t=>t.id==='i05'),t={...base,logs:[{...base.logs[0],id:'correlation-row',host:'WS-42',parent:'docview.exe',session:'0x248',pid:4410,process_guid:'PROC-44',parent_process_guid:'PROC-40',request_id:'REQ-4'}]};
  const s=blank(t),c={tasks:[t],saved:{taskStates:{[t.id]:s},lastTask:t.id},ui:ui(t),storageWarning:''};
  c.ui.filters.period='all';
  for(const tab of ['logs','timeline']){c.ui.tab=tab;const html=V.render(c);for(const field of ['parent','session','pid','process_guid','parent_process_guid','request_id'])assert.ok(html.includes('data-field="'+field+'"'),tab+' '+field);assert.match(html,/data-value="4410" data-host="WS-42"/);}
});

test('comparison shows ignored search/date filters but still compares full selected source',()=>{
  const t=tasks[0],s=blank(t),u=ui(t);u.tab='compare';u.filters={query:'__does_not_match__',source:'端末',host:'none',period:'baseline',from:'2026-09-01',to:'2026-09-02'};
  const html=V.render({tasks,saved:{taskStates:{[t.id]:s},lastTask:t.id},ui:u,storageWarning:''});
  assert.ok(html.includes('比較には適用されません'));assert.ok(html.includes('__does_not_match__'));assert.ok(html.includes('2026-09-01'));assert.ok(html.includes('class="compare-key"'));
});

test('field work starts with an escaped written hypothesis and collapsed candidate choices',()=>{
  const base=tasks.find(t=>t.id==='f01'),t={...base,hypothesisPrompt:'対象と期間を決める',modelHypothesis:'MODEL-HIDDEN-UNTIL-REQUEST'};
  const s=blank(t);s.draft.ownHypothesis='<img onerror="boom">';const u=ui(t);u.tab='plan';
  const html=V.render({tasks:[t],saved:{taskStates:{[t.id]:s},lastTask:t.id},ui:u,storageWarning:''});
  assert.ok(html.includes('data-draft="ownHypothesis"'));assert.ok(html.includes('&lt;img onerror=&quot;boom&quot;&gt;'));assert.ok(!html.includes('<img onerror='));assert.ok(html.includes('<details class="hypothesis-options">'));assert.ok(!html.includes(t.modelHypothesis));assert.ok(html.indexOf('自分の仮説を書く')<html.indexOf('教材の検証候補'));
});

test('checklist guidance presents every viewpoint without imposing a next step',()=>{
  const base=tasks.find(t=>t.id==='p04'),t={...base,guideMode:'checklist',guide:[{title:'viewpoint-one',body:'Inspect source',tab:'logs'},{title:'viewpoint-two',body:'Inspect scope',tab:'compare'}]};
  const s=blank(t),html=V.render({tasks:[t],saved:{taskStates:{[t.id]:s},lastTask:t.id},ui:ui(t),storageWarning:''});
  assert.ok(html.includes('調べる順序は自分で決める'));assert.ok(html.includes('viewpoint-one'));assert.ok(html.includes('viewpoint-two'));assert.ok(!html.includes('data-action="guide-next"'));
});
