'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');

const row = (id, patch = {}) => ({id, at:'2026-09-14T12:00:00Z', period:'current', source:'端末', host:'WS-01', device_id:'DEV-01', parent:'explorer.exe', process:'powershell.exe', destination:'collect.example', ...patch});
const corpus = [
  row('signal-1'), row('signal-2', {at:'2026-09-16T23:59:59.999Z'}),
  row('normal-1', {host:'WS-02', device_id:'DEV-02', destination:'updates.example'}),
  row('normal-2', {host:'WS-03', device_id:'DEV-03', process:'updater.exe'})
];
const validation = {
  logs:[row('fresh-signal', {host:'WS-09', device_id:'DEV-09'}), row('fresh-normal', {host:'WS-01', process:'updater.exe'})],
  expected:['fresh-signal']
};
const querySpec = {expected:['signal-1','signal-2'], filters:{period:'all'}, validation};
const query = 'process:powershell destination:collect.example';
const task = {
  id:'program', logs:corpus, assets:[{id:'DEV-01',host:'WS-01'},{id:'DEV-20',host:'NO-TELEMETRY'}],
  sources:[{name:'端末'}], hypotheses:[], findings:[], guide:[{title:'検証'}],
  choices:[{id:'limited',label:'限定した結論'},{id:'broad',label:'広い結論'}],
  selectionOptions:[{id:'proc',label:'プロセス'},{id:'network',label:'通信'},{id:'all',label:'すべて'}],
  rubric:{query:querySpec, choice:'limited', selections:['proc','network'], selfReview:true, reflection:true}
};
const answer = () => ({query, choice:'limited', selections:['network','proc'], ownHypothesis:'端末での起動と外部通信を検証する', reviewedHypothesis:'端末での起動と外部通信を検証する', reflection:'通常動作との比較が必要', reviewedReflection:'通常動作との比較が必要'});
const state = (draft = answer()) => ({draft, operations:[], completed:true, hintLevel:0, guideStep:0});
const progress = (states = {program:state()}, version = 3) => ({schemaVersion:version, taskStates:states, lastTask:Object.keys(states)[0] || null});

test('after/before include UTC calendar boundaries in each OR branch and respect global filters', () => {
  const logs = [row('before',{at:'2026-09-13T23:59:59.999Z'}),row('first',{at:'2026-09-14T00:00:00Z'}),row('last',{at:'2026-09-16T23:59:59.999Z'}),row('after',{at:'2026-09-17T00:00:00Z'}),row('offset-before',{at:'2026-09-14T08:59:59+09:00'}),row('other',{at:'2026-09-20T00:00:00Z',source:'通信'})];
  assert.deepEqual(E.filterLogs(logs,{query:'after:2026-09-14 before:2026-09-16',period:'all'}).map(l=>l.id),['first','last']);
  assert.deepEqual(E.filterLogs(logs,{query:'before:2026-09-13 OR after:2026-09-17',period:'all',source:'端末'}).map(l=>l.id),['before','after','offset-before']);
  assert.deepEqual(E.filterLogs(logs,{query:'AFTER:"2026-09-14" -before:2026-09-16',period:'all',to:'2026-09-17'}).map(l=>l.id),['after']);
  assert.deepEqual(E.filterLogs(logs,{query:'before:2026-09-13 OR after:2026-09-17',period:'all',from:'2026-09-14',to:'2026-09-17'}).map(l=>l.id),['after']);
});

test('query dates fail closed on impossible dates, timestamps, unclosed quotes and malformed OR', () => {
  for (const query of ['after:2026-02-30','before:2026-13-01','after:2026-9-14','before:2026-09-14T12:00:00Z','after:2026-09-14 OR','OR before:2026-09-14','after:"2026-09-14']) {
    assert.ok(E.parseQuery(query).errors.length,query);
    assert.deepEqual(E.filterLogs(corpus,{query,period:'all'}),[],query);
  }
  assert.deepEqual(E.parseQuery('after:2024-02-29').errors,[]);
  assert.deepEqual(E.filterLogs(corpus,{query:'after:2026-09-17 before:2026-09-14',period:'all'}),[]);
});

test('device IDs and hashes match whole identifiers, while raw Linux records remain searchable', () => {
  const logs=[row('same',{device_id:'dev-01',hash:'ABCD',raw:'sshd[42]: Accepted publickey for service'}),row('prefix',{device_id:'dev-010',hash:'ABCDE'}),row('missing',{device_id:undefined})];
  assert.deepEqual(E.filterLogs(logs,{query:'device_id:DEV-01 hash:abcd'}).map(l=>l.id),['same']);
  assert.deepEqual(E.filterLogs(logs,{query:'-device_id:DEV-01'}).map(l=>l.id),['prefix','missing']);
  assert.deepEqual(E.filterLogs(logs,{query:'"Accepted publickey"'}).map(l=>l.id),['same']);
});

test('rare parent-child aggregation keeps composite identities, missing fields, bytes and ascending counts', () => {
  const logs=[row('a'),row('b'),row('rare',{parent:'winword.exe',bytes:512}),row('missing',{parent:undefined,process:'sshd'}),row('collision-a',{parent:'a → b',process:'c'}),row('collision-b',{parent:'a',process:'b → c'})];
  const grouped=E.aggregateLogs(logs,'parent_process',{sort:'count-asc'});
  assert.equal(grouped.length,5);
  assert.equal(grouped.at(-1).count,2);
  assert.deepEqual(grouped.at(-1).values,{parent:'explorer.exe',process:'powershell.exe'});
  assert.equal(grouped.find(g=>g.values.parent==='winword.exe').bytes,512);
  assert.deepEqual(grouped.find(g=>g.values.process==='sshd').values,{parent:'',process:'sshd'});
  assert.equal(grouped.filter(g=>g.key==='a → b → c').length,2,'readable separator must not be used as the identity');
  assert.equal(E.aggregateLogs(logs,'parent_process')[0].count,2);
  assert.equal(E.aggregateLogs(logs,'host',{sort:'count-asc'})[0].count,6);
});

