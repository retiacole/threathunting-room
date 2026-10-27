(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.THTutorial=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function ready(task,state,ui,engine){
 const i=state.guideStep||0,d=state.draft||{},actions=state.tutorialActions||[],evidenceIds=task.rubric.evidenceGroups[0].anyOf;
 if(i===0)return true;
 if(i===1){const rows=engine.filterLogs(task.logs,ui.filters||state.filters||{});return (state.operations||[]).includes('search')&&rows.length===evidenceIds.length&&rows.every(l=>evidenceIds.includes(l.id));}
 if(i===2)return actions.includes('opened-log');
 if(i===3)return (d.evidence||[]).some(e=>evidenceIds.includes(e.id));
 if(i===4)return (d.evidence||[]).some(e=>evidenceIds.includes(e.id)&&e.role==='support');
 if(i===5)return actions.includes('opened-answers');
 if(i===6)return d.targets?.length===1&&d.targets[0]==='DEMO-WS-02';
 if(i===7)return Boolean(state.completed)&&actions.includes('graded');
 if(i>=8)return Boolean(state.completed)&&actions.includes('graded')&&actions.includes('viewed-solution');
 return false;
}
function finished(state){const actions=state?.tutorialActions||[];return !!state?.completed&&actions.includes('graded')&&actions.includes('viewed-solution')&&state.guideStep>=9;}
return Object.freeze({ready,finished});
});
