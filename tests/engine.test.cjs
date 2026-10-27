'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../src/engine.js');

const logs = [
  {id:'a1',at:'2026-09-14T00:00:00Z',period:'current',source:'通信',host:'WS-01',user:'aoki',event:'外部通信',detail:'通常の同期処理',destination:'sync.example',process:'agent.exe',bytes:100},
  {id:'a2',at:'2026-09-16T23:59:59.999Z',period:'current',source:'通信',host:'WS-01',user:'aoki',event:'外部通信',detail:'定期的な接続',destination:'sync.example',process:'agent.exe',bytes:200},
  {id:'a3',at:'2026-09-15T10:00:00Z',period:'current',source:'端末',host:'WS-01',user:'aoki',event:'プロセス起動',detail:'実行元を確認',process:'agent.exe',parent:'explorer.exe'},
  {id:'b1',at:'2026-09-14T12:00:00Z',period:'current',source:'通信',host:'WS-02',user:'kato',event:'外部通信',detail:'通常の更新',destination:'updates.example',process:'updater.exe',bytes:1000},
  {id:'c1',at:'2026-09-08T12:00:00Z',period:'baseline',source:'通信',host:'WS-02',user:'kato',event:'外部通信',detail:'通常の更新',destination:'updates.example',process:'updater.exe',bytes:500},
  {id:'c2',at:'2026-09-09T12:00:00Z',period:'baseline',source:'通信',host:'WS-02',user:'kato',event:'外部通信',detail:'通常の更新',destination:'updates.example',process:'updater.exe',bytes:500}
];

const task = {
  id:'test', hypotheses:[{id:'h1',label:'仮説1'},{id:'h2',label:'仮説2'}],
  findings:[{id:'f1',label:'追加確認'},{id:'f2',label:'別の確認'}],
  sources:[{name:'通信'},{name:'端末'}],
  periods:{baseline:{from:'2026-09-07',to:'2026-09-09'},current:{from:'2026-09-14',to:'2026-09-16'}},
  guide:[{title:'a'},{title:'b'}], logs,
  rubric:{hypotheses:['h1'],targets:['WS-01'],verdict:'supported',sources:['通信','端末'],scope:true,finding:'f1',
    evidenceGroups:[{label:'通信記録',anyOf:['a1','a2'],role:'support'},{label:'起動記録',anyOf:['a3'],role:'context'}],
    evidenceExtras:[{id:'b1',roles:['counter','context'],reason:'同時期の正規更新と比較できる。'}],
    operations:['search','compare','pivot']}
};

function answer() {
  return {hypothesis:'h1',ownHypothesis:'',targets:['WS-01'],verdict:'supported',sources:['通信','端末'],from:'2026-09-14',to:'2026-09-16',finding:'f1',evidence:[{id:'a1',role:'support',note:''},{id:'a3',role:'context',note:''}],summary:''};
}
function progress(draft=answer(), completed=false) {
  return {schemaVersion:3,taskStates:{test:{draft,operations:['search','compare','pivot'],completed,hintLevel:1,guideStep:0}},lastTask:'test'};
}

test('parser handles AND, spaced field values, quotes, exclusions and escaped quotes', () => {
  assert.deepEqual(E.parseQuery('host: WS-01 source:"通信" -"通常の同期処理"').terms, [
    {field:'host',value:'WS-01',negated:false},
    {field:'source',value:'通信',negated:false},
    {field:null,value:'通常の同期処理',negated:true}
  ]);
  assert.deepEqual(E.parseQuery('"quoted \\"word\\""').errors, []);
  assert.equal(E.parseQuery('HOST:ws-01').terms[0].field, 'host');
  assert.equal(E.parseQuery('"host:literal"').terms[0].field, null);
});

test('parser reports unsupported fields, incomplete values and malformed quotes', () => {
  for (const query of ['bogus:x','host:','-','"unclosed','"closed"tail','a"b','x'.repeat(2001)]) {
    assert.ok(E.parseQuery(query).errors.length, query);
    assert.deepEqual(E.filterLogs(logs,{query,period:'all'}), [], query);
  }
});

test('OR separates AND branches without weakening outer source/host filters', () => {
  const parsed=E.parseQuery('host:WS-01 source:端末 OR host:WS-02 source:通信');
  assert.equal(parsed.groups.length,2);
  assert.deepEqual(parsed.terms,parsed.groups.flat());
  assert.deepEqual(parsed.groups.map(g=>g.length),[2,2]);
  assert.deepEqual(E.filterLogs(logs,{query:'host:WS-01 source:端末 OR host:WS-02 source:通信',period:'all'}).map(l=>l.id),['a3','b1','c1','c2']);
  assert.deepEqual(E.filterLogs(logs,{query:'host:WS-01 OR host:WS-02',source:'端末',period:'all'}).map(l=>l.id),['a3']);
  assert.deepEqual(E.filterLogs(logs,{query:'host:WS-01 -source:通信 OR destination:updates.example',period:'all'}).map(l=>l.id),['a3','b1','c1','c2']);
});

