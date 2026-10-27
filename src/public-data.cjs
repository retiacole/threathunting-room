'use strict';
const {createHash}=require('node:crypto');

// Authoring keys stay useful in source files; learner-facing record IDs do not
// encode whether a row is normal activity, a signal, or an exercise answer.
function recordId(key){return 'rec-'+createHash('sha256').update('threat-hunting-room.record.v1:'+key).digest('hex').slice(0,16);}
function logsWithin(value,found=new Map()){
  if(!value||typeof value!=='object')return found;
  if(!Array.isArray(value)&&typeof value.id==='string'&&typeof value.at==='string'&&typeof value.source==='string')found.set(value.id,value);
  for(const child of Object.values(value))if(child&&typeof child==='object')logsWithin(child,found);
  return found;
}
const entityFields=['host','process_guid','parent_process_guid','session','request_id','destination','device_id'];
const digest=value=>createHash('sha256').update('threat-hunting-room.entity.v1:'+value.toLowerCase()).digest('hex');
const leaksExercise=value=>/(?:^|[-_.])[ipf]0?\d+(?:[-_.]|$)/i.test(value);
function entityInventory(task){
  const fields=Object.fromEntries(entityFields.map(field=>[field,new Set()])),flow=new Set();
  for(const row of logsWithin(task).values()){
    for(const field of entityFields){
      const value=row[field];
      if(typeof value!=='string'||!value||value==='-')continue;
      if(['host','destination','device_id'].includes(field)&&!leaksExercise(value))continue;
      fields[field].add(value);
    }
    for(const text of [row.detail,row.raw])for(const match of (text||'').matchAll(/\bflow_id=([A-Za-z0-9_.:-]+)/g))flow.add(match[1]);
  }
  return {fields,flow};
}
function entityMap(inventories){
  const kinds=new Map(),priority={process_guid:0,parent_process_guid:0,host:1,destination:2,device_id:3,session:4,request_id:5,flow:6};
  for(const inventory of inventories)for(const [kind,values] of [...Object.entries(inventory.fields),['flow',inventory.flow]])for(const value of values){
    const key=value.toLowerCase(),previous=kinds.get(key);
    if(!previous||priority[kind]<priority[previous.kind])kinds.set(key,{kind,value});
  }
  const result=new Map();
  for(const [key,{kind,value}] of kinds){
    const h=digest(value);
    let replacement;
    if(kind==='process_guid'||kind==='parent_process_guid')replacement=`{${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}}`;
    else if(kind==='host')replacement=(/^CLOUD-/i.test(value)?'CLOUD-':'WS-')+h.slice(0,8).toUpperCase();
    else if(kind==='destination')replacement='relay-'+h.slice(0,12)+'.example';
    else replacement=({device_id:'dev-',session:'0x',request_id:'req-',flow:'flow-'})[kind]+h.slice(0,16);
    result.set(key,replacement);
  }
  if(new Set(result.values()).size!==result.size)throw new Error('Published entity identifier collision');
  return result;
}
function replaceValues(value,aliases){
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const keys=[...aliases.keys()].sort((a,b)=>b.length-a.length);
  const pattern=keys.length?new RegExp('(?<![A-Za-z0-9_.-])(?:'+keys.map(escape).join('|')+')(?![A-Za-z0-9_.-])','gi'):null;
  const convert=item=>{
    if(typeof item==='string')return pattern?item.replace(pattern,key=>aliases.get(key.toLowerCase())):item;
    if(Array.isArray(item))return item.map(convert);
    if(item&&typeof item==='object')return Object.fromEntries(Object.entries(item).filter(([,v])=>typeof v!=='function').map(([k,v])=>[k,convert(v)]));
    return item;
  };
  return convert(value);
}
function createPublicBundle({tasks,environments}){
  const all=logsWithin({tasks,environments}),aliases=Object.fromEntries([...all.keys()].map(id=>[id,recordId(id)]));
  if(new Set(Object.values(aliases)).size!==all.size)throw new Error('Opaque record ID collision');
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('(?<![A-Za-z0-9_-])(?:'+Object.keys(aliases).sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?![A-Za-z0-9_-])','g');
  const convert=value=>{
    if(typeof value==='string')return value.replace(pattern,id=>aliases[id]);
    if(Array.isArray(value))return value.map(convert);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>typeof v!=='function').map(([k,v])=>[k,convert(v)]));
    return value;
  };
  const inventories=new Map(tasks.filter(task=>task.part===1).map(task=>[task.id,entityInventory(task)]));
  const entities=entityMap([...inventories.values()]);
  const publicTasks=tasks.map(task=>{
    const inventory=inventories.get(task.id);
    let source=task,entityAliases;
    if(inventory){
      const fields={};
      const scoped=new Map();
      for(const [field,values] of Object.entries(inventory.fields)){
        fields[field]=Object.fromEntries([...values].map(value=>[value,entities.get(value.toLowerCase())]));
        for(const value of values)scoped.set(value.toLowerCase(),entities.get(value.toLowerCase()));
      }
      // A process can be searched through either side of its parent/child link.
      fields.process_guid=fields.parent_process_guid={...fields.process_guid,...fields.parent_process_guid};
      for(const value of inventory.flow)scoped.set(value.toLowerCase(),entities.get(value.toLowerCase()));
      const originals=[...new Set([...Object.values(inventory.fields).flatMap(values=>[...values]),...inventory.flow])];
      entityAliases={fields,text:Object.fromEntries(originals.filter(value=>value.length>=6).map(value=>[value,entities.get(value.toLowerCase())]))};
      source=replaceValues(task,scoped);
    }
    const result=convert(source);
    result.logAliases=Object.fromEntries([...logsWithin(task).keys()].map(id=>[id,aliases[id]]));
    if(entityAliases)result.entityAliases=entityAliases;
    if(task.environment){delete result.logs;delete result.assets;}
    return result;
  });
  return {version:6,releaseVersion:require('../package.json').version,tasks:publicTasks,environments:convert(environments)};
}
module.exports={recordId,createPublicBundle};