test('composite comparison reveals new pairs without merging different parents or periods', () => {
  const logs=[row('base',{period:'baseline'}),row('current'),row('new',{parent:'winword.exe'}),row('not-edr',{parent:'winword.exe',source:'通信'})];
  const compared=E.compareLogs(logs,'parent_process','端末');
  assert.deepEqual(compared.find(g=>g.values.parent==='winword.exe'),{key:'winword.exe → powershell.exe',values:{parent:'winword.exe',process:'powershell.exe'},baseline:0,current:1,delta:1,ratio:null});
  assert.equal(compared.find(g=>g.values.parent==='explorer.exe').delta,0);
});

test('query grading accepts equivalent expressions and uses fixed expected sets, not query string equality', () => {
  for (const alternate of [query,'destination:"collect.example" process:"PowerShell.exe"','process:powershell -destination:updates.example','process:powershell destination:collect.example OR process:powershell destination:collect.example']) {
    const result=E.gradeQuery(corpus,alternate,querySpec);
    assert.equal(result.passed,true,alternate);
    assert.deepEqual(result.matched,['signal-1','signal-2']);
    assert.deepEqual(result.missing,[]);assert.deepEqual(result.unexpected,[]);
    assert.equal(result.precision,1);assert.equal(result.recall,1);
    assert.equal(result.validation.passed,true);
  }
});

test('query grading explains extra matches and omissions with precision/recall', () => {
  const tooBroad=E.gradeQuery(corpus,'process:powershell',{expected:querySpec.expected});
  assert.equal(tooBroad.passed,false);assert.deepEqual(tooBroad.unexpected,['normal-1']);
  assert.equal(tooBroad.precision,2/3);assert.equal(tooBroad.recall,1);
  const tooNarrow=E.gradeQuery(corpus,'after:2026-09-16 process:powershell',{expected:querySpec.expected});
  assert.equal(tooNarrow.passed,false);assert.deepEqual(tooNarrow.missing,['signal-1']);
  assert.equal(tooNarrow.precision,1);assert.equal(tooNarrow.recall,0.5);
  const none=E.gradeQuery(corpus,'process:absent',{expected:querySpec.expected});
  assert.equal(none.precision,0);assert.equal(none.recall,0);
});

test('held-out records reject memorized IDs or host-only detection despite perfect visible results', () => {
  for (const overfit of ['"signal-1" OR "signal-2"','host:WS-01','device_id:DEV-01']) {
    const result=E.gradeQuery(corpus,overfit,querySpec);
    assert.deepEqual(result.missing,[],overfit);assert.deepEqual(result.unexpected,[],overfit);
    assert.equal(result.passed,false,overfit);assert.equal(result.validation.passed,false,overfit);
    assert.deepEqual(result.validation.missing,['fresh-signal'],overfit);
  }
});

test('query grading does not allow OR to escape fixed source, host, date or period constraints', () => {
  const logs=[row('expected'),row('baseline',{period:'baseline'}),row('other-source',{source:'通信'}),row('other-host',{host:'WS-02'}),row('future',{at:'2026-09-18T00:00:00Z'})];
  const result=E.gradeQuery(logs,'process:powershell OR host:WS-02',{expected:['expected'],filters:{period:'current',host:'WS-01',source:'端末',from:'2026-09-14',to:'2026-09-16'}});
  assert.equal(result.passed,true);assert.deepEqual(result.matched,['expected']);
});

test('fixed JST grading scope is inherited by independent validation and is separate from UTC query dates', () => {
  const rows=[row('local-first',{at:'2026-09-13T15:00:00Z',sensor:'edge-flow'}),row('local-last',{at:'2026-09-14T14:59:59.999Z',sensor:'edge-flow'}),row('next-day',{at:'2026-09-14T15:00:00Z',sensor:'edge-flow'}),row('different',{at:'2026-09-14T02:00:00Z',sensor:'endpoint-network'})];
  const spec={expected:['local-first','local-last'],filters:{period:'all',from:'2026-09-14',to:'2026-09-14',timezone:'Asia/Tokyo'},validation:{logs:rows.map(log=>({...log,id:'fresh-'+log.id})),expected:['fresh-local-first','fresh-local-last']}};
  const result=E.gradeQuery(rows,'sensor:EDGE-FLOW',spec);
  assert.equal(result.passed,true);assert.equal(result.validation.passed,true);
  assert.deepEqual(result.matched,['local-first','local-last']);
  const restricted=E.gradeQuery(rows,'sensor:edge-flow after:2026-09-14',spec);
  assert.equal(restricted.passed,false);assert.deepEqual(restricted.missing,['local-first']);assert.deepEqual(restricted.validation.missing,['fresh-local-first']);
  const invalid=E.gradeQuery(rows,'sensor:edge-flow',{...spec,filters:{...spec.filters,timezone:'JST'}});
  assert.equal(invalid.passed,false);assert.ok(invalid.errors.some(message=>message.includes('タイムゾーン')));
  assert.equal(invalid.validation.passed,false);
});

