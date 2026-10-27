'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/engine.js');
const tasks=[...require('../src/content-intro.cjs'),...require('../src/content-hunts.cjs')];

test('authored choices do not reveal correct answers through one position, ID or unique longest option',()=>{
  for(const [field,rubricKey] of [['hypotheses','hypotheses'],['findings','finding']]){
    const selected=tasks.filter(t=>(t[field]||[]).length);
    const correct=t=>Array.isArray(t.rubric[rubricKey])?t.rubric[rubricKey][0]:t.rubric[rubricKey];
    assert.ok(new Set(selected.map(t=>t[field].findIndex(o=>o.id===correct(t)))).size>=3,field+' positions');
    assert.ok(new Set(selected.map(correct)).size>=5,field+' IDs');
    const longest=selected.filter(t=>{const answer=t[field].find(o=>o.id===correct(t));return t[field].filter(o=>o.id!==answer.id).every(o=>o.label.length<answer.label.length);});
    assert.ok(longest.length<=Math.floor(selected.length/2),field+' length shortcut');
    assert.equal(new Set(selected.flatMap(t=>t[field].map(o=>o.label))).size,selected.reduce((n,t)=>n+t[field].length,0),field+' repeated generic distractors');
  }
});

test('intro aggregation requires explaining the highest count before choosing the next candidate',()=>{
  const t=tasks.find(t=>t.id==='i03'),rows=E.aggregateLogs(E.filterLogs(t.logs,{period:'current',source:'通信'}),'host');
  assert.notEqual(rows[0].key,t.rubric.targets[0]);
  assert.equal(rows[1].key,t.rubric.targets[0]);
  assert.ok(t.rubric.evidenceGroups.some(g=>g.role==='counter'&&g.anyOf.every(id=>t.logs.find(l=>l.id===id).host===rows[0].key)));
});

test('periodic hunting includes jitter and structured pivots tie endpoint starts to network events',()=>{
  const t=tasks.find(t=>t.id==='p01'),beacons=t.logs.filter(l=>l.destination==='sync-node.example').sort((a,b)=>a.at.localeCompare(b.at));
  const intervals=beacons.slice(1).map((l,i)=>(Date.parse(l.at)-Date.parse(beacons[i].at))/1000);
  assert.ok(intervals.length>=4);assert.ok(intervals.every(n=>n>=58&&n<=63));assert.ok(new Set(intervals).size>=3);
  const f=tasks.find(t=>t.id==='f01'),child=f.logs.find(l=>l.id==='f01-e04'),network=f.logs.find(l=>l.id==='f01-e05');
  assert.equal(child.process_guid,network.process_guid);assert.equal(child.session,network.session);assert.equal(child.pid,network.pid);assert.equal(child.host,network.host);
  assert.ok(f.logs.some(l=>l.process_guid===child.parent_process_guid&&l.host===child.host&&l.at<child.at));
  assert.ok(E.filterLogs(f.logs,{query:'parent:docview.exe',period:'all'}).some(l=>l.id===child.id));
});

test('intro correlation illustrates PID reuse without collapsing different process instances',()=>{
  const t=tasks.find(t=>t.id==='i05'),process=t.logs.find(l=>l.id==='i05-mori-shell');
  const byPid=E.filterLogs(t.logs,{query:'pid:'+process.pid,host:process.host,period:'all'});
  assert.ok(new Set(byPid.map(l=>l.process_guid).filter(Boolean)).size>1);
  const byGuid=E.filterLogs(t.logs,{query:'process_guid:'+process.process_guid,host:process.host,period:'all'});
  assert.ok(byGuid.some(l=>l.source==='端末'));assert.ok(byGuid.some(l=>l.source==='通信'));
  assert.equal(new Set(byGuid.map(l=>l.session)).size,1);
});

test('the insufficient-visibility case distinguishes limited flow records from richer collectors',()=>{
  const t=tasks.find(t=>t.id==='p06'),flow=t.logs.find(l=>l.id==='p06-e02'),scope=t.logs.find(l=>l.id==='p06-e04');
  assert.match(flow.detail,/sensor=edge-flow/);
  assert.equal(flow.process,undefined);assert.equal(flow.process_guid,undefined);assert.equal(flow.session,undefined);
  for(const sensor of ['edge-flow','update-client','endpoint-network'])assert.ok(scope.detail.includes('sensor='+sensor));
  assert.equal(flow.request_id,undefined);
  const flowId=flow.detail.match(/flow_id=([^ ]+)/)[0];
  const unrelated=E.filterLogs(t.logs,{query:flowId,period:'all'}).filter(l=>l.source!=='収集');
  assert.deepEqual(unrelated.map(l=>l.id),[flow.id]);
  assert.equal(t.rubric.verdict,'insufficient');
});

test('shared scheduled update events retain the same facts across practice task extracts',()=>{
  const a=tasks.find(t=>t.id==='p01'),b=tasks.find(t=>t.id==='p06');
  const rows=b.logs.filter(l=>l.destination==='updates.example'&&l.request_id?.startsWith('UPDATE-'));
  assert.ok(rows.length>=6);
  for(const l of rows){const matching=a.logs.find(other=>other.request_id===l.request_id);assert.ok(matching,l.request_id);const {id:unusedA,...factsA}=matching,{id:unusedB,...factsB}=l;assert.deepEqual(factsA,factsB,l.request_id);}
});