test('only standalone uppercase unquoted OR is an operator, and malformed OR fails closed', () => {
  assert.equal(E.parseQuery('"OR"').groups.length,1);
  assert.equal(E.parseQuery('"OR"').terms[0].value,'OR');
  assert.equal(E.parseQuery('field ORsomething or -OR').groups.length,1);
  assert.equal(E.parseQuery('source:OR').terms[0].value,'OR');
  for(const query of ['OR','OR host:WS-01','host:WS-01 OR','host:WS-01 OR OR user:aoki','host:WS-01 OR -']) {
    assert.ok(E.parseQuery(query).errors.length,query);
    assert.deepEqual(E.filterLogs(logs,{query,period:'all'}),[],query);
  }
  assert.deepEqual(E.parseQuery('').groups,[]);
});

test('correlation identifiers use exact case-insensitive matching and can be grouped', () => {
  for(const field of ['session','pid','process_guid','parent_process_guid','request_id','device_id','hash']) {
    const rows=[{...logs[0],id:'one',[field]:'ID-01'},{...logs[0],id:'two',[field]:'ID-010'},{...logs[0],id:'three',[field]:'id-01'},{...logs[0],id:'none'}];
    assert.deepEqual(E.filterLogs(rows,{query:field+':id-01'}).map(r=>r.id),['one','three'],field);
    assert.deepEqual(E.filterLogs(rows,{query:'-'+field+':ID-01'}).map(r=>r.id),['two','none'],field);
    assert.equal(E.aggregateLogs(rows,field).find(r=>r.key==='ID-01').count,2,field);
    assert.equal(E.compareLogs(rows,field).find(r=>r.key==='ID-01').current,2,field);
  }
  const rows=[{...logs[0],pid:42,parent:'C:\\Windows\\services.exe'},{...logs[0],id:'longer',pid:420,parent:'explorer.exe'}];
  assert.deepEqual(E.filterLogs(rows,{query:'pid:42'}).map(r=>r.id),['a1']);
  assert.deepEqual(E.filterLogs(rows,{query:'parent:SERVICES'}).map(r=>r.id),['a1']);
  assert.equal(E.aggregateLogs(rows,'parent').length,2);
});

test('process correlation OR finds the process and its children without prefix collisions', () => {
  const rows=[
    {...logs[0],id:'parent',process_guid:'PROC-A',parent_process_guid:'ROOT'},
    {...logs[0],id:'child',process_guid:'PROC-B',parent_process_guid:'proc-a'},
    {...logs[0],id:'near',process_guid:'PROC-A2',parent_process_guid:'PROC-A20'}
  ];
  assert.deepEqual(E.filterLogs(rows,{query:'process_guid:"proc-a" OR parent_process_guid:"proc-a"'}).map(r=>r.id),['parent','child']);
});

test('filter combines all conditions case insensitively without executing input', () => {
  assert.deepEqual(E.filterLogs(logs,{query:'host:ws-01 source:通信 -通常',period:'all'}).map(x=>x.id),['a2']);
  assert.deepEqual(E.filterLogs(logs,{query:'process:AGENT.EXE',source:'端末',host:'ws-01'}).map(x=>x.id),['a3']);
  assert.deepEqual(E.filterLogs(logs,{query:'constructor:alert(1)',period:'all'}),[]);
  assert.equal(E.filterLogs(logs).length,4);
  assert.equal(E.filterLogs(logs,{period:'all'}).length,6);
});

test('date filtering includes both UTC day boundaries and rejects impossible/reversed dates', () => {
  assert.deepEqual(E.filterLogs(logs,{from:'2026-09-14',to:'2026-09-16',host:'WS-01'}).map(x=>x.id),['a1','a2','a3']);
  assert.deepEqual(E.filterLogs(logs,{from:'2026-09-16',to:'2026-09-16'}).map(x=>x.id),['a2']);
  for (const filters of [{from:'2026-02-30'},{to:'2026-13-01'},{from:'2026-09-16',to:'2026-09-14'}]) assert.deepEqual(E.filterLogs(logs,filters),[]);
});

test('sensor queries match exact names case-insensitively and use provenance when top-level data is absent', () => {
  const rows=[
    {...logs[0],id:'native',sensor:'edge-flow',detail:'transport record',raw:''},
    {...logs[0],id:'fallback',provenance:{sensor:'EDGE-FLOW'},detail:'older record',raw:''},
    {...logs[0],id:'prefix',sensor:'edge-flow-extra',detail:'another collector',raw:''},
    {...logs[0],id:'missing',detail:'no sensor assigned',raw:''},
    {...logs[0],id:'precedence',sensor:'endpoint-network',provenance:{sensor:'edge-flow'},detail:'endpoint record',raw:''}
  ];
  assert.deepEqual(E.parseQuery('sensor:"EDGE-FLOW"').errors,[]);
  assert.deepEqual(E.filterLogs(rows,{query:'sensor:EDGE-FLOW'}).map(row=>row.id),['native','fallback']);
  assert.deepEqual(E.filterLogs(rows,{query:'-sensor:edge-flow'}).map(row=>row.id),['prefix','missing','precedence']);
  assert.deepEqual(E.filterLogs(rows,{query:'edge-flow'}).map(row=>row.id),['native','fallback','prefix']);
  assert.deepEqual(E.filterLogs(rows,{query:'sensor:edge'}),[],'sensor names are not substring matches');
  assert.equal(E.aggregateLogs(rows,'sensor').find(group=>group.key==='edge-flow').count,2);
  const compared=E.compareLogs([...rows,{...rows[1],id:'baseline',period:'baseline'}],'sensor','通信');
  assert.deepEqual(compared.find(group=>group.key==='edge-flow'),{key:'edge-flow',baseline:1,current:2,delta:1,ratio:2});
  assert.equal(rows[1].sensor,undefined,'search does not mutate the original record');
});

