'use strict';
// A plausible benign hunt, chosen by log properties so opaque IDs are exercised.
function answer(task){
 const find=(source,period,test=()=>true)=>task.logs.find(l=>l.host==='CEDAR-OPS-03'&&l.source===source&&l.period===period&&test(l));
 const evidence=[
  [find('端末','baseline',l=>l.process==='sync-agent.exe'),'context'],
  [find('端末','current',l=>l.process==='sync-agent.exe'),'counter'],
  [find('通信','current',l=>l.process==='sync-agent.exe'),'counter'],
  [find('業務','current'),'context'],
  [find('収集','current'),'gap']
 ].map(([l,role])=>({id:l.id,role,note:'This record is relevant to the selected migration hypothesis.'}));
 return {targets:['CEDAR-OPS-03'],sources:['端末','通信','業務','収集'],from:task.periods.current.from,to:task.periods.current.to,verdict:'benign',ownHypothesis:'Is the changed OPS destination and volume outside approved migration conditions?',reviewedHypothesis:'Is the changed OPS destination and volume outside approved migration conditions?',reflection:'Compared matching scope and limitations with the review checklist.',reviewedReflection:'Compared matching scope and limitations with the review checklist.',query:'host:CEDAR-OPS-03',evidence,summary:'Compared the change record with the execution and correlated network events.',limitations:'Payload and activity outside the sample are not available.',nextAction:'Operations should confirm transfer objects and completion tomorrow.'};
}
module.exports={answer};
