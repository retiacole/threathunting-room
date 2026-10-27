'use strict';
const intro=require('./content-intro.cjs');
const hunts=require('./content-hunts.cjs');
const tutorial=require('./content-tutorial.cjs');
const environment=require('./environment.cjs');
const foundation=require('./content-program.cjs');
const operational=require('./content-operations.cjs');
const exits=require('./content-exits.cjs');
const {shiftAonagiRecord}=require('./timezone-data.cjs');
// Authoring data uses Japan's local wall clock; convert exactly once after
// sensor normalization, before either display or grading receives the rows.
const shared={...environment,logs:[...environment.logs,...operational.logs.map(row=>environment.normalizeLog(row))].map(shiftAonagiRecord)};
const shiftValidation=rubric=>rubric?.query?.validation?{...rubric,query:{...rubric.query,validation:{...rubric.query.validation,logs:rubric.query.validation.logs.map(shiftAonagiRecord)}}}:rubric;
const logMap=new Map();
for(const log of shared.logs){if(logMap.has(log.id))throw new Error('Duplicate environment log '+log.id);logMap.set(log.id,log);}
const original=[...intro,...hunts].map(t=>({...t,part:1,chapter:t.level==='intro'?'I':t.level==='practice'?'P':'F',...(exits[t.id]?{exit:exits[t.id]}:{})}));
const program=[...foundation,...operational.tasks].map(t=>{
 if(t.environment!==shared.id)throw new Error('Unknown environment '+t.id);
 if(!Array.isArray(t.logIds)||new Set(t.logIds).size!==t.logIds.length)throw new Error('Invalid log references '+t.id);
 return {...t,part:2,rubric:shiftValidation(t.rubric),assets:shared.assets,periods:t.periods||shared.periods,logs:t.logIds.map(id=>{if(!logMap.has(id))throw new Error('Missing '+id+' for '+t.id);return logMap.get(id);})};
});
const tasks=[tutorial,...original,...program];
if(tasks.length!==39||new Set(tasks.map(t=>t.id)).size!==39)throw new Error('38 tasks plus tutorial required');
module.exports={tasks,environments:{[shared.id]:shared}};