test('JST manual dates include exact local-day boundaries while query after/before retain UTC semantics', () => {
  const rows=[
    {...logs[0],id:'before',at:'2026-09-13T14:59:59.999Z'},
    {...logs[0],id:'local-start',at:'2026-09-13T15:00:00.000Z'},
    {...logs[0],id:'utc-start',at:'2026-09-14T00:00:00.000Z'},
    {...logs[0],id:'local-end',at:'2026-09-14T14:59:59.999Z'},
    {...logs[0],id:'next-local-day',at:'2026-09-14T15:00:00.000Z'}
  ];
  const local={from:'2026-09-14',to:'2026-09-14',timezone:'Asia/Tokyo',period:'all'};
  assert.deepEqual(E.filterLogs(rows,local).map(row=>row.id),['local-start','utc-start','local-end']);
  assert.deepEqual(E.filterLogs(rows,{...local,timezone:'UTC'}).map(row=>row.id),['utc-start','local-end','next-local-day']);
  const {timezone,...defaultUTC}=local;
  assert.deepEqual(E.filterLogs(rows,defaultUTC).map(row=>row.id),['utc-start','local-end','next-local-day']);
  assert.deepEqual(E.filterLogs(rows,{...local,query:'after:2026-09-14'}).map(row=>row.id),['utc-start','local-end']);
  assert.deepEqual(E.filterLogs(rows,{...local,query:'before:2026-09-13 OR after:2026-09-15'}).map(row=>row.id),['local-start']);
  assert.deepEqual(E.filterLogs(rows,{...local,query:'host:WS-01 OR source:通信'}).map(row=>row.id),['local-start','utc-start','local-end'],'outer local dates constrain every OR branch');
  assert.equal(E.filterLogs(rows,{timezone:'Asia/Tokyo',period:'all'}).length,rows.length,'zone alone adds no date filter');
  for(const invalid of ['JST','Asia/Unknown','utc',9,{},false])assert.deepEqual(E.filterLogs(rows,{...local,timezone:invalid}),[],String(invalid));
});

test('aggregation counts selected events and sums known bytes rather than fabricating values', () => {
  const rows=E.aggregateLogs(E.filterLogs(logs), 'host');
  assert.deepEqual(rows[0],{key:'WS-01',count:3,hosts:['WS-01'],bytes:300});
  assert.deepEqual(rows[1],{key:'WS-02',count:1,hosts:['WS-02'],bytes:1000});
  assert.equal(E.aggregateLogs(logs,'destination').find(row=>row.key==='（記録なし）').count,1);
});

test('comparison uses independent period samples, exposes absent baseline and obeys source filter', () => {
  assert.deepEqual(E.compareLogs(logs,'host','通信'),[
    {key:'WS-01',baseline:0,current:2,delta:2,ratio:null},
    {key:'WS-02',baseline:2,current:1,delta:-1,ratio:0.5}
  ]);
  assert.equal(E.compareLogs(logs,'host')[0].current,3);
});

test('rubric accepts alternative evidence, requires every group and checks evidence roles', () => {
  const draft=answer(), ops=['search','compare','pivot'];
  assert.equal(E.gradeTask(task,draft,ops).passed,true);
  draft.evidence[0].id='a2';
  assert.equal(E.gradeTask(task,draft,ops).passed,true);
  draft.evidence[1].role='support';
  assert.equal(E.gradeTask(task,draft,ops).passed,false);
  draft.evidence.pop();
  assert.equal(E.gradeTask(task,draft,ops).criteria.find(x=>x.id==='evidence-1').passed,false);
});

test('rubric rejects extraneous targets, absent operations, narrow scope and unsupported conclusions', () => {
  const valid=answer();
  for (const patch of [{targets:['WS-01','WS-02']},{verdict:'benign'},{from:'2026-09-15'},{from:'1900-01-01',to:'2099-12-31'},{finding:'f2'},{sources:['通信']}]) {
    assert.equal(E.gradeTask(task,{...valid,...patch},['search','compare','pivot']).passed,false,JSON.stringify(patch));
  }
  assert.equal(E.gradeTask(task,valid,['search','compare']).passed,false);
  assert.equal(E.gradeTask({rubric:{},logs:[]},{},[]).passed,false);
});