test('JST migration preserves old manual UTC dates, defaults undated exploration to JST and regrades saved queries', () => {
  const localTask={...task,part:2,periods:{timezone:'Asia/Tokyo',current:{from:'2026-09-14',to:'2026-09-16'},baseline:{from:'2026-09-07',to:'2026-09-09'}},logs:[row('early',{at:'2026-09-13T18:00:00Z',sensor:'edge-flow'})],rubric:{query:{expected:['early'],filters:{period:'current',from:'2026-09-14',to:'2026-09-16',timezone:'Asia/Tokyo'}}}};
  for(const version of [1,2,3]) {
    const input=progress({program:state({query:'sensor:edge-flow after:2026-09-14',summary:'9月14日 03:00の旧時刻メモ'})},version);
    input.taskStates.program.filters={from:'2026-09-14',to:'2026-09-15',query:'after:2026-09-14'};
    const output=E.validateProgress(input,[localTask]),restored=output.taskStates.program;
    assert.equal(output.migrated,true);assert.equal(restored.filters.timezone,'UTC');
    assert.equal(restored.filters.from,'2026-09-14');assert.equal(restored.filters.to,'2026-09-15');
    assert.equal(restored.filters.query,'after:2026-09-14');assert.equal(restored.draft.query,input.taskStates.program.draft.query);
    assert.equal(restored.draft.summary,input.taskStates.program.draft.summary);
    assert.equal(restored.completed,false,'an old UTC query excluding the rebased early record needs review');
    const {migrated,...persisted}=output;
    assert.deepEqual(E.validateProgress(persisted,[localTask]),persisted,'explicit UTC is retained without repeating the migration');
    input.taskStates.program.filters={query:'sensor:edge-flow'};
    assert.equal(E.validateProgress(input,[localTask]).taskStates.program.filters.timezone,'Asia/Tokyo');
    input.taskStates.program.filters={from:'2026-09-14',to:'2026-09-15',timezone:'Asia/Tokyo'};
    input.taskStates.program.draft.query='sensor:edge-flow';
    const updated=E.validateProgress(input,[localTask]).taskStates.program;
    assert.equal(updated.filters.timezone,'Asia/Tokyo');assert.equal(updated.completed,true);
  }
  for(const timezone of ['JST','local',false,{},5]) {
    const bad=progress();bad.taskStates.program.filters={timezone};
    assert.throws(()=>E.validateProgress(bad,[localTask]),/タイムゾーン/);
  }
  const scoped={...localTask,rubric:{scope:true}};
  assert.equal(E.gradeTask(scoped,{from:'2026-09-14',to:'2026-09-16'},[]).passed,true);
  assert.match(E.gradeTask(scoped,{from:'2026-09-13',to:'2026-09-16'},[]).criteria[0].detail,/JST/);
  const nested={...localTask,periods:{...localTask.periods,timezone:undefined,current:{...localTask.periods.current,timezone:'Asia/Tokyo'}}};
  assert.equal(E.validateProgress(progress(),[nested]).taskStates.program.filters.timezone,'Asia/Tokyo');
});

test('invalid queries and malformed expected corpora return errors instead of successful empty matches', () => {
  for(const badQuery of ['unknown:value','after:2026-02-30','host:WS-01 OR',123,null]) {
    const result=E.gradeQuery(corpus,badQuery,querySpec);
    assert.equal(result.passed,false);assert.ok(result.errors.length);assert.deepEqual(result.matched,[]);
  }
  for(const spec of [{expected:[]},{expected:['unknown']},{expected:['signal-1','signal-1']},{expected:['signal-1'],filters:{period:'invalid'}},{expected:['signal-1'],filters:{from:'2026-02-30'}},{expected:['signal-1'],filters:{from:'2026-09-16',to:'2026-09-14'}}]) {
    assert.ok(E.gradeQuery(corpus,query,spec).errors.length,JSON.stringify(spec));
  }
  assert.ok(E.gradeQuery([...corpus,corpus[0]],query,querySpec).errors.length);
  assert.ok(E.gradeQuery(null,query,querySpec).errors.length);
  assert.equal(E.gradeQuery(corpus,query,{...querySpec,validation:{logs:[],expected:[]}}).passed,false);
});

test('new rubric criteria grade choice, exact selections, query results and exact self-review snapshots', () => {
  const draft=answer();
  const result=E.gradeTask(task,draft,[]);
  assert.equal(result.passed,true);
  assert.equal(result.criteria.find(c=>c.id==='query').result,result.query);
  for(const patch of [{choice:'broad'},{selections:['proc']},{selections:['proc','network','all']},{query:'host:WS-01'},{ownHypothesis:'編集済み'},{reflection:'考察を編集'}]) {
    assert.equal(E.gradeTask(task,{...draft,...patch},[]).passed,false,JSON.stringify(patch));
  }
  const arbitrary='<img src=x onerror=alert(1)>文字列の意味は自動採点しない';
  assert.equal(E.gradeTask(task,{...draft,ownHypothesis:arbitrary,reviewedHypothesis:arbitrary,reflection:arbitrary,reviewedReflection:arbitrary},[]).passed,true);
  assert.equal(E.gradeTask(task,{...draft,ownHypothesis:'  ',reviewedHypothesis:'  '},[]).passed,false);
  assert.equal(E.gradeTask(task,{...draft,reflection:'\n',reviewedReflection:'\n'},[]).passed,false);
});

test('benign alternative reasoning is graded independently from correctly selected comparison evidence', () => {
  const item={...task,alternativeExplanations:[{id:'scope-mismatch',label:'比較した業務の範囲が一致しない'},{id:'same-tool',label:'同名なので同じ業務と判断する'},{id:'no-comparison',label:'比較せず保留する'}],rubric:{...task.rubric,alternative:'scope-mismatch'}};
  const correct={...answer(),alternative:'scope-mismatch'};
  assert.equal(E.gradeTask(item,correct,[]).passed,true);
  for(const alternative of ['',undefined,'same-tool','no-comparison','unknown']) {
    const grade=E.gradeTask(item,{...correct,alternative},[]);
    assert.equal(grade.passed,false,String(alternative));
    const criterion=grade.criteria.find(row=>row.id==='alternative');
    assert.equal(criterion.label,'良性の説明を検討した結果');assert.equal(criterion.passed,false);
    assert.equal(grade.criteria.filter(row=>!row.passed).length,1,'the new reasoning decision is independently required');
  }
  assert.equal(E.gradeTask({...item,alternativeExplanations:[]},correct,[]).passed,false,'rubric IDs must also exist in the choices');
  for(const version of [1,2,3]) {
    const old=progress({program:state(answer())},version);
    old.taskStates.program.draft.summary='以前の調査メモ';
    const imported=E.validateProgress(old,[item]);
    assert.equal(imported.migrated,true,'a newly required decision must show a migration notice even for schema3');
    assert.equal(imported.taskStates.program.draft.alternative,'');
    assert.equal(imported.taskStates.program.completed,false);
    assert.equal(imported.taskStates.program.draft.summary,'以前の調査メモ');
    assert.equal(E.validateProgress(progress({program:state(correct)},version),[item]).taskStates.program.completed,true);
    assert.throws(()=>E.validateProgress(progress({program:state({...correct,alternative:'unknown'})},version),[item]),/良性の説明/);
  }
});

