(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.THReports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const tr=value=>globalThis.THI18n?globalThis.THI18n.text(value):String(value??'');
const VERDICTS={supported:'仮説を支持する証拠あり',benign:'正当な業務で説明できる',unsubstantiated:'調査範囲では裏付けなし',insufficient:'観測不足で判断できない'};
const empty='（未記入）';
const label=(options,id)=>tr((options||[]).find(o=>o.id===id)?.label||'');
const queryScope=(f={})=>[f.period==='current'?tr('今回の期間'):f.period==='baseline'?tr('比較用期間'):tr('比較用＋今回の両期間'),f.source||tr('全ログ種別'),f.host||tr('全端末'),f.from?tr('開始 ')+f.from:'',f.to?tr('終了 ')+f.to+tr('（当日を含む）'):''].filter(Boolean).join(' / ');
const zoneLabel=f=>f?.timezone==='Asia/Tokyo'?'JST':'UTC';
const queryScopes=spec=>!spec?[]:[tr('提出式の固定評価範囲（')+zoneLabel(spec.filters)+'）：'+queryScope(spec.filters),...(spec.validation?[tr('別評価の固定範囲（')+zoneLabel({...spec.filters,...spec.validation.filters})+'）：'+queryScope({...spec.filters,...spec.validation.filters})]:[])];
function record(task,state={}){
 const d=state.draft||{},f=state.filters||{},r=task.rubric||{},lines=[tr('ThreatHunting-room / ハント記録'),task.id+' '+tr(task.title),state.completed?tr('状態：調査の採点条件を達成'):tr('状態：草稿'), ''];
 const selectedSources=(d.sources||[]).length?d.sources:[...new Set((d.evidence||[]).map(e=>task.logs.find(l=>l.id===e.id)?.source).filter(Boolean))];
 const scope=r.scope?(d.from||task.periods.current.from)+' ～ '+(d.to||task.periods.current.to):f.period==='all'?tr('比較用 ')+task.periods.baseline.from+' ～ '+task.periods.baseline.to+tr('、今回 ')+task.periods.current.from+' ～ '+task.periods.current.to+tr('（収録した2区間）'):(f.period==='baseline'?task.periods.baseline.from:task.periods.current.from)+' ～ '+(f.period==='baseline'?task.periods.baseline.to:task.periods.current.to);
 lines.push(tr('1. 仮説'),d.ownHypothesis||label(task.hypotheses,d.hypothesis)||tr(task.brief)||tr(empty),'',tr('2. 起点'),tr(task.origin||task.focus||tr(empty)),tr('依頼：')+tr(task.brief),'',tr('3. 使ったログ'),selectedSources.join(' / ')||tr(empty),(r.scope?tr('調査期間'):tr('収録期間'))+'（'+zoneLabel(task.periods.current)+'）：'+scope,tr('対象：')+((d.targets||[]).join(' / ')||tr(empty)),'',tr('4. 検索条件'),tr('提出した式：')+(d.query||tr(empty)),tr('探索時の式：')+(f.query||tr('（式なし）')),tr('検索式の after: / before: と証拠の原文時刻はUTC。日付欄の時間帯は探索フィルターのtimezoneを参照。'),tr('探索の期間選択：')+(f.period==='all'?tr('比較用＋今回'):f.period==='baseline'?tr('比較用'):tr('今回')),tr('探索の日付範囲（')+zoneLabel(f)+'）：'+(f.from||tr('開始制限なし'))+' ～ '+(f.to?f.to+tr('（当日を含む）'):tr('終了制限なし')),tr('収録期間と探索の日付範囲が重なる部分を検索します。'),tr('探索フィルター：')+JSON.stringify(f),...queryScopes(r.query),'',tr('5. 結果'),tr(VERDICTS[d.verdict])||label(task.choices,d.choice)||tr('この課題では侵害の結論を採点しません。'),tr('確認した事実・調査メモ：')+(d.summary||tr(empty)));
 if(r.alternative)lines.push(tr('良性の説明を検討した結果：')+(label(task.alternativeExplanations,d.alternative)||tr(empty)));
 if(d.reflection)lines.push(tr('課題で記述した観察・理由：')+d.reflection);
 const finding=label(task.findings,d.finding);
 lines.push('',tr('6. 限界'),d.limitations||tr('（未記入：対象期間、収集していない情報、確かめていないことを記入）'),'',tr('7. 次の行動'),d.nextAction||tr('（未記入：担当者、必要な情報、次回の確認時期を記入）'));
 if(finding)lines.push(tr('選択した調査方針：')+finding);
 if((d.selections||[]).length)lines.push(tr('選択した項目：')+d.selections.map(id=>label(task.selectionOptions,id)||id).join(' / '));
 lines.push('',tr('証拠と役割'));for(const e of d.evidence||[]){const l=task.logs.find(l=>l.id===e.id);if(l)lines.push('['+e.id+'] '+e.role+' / '+l.at+' / '+l.host+' / '+l.source,l.detail,tr('メモ：')+(e.note||tr(empty)));}
 if(task.exit){const x=state.exitDraft||{};lines.push('',tr('成果物：')+tr(task.exit.title),tr('状態：')+(state.exitCompleted?tr('出口の採点条件を達成'):tr('草稿')),tr('検索条件：')+(x.query||tr(empty)),...queryScopes(task.exit.rubric?.query),tr('判断：')+(label(task.exit.choices,x.choice)||tr(empty)),tr('必要項目：')+((x.selections||[]).map(id=>label(task.exit.selectionOptions,id)||id).join(' / ')||tr(empty)),tr('記述：')+(x.reflection||tr(empty)));}
 lines.push('',tr('この記録は架空の教材データに基づきます。自由記述の意味や、本番環境での検知精度は自動評価していません。'));
 return lines.join('\n');
}
function plan(tasks,saved,environment){
 const program=tasks.filter(t=>t.part===2),states=saved.taskStates||{},done=program.filter(t=>states[t.id]?.completed).length;
 const lines=[tr('初めてのハント計画書 / ThreatHunting-room'),tr('記入用ひな形と学習中の記録'),tr('対象環境：')+(tr(environment?.name)||tr('自社環境を記入')),tr('作成者：＿＿＿＿　実施予定：＿＿＿＿　確認者：＿＿＿＿'),tr('教材の第2部：')+done+' / '+program.length+tr('課題の採点条件を達成'),tr('自社で使う際は、資産・権限・取得可能なログ・担当者を自社の情報で置き換えてください。'),''];
 const sections=[[tr('1. 可視性の棚卸し'),['A']],[tr('2. ベースライン'),['B']],[tr('3. 仮説候補と起点'),['C']],[tr('4. 今週実施するハント・優先理由'),['G']],[tr('5. 検証・展開・観測限界からの学び'),['D','E','L']]];
 for(const [title,chapters] of sections){lines.push(title);for(const t of program.filter(t=>chapters.includes(t.chapter))){const d=states[t.id]?.draft||{};lines.push(tr('・')+tr(t.title)+' ['+(states[t.id]?.completed?tr('確認済み'):tr('未完了'))+']');if(d.ownHypothesis)lines.push(tr('  仮説：')+d.ownHypothesis);if(d.reflection)lines.push(tr('  記述：')+d.reflection);if(d.alternative)lines.push(tr('  良性の説明を検討した結果：')+label(t.alternativeExplanations,d.alternative));if(d.choice)lines.push(tr('  選択：')+(label(t.choices,d.choice)||d.choice));if(d.finding)lines.push(tr('  選択した調査方針：')+label(t.findings,d.finding));if(d.limitations)lines.push(tr('  限界：')+d.limitations);if(d.nextAction)lines.push(tr('  次の行動：')+d.nextAction);if((d.sources||[]).length)lines.push(tr('  ログ：')+d.sources.join(' / '));if((d.selections||[]).length)lines.push(tr('  項目：')+d.selections.map(id=>label(t.selectionOptions,id)||id).join(' / '));if(d.query)lines.push(tr('  検索条件：')+d.query);for(const scope of queryScopes(t.rubric?.query))lines.push('  '+scope);if(!Object.keys(d).length)lines.push(tr('  （学習後に記入）'));}lines.push('');}
 lines.push(tr('6. 実施条件'),tr('実施範囲・期間：＿＿＿＿'),tr('担当・レビュー相手：＿＿＿＿'),tr('必要なアクセス権・追加取得依頼：＿＿＿＿'),tr('中止・IR引き継ぎの条件：＿＿＿＿'),tr('次回実施日・見直しのきっかけ：＿＿＿＿'),'',tr('7. ハント記録テンプレート'),tr('仮説：＿＿＿＿'),tr('起点：＿＿＿＿'),tr('使ったログ：＿＿＿＿'),tr('検索条件：＿＿＿＿'),tr('結果（事実と推測を分ける）：＿＿＿＿'),tr('限界：＿＿＿＿'),tr('次の行動（担当・期限）：＿＿＿＿'),'',tr('自由記述は学習者が入力した内容です。意味の自動採点はしていません。未完了の欄もひな形として持ち帰れます。'));
 return lines.join('\n');
}
return Object.freeze({record,plan});
});