test('source selection requires the exact needed set and distinguishes missing from surplus types', () => {
  const expanded={...task,sources:[...task.sources,{name:'業務'},{name:'収集'}]};
  const grade=sources=>E.gradeTask(expanded,{...answer(),sources},['search','compare','pivot']);
  assert.equal(grade(['端末','通信']).passed,true,'selection order does not matter');
  const all=grade(expanded.sources.map(s=>s.name));
  assert.equal(all.passed,false,'selecting every available source is not sufficient');
  assert.deepEqual(all.criteria.filter(c=>!c.passed).map(c=>c.id),['sources']);
  const extra=all.criteria.find(c=>c.id==='sources');
  assert.match(extra.detail,/過剰：業務、収集/);assert.doesNotMatch(extra.detail,/不足：/);
  const missing=grade(['通信']).criteria.find(c=>c.id==='sources');
  assert.equal(missing.passed,false);assert.match(missing.detail,/不足：端末/);assert.doesNotMatch(missing.detail,/過剰：/);
  const both=grade(['通信','業務']).criteria.find(c=>c.id==='sources');
  assert.equal(both.passed,false);assert.match(both.detail,/不足：端末/);assert.match(both.detail,/過剰：業務/);
  assert.equal(grade(['通信','端末','教材にない種類']).passed,false);
});

test('old schema3 overselected sources are retained with notes but regraded as incomplete', () => {
  const expanded={...task,sources:[...task.sources,{name:'業務'}]};
  const draft=answer();draft.sources.push('業務');draft.summary='以前に全部を選んで確認したメモ';draft.evidence[0].note='証拠の意味を保存';
  const input=progress(draft,true),restored=E.validateProgress(input,[expanded]);
  const saved=restored.taskStates.test;
  assert.equal(restored.schemaVersion,3);assert.equal(saved.completed,false);
  assert.deepEqual(saved.draft.sources,['通信','端末','業務']);
  assert.equal(saved.draft.summary,draft.summary);assert.equal(saved.draft.evidence[0].note,draft.evidence[0].note);
  assert.deepEqual(E.validateProgress(JSON.parse(JSON.stringify(restored)),[expanded]),restored);
  assert.equal(input.taskStates.test.completed,true,'validation does not alter the original saved file');
});

function publicTask() {
  const logAliases=Object.fromEntries(logs.map((log,i)=>[log.id,'rec-'+String(i+1).padStart(16,'0')]));
  return {...task,logAliases,logs:logs.map(log=>({...log,id:logAliases[log.id]})),rubric:{...task.rubric,
    evidenceGroups:task.rubric.evidenceGroups.map(group=>({...group,anyOf:group.anyOf.map(id=>logAliases[id])})),
    evidenceExtras:task.rubric.evidenceExtras.map(extra=>({...extra,id:logAliases[extra.id]}))}};
}

test('opaque log aliases migrate evidence in every supported schema without rewriting learner prose', () => {
  const published=publicTask();
  for(const schemaVersion of [1,2,3]) {
    const draft=answer();draft.evidence[0].note='a1は重要な根拠';draft.summary='a1とa3の関係';draft.ownHypothesis='a1で仮説を確認';
    draft.limitations='a1だけで範囲外は判断しない';draft.nextAction='a3の担当へ確認';
    const input={...progress(draft,true),schemaVersion},normalized=E.validateProgress(input,[published]);
    const restored=normalized.taskStates.test;
    assert.equal(normalized.migrated,true);assert.equal(restored.completed,true);
    assert.deepEqual(restored.draft.evidence.map(e=>e.id),[published.logAliases.a1,published.logAliases.a3]);
    for(const key of ['summary','ownHypothesis','limitations','nextAction'])assert.equal(restored.draft[key],draft[key]);
    assert.equal(restored.draft.evidence[0].note,draft.evidence[0].note);
    assert.equal(input.taskStates.test.draft.evidence[0].id,'a1','the saved file remains untouched');
    delete normalized.migrated;
    assert.deepEqual(E.validateProgress(JSON.parse(JSON.stringify(normalized)),[published]),normalized);
  }
});

test('opaque aliases replace only complete full-text query terms, preserving fields, prefixes and formatting', () => {
  const published=publicTask(),a=published.logAliases;
  published.exit={kind:'query',rubric:{query:{expected:[a.a1],filters:{period:'all'}}}};
  const input=progress();
  input.taskStates.test.draft.query='a1  OR -"A2"\n host:a1 source:"a2" "a1 extra" a1suffix event-';
  input.taskStates.test.filters={query:'"a3" OR process:a1 -b1',period:'all'};
  input.taskStates.test.exitDraft={query:'"a1"'};
  const normalized=E.validateProgress(input,[published]);
  const restored=normalized.taskStates.test;
  assert.equal(restored.draft.query,a.a1+'  OR -"'+a.a2+'"\n host:a1 source:"a2" "a1 extra" a1suffix event-');
  assert.equal(restored.filters.query,'"'+a.a3+'" OR process:a1 -'+a.b1);
  assert.equal(restored.exitDraft.query,'"'+a.a1+'"');
  assert.equal(restored.exitCompleted,true,'the migrated exit query still finds the intended public record');
  assert.equal(normalized.migrated,true);
});