test('time display preferences round-trip without changing UTC filters or completion', () => {
  for(const version of [1,2,3]) {
    const old=progress(undefined,version);
    assert.equal(E.validateProgress(old,[task]).timeDisplay,'utc');
    const saved=E.validateProgress({...old,timeDisplay:'utc-jst'},[task]);
    assert.equal(saved.timeDisplay,'utc-jst');
    assert.equal(saved.taskStates.program.completed,true);
    assert.deepEqual(saved.taskStates,E.validateProgress({...old,timeDisplay:'utc'},[task]).taskStates);
    const {migrated, ...persisted}=saved;
    assert.deepEqual(E.validateProgress(JSON.parse(JSON.stringify(saved)),[task]),persisted);
  }
  for(const bad of ['jst','local',12,false,{}])assert.throws(()=>E.validateProgress({...progress(),timeDisplay:bad},[task]),/時刻表示/);
});

test('query criteria show Japanese diagnosis for main and held-out failures', () => {
  const result=E.gradeTask(task,{...answer(),query:'host:WS-01'},[]);
  const criterion=result.criteria.find(c=>c.id==='query');
  assert.equal(criterion.passed,false);assert.match(criterion.detail,/別の検証記録/);assert.match(criterion.detail,/fresh-signal/);
  assert.match(E.gradeTask(task,{...answer(),query:'after:2026-02-30'},[]).criteria.find(c=>c.id==='query').detail,/実在する日付/);
});

test('schema3 stores exploration separately from submitted queries and preserves inert prose', () => {
  const input=progress();
  input.taskStates.program.filters={query:'host:NO-TELEMETRY',source:'端末',host:'NO-TELEMETRY',period:'all',from:'2026-09-14',to:'2026-09-16'};
  input.taskStates.program.tutorialActions=['read-brief','opened-log'];
  const normalized=E.validateProgress(input,[task]);
  const saved=normalized.taskStates.program;
  assert.equal(saved.completed,true);assert.equal(saved.draft.query,query);
  assert.deepEqual(saved.filters,{...input.taskStates.program.filters,timezone:'UTC'});
  assert.deepEqual(saved.tutorialActions,['read-brief','opened-log']);
  assert.deepEqual(E.validateProgress(JSON.parse(JSON.stringify(normalized)),[task]),normalized);
});

test('active tutorial resume is separate from the last normal task, with explicit null for the home screen', () => {
  const tutorial={...task,id:'tutorial'};
  const input={...progress({program:state(),tutorial:state()}),activeTask:'tutorial',lastTask:'program'};
  const active=E.validateProgress(input,[task,tutorial]);
  assert.equal(active.activeTask,'tutorial');assert.equal(active.lastTask,'program');
  assert.equal(E.validateProgress({...input,activeTask:null},[task,tutorial]).activeTask,null);
  assert.equal(E.validateProgress(progress(),[task]).activeTask,null,'older schema3 files do not force tutorial resumption');
  for(const version of [1,2]) assert.equal(E.validateProgress(progress(undefined,version),[task]).activeTask,'program');
  for(const invalid of ['missing',17,false,{}]) assert.throws(()=>E.validateProgress({...input,activeTask:invalid},[task,tutorial]),/現在開いているタスク/);
});

test('v2 migration preserves original investigation completion and initializes a separate exit', () => {
  const original={...task,id:'original',rubric:{choice:'limited'},exit:{kind:'query',title:'出口',rubric:{query:querySpec}}};
  const input=progress({original:state({choice:'limited',summary:'旧版の調査メモ'})},2);
  const output=E.validateProgress(input,[original]);
  assert.equal(output.schemaVersion,3);assert.equal(output.migrated,true);
  const saved=output.taskStates.original;
  assert.equal(saved.completed,true);assert.equal(saved.exitCompleted,false);
  assert.equal(saved.draft.summary,'旧版の調査メモ');assert.equal(saved.exitDraft.query,'');
  assert.deepEqual(saved.filters,{query:'',source:'',host:'',period:'current',from:'',to:'',timezone:'UTC'});
  assert.equal(input.taskStates.original.exitDraft,undefined,'migration must not change its input');
});

test('editing reviewed text invalidates only the affected snapshot and task', () => {
  const other={...task,id:'other'};
  const input=progress({program:state(),other:state()});
  input.taskStates.program.draft.ownHypothesis='比較した後の編集';
  const output=E.validateProgress(input,[task,other]);
  assert.equal(output.taskStates.program.completed,false);
  assert.equal(output.taskStates.program.draft.reviewedHypothesis,'');
  assert.equal(output.taskStates.program.draft.reviewedReflection,answer().reflection);
  assert.equal(output.taskStates.other.completed,true);
  input.taskStates.program.draft=answer();input.taskStates.program.draft.reflection='比較した後の考察';
  const updated=E.validateProgress(input,[task,other]);
  assert.equal(updated.taskStates.program.draft.reviewedReflection,'');assert.equal(updated.taskStates.program.completed,false);
});

test('syntactically unfinished submitted or exploratory queries survive import without wiping other tasks', () => {
  const other={...task,id:'other'};
  const input=progress({program:state({...answer(),query:'process:"途中'}),other:state()});
  input.taskStates.program.filters={query:'after:2026-02-30',period:'all'};
  const output=E.validateProgress(input,[task,other]);
  assert.equal(output.taskStates.program.draft.query,'process:"途中');
  assert.equal(output.taskStates.program.filters.query,'after:2026-02-30');
  assert.equal(output.taskStates.program.completed,false);assert.equal(output.taskStates.other.completed,true);
});