test('unfinished queries and alias expansions above the query limit remain editable original text', () => {
  const published=publicTask();
  for(const query of ['a1 OR','"a1','unknown:a1 a2','a1 '.repeat(400)]) {
    const input=progress();input.taskStates.test.draft.query=query;input.taskStates.test.filters={query};
    const restored=E.validateProgress(input,[published]).taskStates.test;
    assert.equal(restored.draft.query,query);assert.equal(restored.filters.query,query);
    assert.ok(restored.draft.query.length<=2000);
    assert.equal(restored.draft.evidence[0].id,published.logAliases.a1,'other progress still migrates');
  }
});

test('aliases cannot hide duplicate evidence or make unknown record IDs valid', () => {
  const published=publicTask(),draft=answer();
  draft.evidence.push({id:published.logAliases.a1,role:'support',note:''});
  assert.throws(()=>E.validateProgress(progress(draft),[published]),/重複/);
  draft.evidence=[{id:'not-an-old-or-public-id',role:'support',note:''}];
  assert.throws(()=>E.validateProgress(progress(draft),[published]),/証拠ID/);
});

function entityTask() {
  const item=publicTask(),host='WS-8AC012EF',guid='{12345678-1234-5678-90ab-123456789abc}';
  item.logs=item.logs.map(row=>({...row,host:row.host==='WS-01'?host:row.host}));
  item.rubric={...item.rubric,targets:[host]};
  item.entityAliases={fields:{host:{'WS-01':host},process_guid:{'F1-P88':guid},parent_process_guid:{'F1-P88':guid},request_id:{'P1-1':'req-129cc0'},destination:{'relay-p6.example':'relay-129cc0.example'}},text:{'WS-01':host,'F1-P88':guid,'P1-1':'req-129cc0','relay-p6.example':'relay-129cc0.example'}};
  return item;
}

test('entity aliases migrate typed queries and host selections in all schemas without rewriting learner prose', () => {
  const published=entityTask(),host=published.rubric.targets[0],guid=published.entityAliases.fields.process_guid['F1-P88'];
  for(const schemaVersion of [1,2,3]) {
    const input={...progress(),schemaVersion},saved=input.taskStates.test;
    saved.draft.query='-HoSt:  "ws-01"  OR process_guid:F1-P88 -parent_process_guid:"F1-P88" request_id:P1-1 destination:relay-p6.example "F1-P88" P1-1 "F1-P88 extra" F1-P8 source:F1-P88';
    saved.draft.summary='WS-01でF1-P88を調べた。P1-1は旧記録のメモ。';saved.draft.evidence[0].note=saved.draft.summary;
    saved.filters={host:'WS-01',query:'host:WS-01 OR "a1"',period:'all'};
    saved.exitDraft={query:'parent_process_guid:F1-P88',reflection:'F1-P88',reviewedReflection:'F1-P88'};
    const result=E.validateProgress(input,[published]),restored=result.taskStates.test;
    assert.equal(restored.completed,true);assert.equal(result.migrated,true);
    assert.deepEqual(restored.draft.targets,[host]);assert.equal(restored.filters.host,host);
    assert.equal(restored.draft.query,`-HoSt:  "${host}"  OR process_guid:${guid} -parent_process_guid:"${guid}" request_id:req-129cc0 destination:relay-129cc0.example "${guid}" P1-1 "F1-P88 extra" F1-P8 source:F1-P88`);
    assert.equal(restored.filters.query,`host:${host} OR "${published.logAliases.a1}"`);
    assert.equal(restored.exitDraft.query,`parent_process_guid:${guid}`);
    assert.equal(restored.draft.summary,saved.draft.summary);assert.equal(restored.draft.evidence[0].note,saved.draft.evidence[0].note);
    assert.equal(restored.exitDraft.reflection,'F1-P88');assert.equal(restored.exitDraft.reviewedReflection,'F1-P88');
    const {migrated,...persisted}=result;
    assert.deepEqual(E.validateProgress(JSON.parse(JSON.stringify(persisted)),[published]),persisted);
  }
});

test('v1 host renames precede entity aliases while revoked answers and malformed queries are not invented', () => {
  const published=entityTask();published.legacy={targets:{'OLD-WS':'WS-01','WS-02':''}};
  const input={...progress(),schemaVersion:1};input.taskStates.test.draft.targets=['OLD-WS'];
  input.taskStates.test.filters={host:'OLD-WS',query:'host:OLD-WS OR "OLD-WS"',period:'all'};
  const restored=E.validateProgress(input,[published]).taskStates.test,host=published.rubric.targets[0];
  assert.deepEqual(restored.draft.targets,[host]);assert.equal(restored.filters.host,host);
  assert.equal(restored.filters.query,`host:${host} OR "${host}"`);
  input.taskStates.test.draft.targets=['WS-02'];input.taskStates.test.filters={host:'WS-02',query:'host:WS-02'};
  const revoked=E.validateProgress(input,[published]).taskStates.test;
  assert.deepEqual(revoked.draft.targets,[]);assert.equal(revoked.filters.host,'WS-02');assert.equal(revoked.filters.query,'host:WS-02');
  for(const query of ['process_guid:F1-P88 OR','"F1-P88','request_id:P1-1 '.repeat(100)]) {
    const saved=progress();saved.taskStates.test.draft.query=query;
    assert.equal(E.validateProgress(saved,[published]).taskStates.test.draft.query,query);
  }
  const unknown=progress();unknown.taskStates.test.draft.targets=['WS-NOT-IN-CATALOG'];
  assert.throws(()=>E.validateProgress(unknown,[published]),/対象端末/);
});

test('limitations and next action are independent bounded inert text fields in both drafts', () => {
  const published=publicTask();
  const input=progress();input.taskStates.test.draft.limitations='<img src=x onerror=alert(1)>a1';input.taskStates.test.draft.nextAction='担'.repeat(4000);
  input.taskStates.test.exitDraft={limitations:'出口の未確認事項',nextAction:'出口の確認先'};
  const restored=E.validateProgress(input,[published]).taskStates.test;
  assert.equal(restored.draft.limitations,input.taskStates.test.draft.limitations);assert.equal(restored.draft.nextAction,input.taskStates.test.draft.nextAction);
  assert.equal(restored.exitDraft.limitations,'出口の未確認事項');assert.equal(restored.exitDraft.nextAction,'出口の確認先');
  const older=E.validateProgress(progress(),[task]).taskStates.test;
  assert.equal(older.draft.limitations,'');assert.equal(older.draft.nextAction,'');assert.equal(older.exitDraft.limitations,'');
  for(const field of ['limitations','nextAction']) for(const draftKey of ['draft','exitDraft']) {
    const bad=progress();bad.taskStates.test[draftKey]={...bad.taskStates.test[draftKey],[field]:'文'.repeat(4001)};
    assert.throws(()=>E.validateProgress(bad,[task]),/形式または長さ/);
  }
});

test('correct mandatory evidence plus unrelated padding does not pass', () => {
  const draft=answer();
  draft.evidence.push({id:'c1',role:'support',note:'関係ない記録を足す'});
  const grade=E.gradeTask(task,draft,['search','compare','pivot']);
  assert.equal(grade.passed,false);
  const precision=grade.criteria.find(c=>c.id==='evidence-precision');
  assert.equal(precision.passed,false);
  assert.match(precision.detail,/c1/);
  assert.match(precision.detail,/support/);
  assert.equal(grade.criteria.find(c=>c.id==='evidence-valid').passed,true);
});

test('optional supplementary evidence is accepted only with its explicit permitted roles', () => {
  const draft=answer();
  draft.evidence.push({id:'b1',role:'counter',note:''});
  assert.equal(E.gradeTask(task,draft,['search','compare','pivot']).passed,true);
  draft.evidence[2].role='context';
  assert.equal(E.gradeTask(task,draft,['search','compare','pivot']).passed,true);
  draft.evidence[2].role='support';
  const grade=E.gradeTask(task,draft,['search','compare','pivot']);
  assert.equal(grade.passed,false);
  assert.match(grade.criteria.find(c=>c.id==='evidence-precision').detail,/b1.*support/);
});

test('a wrongly labeled mandatory record fails precision even if its group has a correct alternative', () => {
  const draft=answer();draft.evidence.push({id:'a2',role:'counter',note:''});
  const result=E.gradeTask(task,draft,['search','compare','pivot']);
  assert.equal(result.criteria.find(c=>c.id==='evidence-0').passed,true);
  assert.equal(result.criteria.find(c=>c.id==='evidence-precision').passed,false);
});

test('no evidence is reported through missing groups rather than an extra precision failure', () => {
  const result=E.gradeTask(task,{...answer(),evidence:[]},['search','compare','pivot']);
  assert.equal(result.passed,false);
  assert.equal(result.criteria.find(c=>c.id==='evidence-precision').passed,true);
  assert.deepEqual(result.criteria.filter(c=>!c.passed).map(c=>c.id),['evidence-0','evidence-1']);
});

test('free prose does not influence correctness; unknown or duplicate evidence cannot pass', () => {
  const draft=answer(); draft.summary='<script>unexpected()</script>';
  assert.equal(E.gradeTask(task,draft,['search','compare','pivot']).passed,true);
  draft.evidence.push({...draft.evidence[0]});
  assert.equal(E.gradeTask(task,draft,['search','compare','pivot']).passed,false);
  draft.evidence[2]={id:'foreign',role:'support'};
  assert.equal(E.gradeTask(task,draft,['search','compare','pivot']).passed,false);
});