test('asset inventory can select hosts with zero logs and reject invented hosts', () => {
  const inventory={...task,logs:[],rubric:{targets:['NO-TELEMETRY']}};
  const saved=E.validateProgress(progress({program:state({targets:['NO-TELEMETRY']})}),[inventory]).taskStates.program;
  assert.equal(saved.completed,true);assert.deepEqual(saved.draft.targets,['NO-TELEMETRY']);
  assert.throws(()=>E.validateProgress(progress({program:state({targets:['invented']})}),[inventory]),/対象端末/);
});

test('exit grading uses its own corpus when provided, while stored completion requires investigation success', () => {
  const exitLogs=[row('exit-signal',{process:'curl'}),row('exit-normal',{process:'sshd'})];
  const exitTask={...task,rubric:{choice:'limited'},exit:{kind:'query',logs:exitLogs,rubric:{query:{expected:['exit-signal'],filters:{period:'all'}}}}};
  assert.equal(E.gradeExit(exitTask,{query:'process:curl'}).passed,true);
  assert.equal(E.gradeExit(exitTask,{query}).passed,false);
  const input=progress({program:{...state({choice:'broad'}),exitDraft:{query:'process:curl'},exitCompleted:true}});
  let output=E.validateProgress(input,[exitTask]).taskStates.program;
  assert.equal(output.completed,false);assert.equal(output.exitCompleted,false);
  input.taskStates.program.draft.choice='limited';
  output=E.validateProgress(input,[exitTask]).taskStates.program;
  assert.equal(output.completed,true);assert.equal(output.exitCompleted,true);
  input.taskStates.program.exitDraft.query='process:sshd';
  output=E.validateProgress(input,[exitTask]).taskStates.program;
  assert.equal(output.completed,true);assert.equal(output.exitCompleted,false);
});

test('handoff exits accept structured choices plus a current reflection acknowledgment without prose semantics', () => {
  const exitTask={...task,exit:{kind:'handoff',choices:[{id:'handoff'}],selectionOptions:[{id:'timeline'},{id:'scope'}],rubric:{choice:'handoff',selections:['timeline','scope'],reflection:true}}};
  const draft={choice:'handoff',selections:['scope','timeline'],reflection:'自分の引継ぎ判断',reviewedReflection:'自分の引継ぎ判断'};
  assert.equal(E.gradeExit(exitTask,draft).passed,true);
  assert.equal(E.gradeExit(exitTask,{...draft,reflection:'変更後の判断'}).passed,false);
  const output=E.validateProgress(progress({program:{...state(),exitDraft:draft}}),[exitTask]).taskStates.program;
  assert.equal(output.exitCompleted,true);assert.deepEqual(output.exitDraft.selections,['scope','timeline']);
});

test('schema3 validates new field bounds, enums and date ranges without accepting tampered completion', () => {
  const mutations=[
    s=>{s.draft.query='q'.repeat(2001);},s=>{s.draft.choice='unknown';},s=>{s.draft.selections=['unknown'];},
    s=>{s.draft.reflection='考'.repeat(4001);},s=>{s.draft.reviewedHypothesis='仮'.repeat(4001);},
    s=>{s.tutorialActions=['viewed-secrets'];},s=>{s.filters={period:'future'};},
    s=>{s.filters={host:'ghost'};},s=>{s.filters={source:'invented'};},s=>{s.filters={from:'2026-09-16',to:'2026-09-14'};},
    s=>{s.exitDraft={query:123};},s=>{s.filters=JSON.parse('{"__proto__":{}}');}
  ];
  for(const mutate of mutations) {
    const input=progress();mutate(input.taskStates.program);
    assert.throws(()=>E.validateProgress(input,[task]),/進捗ファイルを読み込めません/);
  }
  const input=progress();input.taskStates.program.draft.query='host:WS-01';
  assert.equal(E.validateProgress(input,[task]).taskStates.program.completed,false);
});

test('39 full-length learning notes fit the expanded progress budget and oversized imports still fail', () => {
  const tasks=Array.from({length:39},(_,i)=>({...task,id:'task-'+i}));
  const text='学'.repeat(4000),summary='記'.repeat(12000),taskStates={};
  for(const item of tasks) taskStates[item.id]=state({...answer(),ownHypothesis:text,reviewedHypothesis:text,reflection:text,reviewedReflection:text,summary});
  const input={schemaVersion:3,taskStates,lastTask:'task-38'};
  assert.ok(JSON.stringify(input).length>1000000,'regression must exceed the former limit');
  assert.equal(Object.values(E.validateProgress(input,tasks).taskStates).filter(s=>s.completed).length,39);
  assert.throws(()=>E.validateProgress({...input,padding:'x'.repeat(4000000)},tasks),/上限4MB/);
});

function authoredAnswer(item) {
  if(item.rubric.openHunt)return require('./support/capstone.cjs').answer(item);
  const rubric=item.rubric || {}, evidence=[];
  for(const group of rubric.evidenceGroups || []) {
    if(!evidence.some(e=>e.id===group.anyOf[0])) evidence.push({id:group.anyOf[0],role:group.role,note:''});
  }
  const ownHypothesis=rubric.selfReview ? (item.modelHypothesis || '自分の仮説をモデルと比較した') : '';
  const reflection=rubric.reflection ? (item.modelReflection || '自分の考察をモデルと比較した') : '';
  return {
    hypothesis:(rubric.hypotheses || [])[0] || '',targets:rubric.targets || [],verdict:rubric.verdict || '',sources:rubric.sources || [],
    from:item.periods?.current.from || '',to:item.periods?.current.to || '',finding:rubric.finding || '',evidence,summary:'',
    choice:rubric.choice || '',alternative:rubric.alternative || '',selections:rubric.selections || [],query:item.explanation?.sampleQuery || '',
    ownHypothesis,reviewedHypothesis:ownHypothesis,reflection,reviewedReflection:reflection
  };
}