test('progress normalization recalculates completion instead of trusting a stored flag', () => {
  assert.equal(E.validateProgress(progress(answer(),false),[task]).taskStates.test.completed,true);
  const invalid=answer();invalid.verdict='benign';
  assert.equal(E.validateProgress(progress(invalid,true),[task]).taskStates.test.completed,false);
  assert.deepEqual(E.validateProgress({schemaVersion:3,taskStates:{},lastTask:null},[task]),{schemaVersion:3,taskStates:{},lastTask:null,activeTask:null,timeDisplay:'utc'});
});

test('progress retains notes as inert strings; callers must escape them when rendering', () => {
  const draft=answer(); draft.summary='<img src=x onerror=alert(1)>\u0000'; draft.evidence[0].note='<b>evidence</b>';draft.ownHypothesis='<script>myHypothesis()</script>';
  const output=E.validateProgress(progress(draft),[task]).taskStates.test.draft;
  assert.equal(output.summary,'<img src=x onerror=alert(1)>');
  assert.equal(output.evidence[0].note,'<b>evidence</b>');
  assert.equal(output.ownHypothesis,'<script>myHypothesis()</script>');
  assert.equal(E.gradeTask(task,draft,['search','compare','pivot']).passed,true);
});

test('v1 migration translates explicit legacy IDs, retains notes, and recomputes completion', () => {
  const revised={...task,hypotheses:[{id:'new-h',label:'新版の仮説'}],findings:[{id:'new-f',label:'新版の確認'}],legacy:{hypothesis:{h1:'new-h'},finding:{f1:'new-f'},targets:{'OLD-01':'WS-01'}},rubric:{...task.rubric,hypotheses:['new-h'],finding:'new-f'}};
  const draft=answer();draft.targets=['OLD-01'];draft.summary='旧版での調査メモ';draft.evidence[0].note='保存した根拠';
  const input={...progress(draft,false),schemaVersion:1};
  const result=E.validateProgress(input,[revised]);
  assert.equal(result.schemaVersion,3);assert.equal(result.migrated,true);
  assert.equal(result.taskStates.test.draft.hypothesis,'new-h');
  assert.equal(result.taskStates.test.draft.finding,'new-f');
  assert.deepEqual(result.taskStates.test.draft.targets,['WS-01']);
  assert.equal(result.taskStates.test.draft.summary,'旧版での調査メモ');
  assert.equal(result.taskStates.test.draft.evidence[0].note,'保存した根拠');
  assert.equal(result.taskStates.test.completed,true);
  assert.equal(input.taskStates.test.draft.hypothesis,'h1','migration must not mutate input');
});

test('v1 migration clears removed or explicitly revoked choices without inventing a new answer', () => {
  const revised={...task,legacy:{hypothesis:{h1:''},finding:{f1:''},targets:{'WS-01':''}}};
  const draft=answer();draft.targets.push('retired-host');draft.sources.push('廃止済みログ');draft.evidence.push({id:'retired-log',role:'context',note:'old'});
  const result=E.validateProgress({...progress(draft,true),schemaVersion:1},[revised]);
  const restored=result.taskStates.test;
  assert.equal(restored.draft.hypothesis,'');assert.equal(restored.draft.finding,'');assert.deepEqual(restored.draft.targets,[]);
  assert.deepEqual(restored.draft.sources,['通信','端末']);
  assert.deepEqual(restored.draft.evidence.map(e=>e.id),['a1','a3']);
  assert.equal(restored.completed,false);
});

test('v1 without a legacy mapping retains only unchanged known IDs; v2/v3 remain strict', () => {
  const known=E.validateProgress({...progress(),schemaVersion:1},[task]);
  assert.equal(known.taskStates.test.draft.hypothesis,'h1');
  assert.equal(known.taskStates.test.completed,true);
  const draft={...answer(),hypothesis:'removed-h',finding:'removed-f',targets:['WS-01','removed-host']};
  const result=E.validateProgress({...progress(draft,true),schemaVersion:1},[task]);
  assert.equal(result.taskStates.test.draft.hypothesis,'');assert.equal(result.taskStates.test.draft.finding,'');
  assert.deepEqual(result.taskStates.test.draft.targets,['WS-01']);assert.equal(result.taskStates.test.completed,false);
  assert.throws(()=>E.validateProgress(progress(draft),[task]),/進捗ファイル/);
  assert.throws(()=>E.validateProgress({...progress(draft),schemaVersion:2},[task]),/進捗ファイル/);
  assert.equal(E.validateProgress(progress(),[task]).migrated,undefined);
});

test('schema3 round trip preserves an authored hypothesis up to 4000 characters without semantic grading', () => {
  const draft=answer();draft.ownHypothesis='仮'.repeat(4000);
  const normalized=E.validateProgress(progress(draft),[task]);
  assert.equal(normalized.schemaVersion,3);assert.equal(normalized.taskStates.test.draft.ownHypothesis,draft.ownHypothesis);
  assert.deepEqual(E.validateProgress(JSON.parse(JSON.stringify(normalized)),[task]),normalized);
  draft.ownHypothesis+='説';assert.throws(()=>E.validateProgress(progress(draft),[task]),/自分の仮説/);
});

test('malformed and incompatible progress is rejected with a readable error', () => {
  const bad=[null,[],{}, {schemaVersion:4,taskStates:{}}, {...progress(),lastTask:'unknown'}, {...progress(),taskStates:{unknown:{draft:{}}}},JSON.parse('{"schemaVersion":3,"taskStates":{},"__proto__":{}}')];
  const manipulations=[
    p=>{p.taskStates.test.draft.targets=['foreign'];},
    p=>{p.taskStates.test.draft.hypothesis='foreign';},
    p=>{p.taskStates.test.draft.evidence[0].id='foreign';},
    p=>{p.taskStates.test.draft.evidence.push({...p.taskStates.test.draft.evidence[0]});},
    p=>{p.taskStates.test.operations=['html'];},
    p=>{p.taskStates.test.hintLevel=4;},
    p=>{p.taskStates.test.guideStep=999;},
    p=>{p.taskStates.test.draft.from='2026-02-30';},
    p=>{p.taskStates.test.draft.summary='x'.repeat(12001);}
  ];
  for (const mutate of manipulations) {const p=progress();mutate(p);bad.push(p);}
  bad.forEach(value=>assert.throws(()=>E.validateProgress(value,[task]),/進捗ファイルを読み込めません/));
});

for (const name of ['content-intro.cjs','content-hunts.cjs']) {
  const file=path.join(__dirname,'../src',name);
  if (!fs.existsSync(file)) continue;
  const tasks=require(file);
  test(name+': all authored tasks have valid data and a reachable passing report', () => {
    assert.ok(Array.isArray(tasks));
    const taskIds=new Set();
    for (const item of tasks) {
      assert.ok(!taskIds.has(item.id), 'duplicate task '+item.id);taskIds.add(item.id);
      const ids=new Set(), knownSources=new Set(item.sources.map(s=>s.name));
      assert.ok(item.logs.length>0,item.id+' needs logs');
      for (const log of item.logs) {
        assert.ok(!ids.has(log.id), item.id+' duplicate log '+log.id);ids.add(log.id);
        assert.ok(knownSources.has(log.source),item.id+' unknown source '+log.source);
        assert.ok(['current','baseline'].includes(log.period),item.id+' invalid period');
        const range=item.periods[log.period],date=log.at.slice(0,10);
        assert.ok(Number.isFinite(Date.parse(log.at)),item.id+' invalid timestamp '+log.at);
        assert.ok(date>=range.from && date<=range.to,item.id+' timestamp outside '+log.period+' '+log.at);
      }
      const r=item.rubric,evidence=[];
      for (const group of r.evidenceGroups || []) {
        assert.ok(group.anyOf.length>0,item.id+' empty evidence alternatives');
        group.anyOf.forEach(id=>assert.ok(ids.has(id),item.id+' absent evidence '+id));
        if(!evidence.some(e=>e.id===group.anyOf[0])) evidence.push({id:group.anyOf[0],role:group.role,note:''});
      }
      for(const extra of r.evidenceExtras || []) {
        assert.ok(ids.has(extra.id),item.id+' absent supplementary evidence '+extra.id);
        assert.ok(Array.isArray(extra.roles) && extra.roles.length>0,item.id+' supplementary roles required');
        assert.ok(extra.roles.every(role=>['support','counter','context','gap'].includes(role)),item.id+' invalid supplementary role');
        assert.equal(new Set(extra.roles).size,extra.roles.length,item.id+' duplicate supplementary role');
        assert.ok(typeof extra.reason==='string' && extra.reason.trim(),item.id+' supplementary evidence needs a reason');
      }
      const draft={hypothesis:(r.hypotheses||[])[0]||'',ownHypothesis:'',targets:r.targets||[],verdict:r.verdict||'',sources:r.sources||[],from:item.periods.current.from,to:item.periods.current.to,finding:r.finding||'',alternative:r.alternative||'',evidence,summary:''};
      const grade=E.gradeTask(item,draft,r.operations||[]);
      assert.ok(grade.passed,item.id+' unreachable grading: '+JSON.stringify(grade.criteria.filter(c=>!c.passed)));
      const saved={schemaVersion:2,taskStates:{[item.id]:{draft,operations:r.operations||[],hintLevel:0,guideStep:0,completed:false}},lastTask:item.id};
      assert.ok(E.validateProgress(saved,tasks).taskStates[item.id].completed,item.id+' passing report not importable');
      for(const extra of r.evidenceExtras || []) {
        if(draft.evidence.some(e=>e.id===extra.id) || draft.evidence.length>=8)continue;
        const supplemented={...draft,evidence:[...draft.evidence,{id:extra.id,role:extra.roles[0],note:''}]};
        assert.ok(E.gradeTask(item,supplemented,r.operations||[]).passed,item.id+' declared extra rejected '+extra.id);
      }
    }
  });
}