test('catalog has 38 main tasks plus tutorial, shared immutable IDs and asset-aware target inventories', () => {
  const {tasks,environments}=require('../src/catalog.cjs');
  assert.equal(tasks.length,40);assert.equal(tasks.filter(t=>t.optional).length,1);assert.equal(tasks.filter(t=>t.part===1).length,15);assert.equal(tasks.filter(t=>t.part===2).length,23);
  const shared=environments.aonagi;
  assert.equal(shared.assets.length,20);assert.equal(new Set(shared.assets.map(a=>a.id)).size,20);assert.equal(new Set(shared.assets.map(a=>a.host)).size,20);
  assert.equal(shared.assets.filter(a=>a.category==='workstation').length,15);
  assert.equal(shared.assets.filter(a=>a.category==='server').length,5);
  assert.equal(new Set(shared.logs.map(l=>l.id)).size,shared.logs.length);
  const canonical=new Map(shared.logs.map(l=>[l.id,l]));
  for(const log of shared.logs) {
    assert.ok(shared.sources.some(s=>s.name===log.source),log.id+' source');
    assert.ok(shared.assets.some(a=>a.device_id===log.device_id),log.id+' stable device identity');
    assert.ok(['current','baseline'].includes(log.period),log.id+' period');
    assert.ok(Number.isFinite(Date.parse(log.at)),log.id+' timestamp');
    const range=shared.periods[log.period], timezone=shared.periods.timezone||range.timezone||'UTC';
    const date=new Date(Date.parse(log.at)+(timezone==='Asia/Tokyo'?9*3600000:0)).toISOString().slice(0,10);
    assert.ok(date>=range.from && date<=range.to,log.id+' timestamp outside period');
  }
  const distribution={};
  for(const item of tasks.filter(t=>t.part===2)) {
    distribution[item.chapter]=(distribution[item.chapter] || 0)+1;
    assert.equal(item.assets,shared.assets,item.id+' asset catalog must not depend on previous completion');
    assert.deepEqual(item.logs.map(l=>l.id),item.logIds,item.id+' fixed snapshot order');
    assert.equal(new Set(item.logIds).size,item.logIds.length,item.id+' duplicate log IDs');
    item.logs.forEach(log=>assert.equal(log,canonical.get(log.id),item.id+' canonical log '+log.id));
    (item.rubric.targets || []).forEach(host=>assert.ok(shared.assets.some(a=>a.host===host),item.id+' unknown target '+host));
  }
  assert.deepEqual(distribution,{A:4,B:3,C:5,D:3,E:3,L:3,G:2});
});

test('all authored tasks and exits have reachable answers and round-trip through schema3 without losing completion', () => {
  const {tasks}=require('../src/catalog.cjs');
  const taskStates={};
  for(const item of tasks) {
    const ids=new Set(item.logs.map(l=>l.id)), rubric=item.rubric, draft=authoredAnswer(item);
    for(const group of rubric.evidenceGroups || []) {
      assert.ok(group.anyOf.length,item.id+' empty evidence group');
      group.anyOf.forEach(id=>assert.ok(ids.has(id),item.id+' absent evidence '+id));
    }
    for(const extra of rubric.evidenceExtras || []) {
      assert.ok(ids.has(extra.id),item.id+' unknown extra '+extra.id);
      assert.ok(extra.reason?.trim(),item.id+' missing extra explanation');
      assert.ok(Array.isArray(extra.roles) && extra.roles.length,item.id+' extra needs roles');
      assert.equal(new Set(extra.roles).size,extra.roles.length,item.id+' duplicate roles');
      extra.roles.forEach(role=>assert.ok(['support','counter','context','gap'].includes(role),item.id+' invalid role'));
      if(!draft.evidence.some(e=>e.id===extra.id) && draft.evidence.length<8) {
        for(const role of extra.roles) assert.equal(E.gradeTask(item,{...draft,evidence:[...draft.evidence,{id:extra.id,role}]},rubric.operations || []).passed,true,item.id+' accepted supplementary role '+extra.id+'/'+role);
      }
    }
    if(rubric.query) assert.ok(draft.query,item.id+' query needs sampleQuery');
    const graded=E.gradeTask(item,draft,rubric.operations || []);
    assert.equal(graded.passed,true,item.id+' unreachable answer '+JSON.stringify(graded.criteria.filter(c=>!c.passed)));
    const saved={draft,operations:rubric.operations || [],completed:false,hintLevel:0,guideStep:0};
    if(item.exit) {
      saved.exitDraft=authoredAnswer(item.exit);
      if(item.exit.rubric.query) {
        assert.ok(saved.exitDraft.query,item.id+' exit needs sampleQuery');
        assert.ok(item.exit.rubric.query.validation,item.id+' detection exit needs held-out records');
      }
      const exitGrade=E.gradeExit(item,saved.exitDraft);
      assert.equal(exitGrade.passed,true,item.id+' unreachable exit '+JSON.stringify(exitGrade.criteria.filter(c=>!c.passed)));
    }
    taskStates[item.id]=saved;
  }
  const normalized=E.validateProgress({schemaVersion:3,taskStates,lastTask:'g02'},tasks);
  for(const item of tasks) {
    assert.equal(normalized.taskStates[item.id].completed,true,item.id+' completion lost on import');
    assert.equal(normalized.taskStates[item.id].exitCompleted,Boolean(item.exit),item.id+' exit completion');
  }
  const {migrated,...persisted}=normalized;
  assert.deepEqual(E.validateProgress(JSON.parse(JSON.stringify(persisted)),tasks),persisted);
  assert.equal(tasks.filter(t=>t.exit).length,9);
});

test('authored held-out query exercises reject visible ID enumeration', () => {
  const {tasks}=require('../src/catalog.cjs');
  let checked=0;
  for(const item of tasks) for(const exercise of [item,item.exit].filter(Boolean)) {
    const spec=exercise.rubric.query;
    if(!spec?.validation) continue;
    const enumerated=spec.expected.map(id=>'"'+id.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"').join(' OR ');
    assert.equal(E.gradeQuery(exercise.logs || item.logs,enumerated,spec).passed,false,item.id+' held-out corpus reuses enough IDs to accept memorization');
    checked++;
  }
  assert.ok(checked>0,'at least the detection exits must validate on unseen records');
});

test('schema2 report shapes preserve current passing investigations independently of new exits', () => {
  const {tasks}=require('../src/catalog.cjs');
  const original=tasks.filter(t=>t.part===1), taskStates={};
  for(const item of original) {
    const complete=authoredAnswer(item);
    const {query,choice,selections,reflection,reviewedReflection,reviewedHypothesis,...v2Draft}=complete;
    taskStates[item.id]={draft:v2Draft,operations:item.rubric.operations || [],completed:true,hintLevel:0,guideStep:0};
  }
  const normalized=E.validateProgress({schemaVersion:2,taskStates,lastTask:'f03'},tasks);
  assert.equal(normalized.migrated,true);assert.equal(normalized.schemaVersion,3);
  for(const item of original) {
    assert.equal(normalized.taskStates[item.id].completed,true,item.id+' original investigation was reset');
    assert.equal(normalized.taskStates[item.id].exitCompleted,false,item.id+' new exit must start uncompleted');
  }
});

test('authored source rubrics reject blanket selection whenever unnecessary sources are available', () => {
  const {tasks}=require('../src/catalog.cjs');
  let checked=0;
  for(const item of tasks) {
    const required=item.rubric.sources;
    if(!required)continue;
    const all=item.sources.map(source=>source.name),surplus=all.filter(source=>!required.includes(source));
    const draft=authoredAnswer(item);
    assert.equal(E.gradeTask(item,draft,item.rubric.operations || []).criteria.find(c=>c.id==='sources').passed,true,item.id+' specified sources must remain accepted');
    if(!surplus.length)continue;
    const result=E.gradeTask(item,{...draft,sources:all},item.rubric.operations || []);
    const criterion=result.criteria.find(c=>c.id==='sources');
    assert.equal(result.passed,false,item.id+' blanket selection');assert.equal(criterion.passed,false,item.id);
    assert.match(criterion.detail,/過剰：/,item.id);for(const source of surplus)assert.ok(criterion.detail.includes(source),item.id+' needs source diagnosis');
    checked++;
  }
  assert.ok(checked>0,'regression must exercise tasks with unnecessary available sources');
});

function publishedCatalog() {
  const catalog=require('../src/catalog.cjs');
  const {createPublicBundle}=require('../src/public-data.cjs');
  const bundle=createPublicBundle(catalog);
  const tasks=bundle.tasks.map(item=>{
    if(!item.environment)return item;
    const environment=bundle.environments[item.environment],byId=new Map(environment.logs.map(log=>[log.id,log]));
    return {...item,assets:environment.assets,logs:item.logIds.map(id=>byId.get(id))};
  });
  return {...catalog,bundle,publicTasks:tasks};
}

test('published entity identities remove exercise hints consistently and retain record IDs, values and shared updates', () => {
  const {tasks,bundle,publicTasks}=publishedCatalog();
  const {createPublicBundle,recordId}=require('../src/public-data.cjs');
  assert.equal(bundle.version,6);
  const reversed=createPublicBundle({tasks:[...tasks].reverse(),environments:require('../src/catalog.cjs').environments});
  const collect=item=>[...(item.logs||[]),...(item.rubric.query?.validation?.logs||[]),...(item.exit?.rubric?.query?.validation?.logs||[])];
  for(const item of tasks.filter(task=>task.part===1)) {
    const publicTask=publicTasks.find(task=>task.id===item.id);
    assert.deepEqual(publicTask.entityAliases,reversed.tasks.find(task=>task.id===item.id).entityAliases,item.id+' order-independent identity');
    const publishedRecords=new Map(collect(publicTask).map(log=>[log.id,log]));
    for(const log of collect(item)) {
      const result=publishedRecords.get(recordId(log.id));
      assert.ok(result,item.id+' stable record ID '+log.id);
      for(const field of ['at','period','bytes','pid','source','process','parent','hash'])assert.equal(result[field],log[field],item.id+' unchanged observation '+field);
      for(const [field,aliases] of Object.entries(publicTask.entityAliases.fields)) if(log[field])assert.equal(result[field],aliases[log[field]]||log[field],item.id+' '+field);
    }
    const visible={...publicTask,entityAliases:undefined,logAliases:undefined,legacy:undefined};
    assert.doesNotMatch(JSON.stringify(visible),/(?:WS-F[12]-|CLOUD-F3-|F1-[PBN]\d|P1-P\d|relay-p6\.example|N6-1032|REQ-i01-)/,item.id+' old pedagogic identifier');
    const draft=authoredAnswer(publicTask);
    assert.equal(E.gradeTask(publicTask,draft,publicTask.rubric.operations||[]).passed,true,item.id+' public investigation answer');
    if(publicTask.exit)assert.equal(E.gradeExit(publicTask,authoredAnswer(publicTask.exit)).passed,true,item.id+' public exit answer');
  }
  assert.equal(publicTasks.find(task=>task.id==='c01').entityAliases,undefined,'Part 2 identities retain their native shape');
  const oldA=tasks.find(task=>task.id==='p01'),oldB=tasks.find(task=>task.id==='p06');
  const publicA=publicTasks.find(task=>task.id==='p01'),publicB=publicTasks.find(task=>task.id==='p06');
  const updates=oldB.logs.filter(log=>log.request_id?.startsWith('UPDATE-'));
  assert.ok(updates.length>=6);
  for(const log of updates) {
    const other=oldA.logs.find(candidate=>candidate.request_id===log.request_id);assert.ok(other);
    const {id:unusedA,...left}=publicA.logs.find(candidate=>candidate.id===recordId(other.id));
    const {id:unusedB,...right}=publicB.logs.find(candidate=>candidate.id===recordId(log.id));
    assert.deepEqual(left,right,log.request_id+' shared update facts');
  }
});

test('genuine v0.4 progress keeps rec-ID evidence and notes while migrating entities and requiring the new decision', () => {
  const previous=require('./fixtures/v04-progress.json');
  const {publicTasks}=publishedCatalog();
  const imported=E.validateProgress(previous,publicTasks);
  assert.equal(imported.migrated,true);
  assert.equal(Object.keys(imported.taskStates).length,39);
  const required=publicTasks.filter(task=>task.rubric.alternative);
  assert.equal(required.length,6);
  for(const task of publicTasks.filter(t=>!t.optional)) {
    const before=previous.taskStates[task.id],after=imported.taskStates[task.id];
    assert.ok(before.completed,task.id+' fixture is an actual previous completion');
    assert.equal(after.draft.summary,before.draft.summary,task.id+' original notes');
    assert.deepEqual(after.draft.evidence,before.draft.evidence,task.id+' unchanged rec-ID evidence');
    assert.deepEqual(after.draft.targets,before.draft.targets.map(host=>task.entityAliases?.fields.host[host]||host),task.id+' target rename');
    for(const key of ['ownHypothesis','reflection','limitations','nextAction'])assert.equal(after.draft[key],before.draft[key]||'',task.id+' unchanged learner '+key);
    if(task.rubric.alternative){assert.equal(after.draft.alternative,'');assert.equal(after.completed,false,task.id+' new comparison decision requires review');}
  }
  const f01=publicTasks.find(task=>task.id==='f01'),restored=imported.taskStates.f01;
  assert.ok(restored.draft.targets.every(host=>!host.startsWith('WS-F1-')));
  restored.draft.alternative=f01.rubric.alternative;
  const regraded=E.validateProgress(imported,publicTasks);
  assert.equal(regraded.taskStates.f01.completed,true,'old evidence remains sufficient once the new decision is answered');
  const {migrated,...persisted}=regraded;
  assert.deepEqual(E.validateProgress(JSON.parse(JSON.stringify(persisted)),publicTasks),persisted);
});

test('real public entity aliases migrate v0.4 structured OR queries while preserving original free-form observations', () => {
  const previous=JSON.parse(JSON.stringify(require('./fixtures/v04-progress.json')));
  const {publicTasks}=publishedCatalog(),task=publicTasks.find(item=>item.id==='f01');
  const aliases=task.entityAliases.fields,old=previous.taskStates.f01;
  const oldHost='WS-F1-02',oldGuid='F1-P88';
  old.draft.query=`host:"${oldHost}" process_guid:"${oldGuid}" OR -parent_process_guid:${oldGuid}`;
  old.filters={...old.filters,host:oldHost,query:`"${oldGuid}" OR host:${oldHost}`};
  old.exitDraft.query=`process_guid:${oldGuid}`;
  old.draft.ownHypothesis=`${oldHost} の ${oldGuid} は確認した旧識別子`;
  old.draft.summary=old.draft.ownHypothesis;
  const restored=E.validateProgress(previous,publicTasks).taskStates.f01;
  assert.equal(restored.draft.query,`host:"${aliases.host[oldHost]}" process_guid:"${aliases.process_guid[oldGuid]}" OR -parent_process_guid:${aliases.parent_process_guid[oldGuid]}`);
  assert.equal(restored.filters.query,`"${aliases.process_guid[oldGuid]}" OR host:${aliases.host[oldHost]}`);
  assert.equal(restored.filters.host,aliases.host[oldHost]);
  assert.equal(restored.exitDraft.query,`process_guid:${aliases.process_guid[oldGuid]}`);
  assert.equal(restored.draft.ownHypothesis,old.draft.ownHypothesis);assert.equal(restored.draft.summary,old.draft.summary);
});

test('genuine v0.5 progress keeps manual UTC date meaning and learner text when Aonagi adopts JST business dates', () => {
  const previous=require('./fixtures/v05-progress.json');
  const {publicTasks}=publishedCatalog();
  const restored=E.validateProgress(previous,publicTasks);
  assert.equal(restored.migrated,true);assert.equal(Object.keys(restored.taskStates).length,39);
  for(const task of publicTasks.filter(t=>!t.optional)) {
    const before=previous.taskStates[task.id],after=restored.taskStates[task.id];
    assert.equal(before.completed,true,task.id+' actual v0.5 completion');
    assert.deepEqual(after.draft.evidence,before.draft.evidence,task.id+' record identities and notes survive');
    for(const field of ['query','summary','ownHypothesis','reflection','limitations','nextAction','from','to'])assert.equal(after.draft[field],before.draft[field]||'',task.id+' retained '+field);
    assert.equal(after.filters.from,before.filters.from);assert.equal(after.filters.to,before.filters.to);
    assert.equal(after.filters.query,before.filters.query);
    const expected=task.part===2&&!before.filters.from&&!before.filters.to?'Asia/Tokyo':'UTC';
    assert.equal(after.filters.timezone,expected,task.id+' explicit date basis');
    if(task.part!==2)assert.equal(after.completed,true,task.id+' UTC course is unchanged');
  }
  const a01=publicTasks.find(task=>task.id==='a01'),filters=restored.taskStates.a01.filters;
  assert.equal(filters.timezone,'UTC');assert.equal(filters.from,'2026-09-14');assert.equal(filters.to,'2026-09-15');
  assert.notDeepEqual(E.filterLogs(a01.logs,filters).map(row=>row.id),E.filterLogs(a01.logs,{...filters,timezone:'Asia/Tokyo'}).map(row=>row.id),
    'preserving UTC matters: silently retagging the same dates would select different actual records');
  assert.match(restored.taskStates.c02.draft.query,/after:2026-09-14 before:2026-09-16/,'explicit UTC query operators are never rewritten');
  const {migrated,...persisted}=restored;
  assert.deepEqual(E.validateProgress(JSON.parse(JSON.stringify(persisted)),publicTasks),persisted);
});
