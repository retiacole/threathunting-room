'use strict';
// Independent optional data: no progress or evidence is imported from another room.
const translations={};
const tr=(ja,en)=>(translations[ja]=en,ja);
const periods={baseline:{from:'2026-10-05',to:'2026-10-06'},current:{from:'2026-10-12',to:'2026-10-13'}};
const assets=[
 {host:'CEDAR-ENG-02',device_id:'cedar-e02',role:tr('設計担当の端末','Engineering workstation'),os:'Windows 11',criticality:tr('中','Medium')},
 {host:'CEDAR-OPS-03',device_id:'cedar-o03',role:tr('運用担当の端末','Operations workstation'),os:'Windows 11',criticality:tr('中','Medium')},
 {host:'CEDAR-WEB-01',device_id:'cedar-w01',role:tr('社内ポータル','Internal portal'),os:'Ubuntu 24.04',criticality:tr('高','High')},
];
const logs=[];
function row(host,source,at,event,detail,extra={}){
 const asset=assets.find(a=>a.host===host),sensor=({'端末':'endpoint','通信':'endpoint-network','業務':'change-register','収集':'collection-register','認証':'auth-journal'})[source];
 logs.push({id:'cap-'+String(logs.length+1).padStart(3,'0'),host,device_id:asset.device_id,source,sensor,at,period:at.slice(8,10)<='06'?'baseline':'current',event,detail,provenance:{kind:'synthetic',sensor,format:'normalized',collectionId:'cedar-october-sample'},...extra});
}
const mailMinute={'05':'10','06':'12','12':'08','13':'11'};
for(const day of ['05','06','12','13'])for(const host of ['CEDAR-ENG-02','CEDAR-OPS-03']){
 row(host,'端末',`2026-10-${day}T01:${mailMinute[day]}:00Z`,'Process start','mail.exe launched by explorer.exe; approved mail client',{process:'mail.exe',parent:'explorer.exe',process_guid:host+'-'+day+'-mail'});
 row(host,'通信',`2026-10-${day}T01:${mailMinute[day]}:03Z`,'Network connection','TLS connection; payload and transferred file names are not collected',{process:'mail.exe',process_guid:host+'-'+day+'-mail',destination:'mail.cedar.example',bytes:16000+Number(day)*17});
}
for(const day of ['05','06','12','13']){
 row('CEDAR-WEB-01','認証',`2026-10-${day}T02:00:00Z`,'Authentication','sshd accepted publickey for deploy from 192.0.2.40; scheduled deployment',{user:'deploy',session:'deploy-'+day});
 row('CEDAR-OPS-03','端末',`2026-10-${day}T02:30:00Z`,'Process start','sync-agent.exe launched by ops-service.exe; image=C:/Program Files/Cedar/sync-agent.exe signature=valid',{process:'sync-agent.exe',parent:'ops-service.exe',process_guid:'cedar-sync-'+day,hash:'f7488a7f09e9653a6e998c924ce91c0f50982a98cafae80e660c6f09732018b4'});
 row('CEDAR-OPS-03','通信',`2026-10-${day}T02:30:03Z`,'Network connection','TLS POST; transferred content is not collected',{process:'sync-agent.exe',process_guid:'cedar-sync-'+day,destination:day<'10'?'archive.cedar.example':'transfer.cedar.example',bytes:day<'10'?900000:3600000});
}
row('CEDAR-OPS-03','業務','2026-10-12T00:00:00Z','Approved change','CH-401 approved: CEDAR-OPS-03, ops-service.exe -> signed sync-agent.exe, transfer.cedar.example; 2026-10-12 and 2026-10-13 02:00–03:00 UTC; archive migration; planned volume 3–4 MB per run');
row('CEDAR-ENG-02','端末','2026-10-13T03:14:00Z','Process start','reader.exe opened project-summary.pdf from Downloads',{process:'reader.exe',parent:'explorer.exe',process_guid:'cedar-reader-13'});
row('CEDAR-ENG-02','端末','2026-10-13T03:14:06Z','Process start','image=C:/Users/engineer/AppData/Local/sync-agent.exe signature=unknown; command=refresh',{process:'sync-agent.exe',parent:'reader.exe',process_guid:'cedar-local-13',parent_process_guid:'cedar-reader-13',hash:'a1e8b78045bf772ab6c88171e88adc609ca2d5a901a2bf34bc7d310064679413'});
row('CEDAR-ENG-02','通信','2026-10-13T03:14:09Z','Network connection','TLS POST; process GUID correlated by endpoint network sensor; payload unavailable',{process:'sync-agent.exe',process_guid:'cedar-local-13',destination:'project-cdn.example',bytes:2400});
row('CEDAR-ENG-02','業務','2026-10-13T04:00:00Z','Change register excerpt','CH-401 applies only to CEDAR-OPS-03 and ops-service.exe; no other sync-agent change appears in this register excerpt. Unregistered business activity cannot be excluded.');
row('CEDAR-WEB-01','認証','2026-10-13T04:12:00Z','Authentication failures','sshd failed password for invalid user test from 198.51.100.73; 6 attempts in 60 seconds; no accepted login in this excerpt',{user:'test',session:'web-attempt-13'});
row('CEDAR-WEB-01','収集','2026-10-13T05:00:00Z','Collection coverage','Auth logs available in both periods; process auditing not configured; network telemetry for WEB-01 unavailable. Authentication outcomes do not establish subsequent execution.');
for(const host of ['CEDAR-ENG-02','CEDAR-OPS-03'])row(host,'収集','2026-10-13T06:00:00Z','Collection coverage','Endpoint process and correlated network events sampled during both two-day windows; byte counts available, payload and file contents unavailable; absence outside this sample cannot be inferred.');
const sources=[['端末','プロセスの実行・親・実行GUID。全ファイルの内容は含みません。','Process execution, parent and execution GUID; not all file contents.'],['通信','宛先・通信量・対応GUID。送信内容はありません。','Destination, volume and correlated GUID; no transmitted content.'],['業務','申請の対象・時間・実行条件。未登録業務を否定する資料ではありません。','Approved scope, time and execution conditions; does not exclude unregistered business activity.'],['認証','認証結果。認証後の活動は保証しません。','Authentication outcomes; does not establish activity after authentication.'],['収集','取得項目と対象外。0件の解釈に使います。','Coverage and exclusions; use when interpreting zero results.']].map(([name,ja,en])=>({name,description:tr(ja,en)}));
const task={id:'x01',optional:true,part:0,chapter:'X',level:'field',minutes:'35–50',
 title:tr('自主ハント：初見の記録から問いを選ぶ','Independent hunt: choose a question from unfamiliar records'),
 subtitle:tr('G02の後に試す、任意の卒業演習','Optional capstone to try after G02'),focus:tr('起点の選択から次の行動まで','From choosing a starting point to the next action'),
 brief:tr('新しい環境の収録記録から、優先して確かめる問いを一つ選んでください。特定の端末・仮説・結論は指定しません。比較用と今回の期間、別の説明、収集の限界を調べ、再現できる検索式と根拠を添えて報告します。','Choose one question to prioritize in this new environment. No host, hypothesis or conclusion is prescribed. Examine baseline and current periods, alternative explanations and collection limits; report evidence and a reproducible query.'),
 context:tr('架空のCedar社の3資産です。各期間は2日間の固定標本で、件数は全活動量ではありません。通信量の変化、プロセスの関係、認証結果などから起点を選べます。ほかのroomの履歴は使いません。','Three assets at fictional Cedar. Each period is a fixed two-day sample, not a complete activity census. Volume changes, process relationships or authentication outcomes can be starting points. Other rooms are not prerequisites.'),
 periods,assets,logs,sources,hypotheses:[],findings:[],guide:[],
 hypothesisPrompt:tr('起点を選んだ理由、対象・期間、検証する行動、仮説を弱める条件を書いてから調べます。','Before investigating, write why you chose the starting point, its scope and period, the behavior to test and what would weaken your hypothesis.'),
 modelHypothesis:tr('比較の観点：起点をログで示せるか。対象・期間・行動を検証可能な形で書いたか。正当な業務や収集漏れで説明できる条件を先に置いたか。以下の解説例と異なる起点でも構いません。','Review: can you identify the starting record? Are target, period and behavior testable? Have you stated conditions under which legitimate work or missing telemetry would explain the observation? Your starting point may differ from the examples.'),
 reflectionPrompt:tr('自己レビュー：比較・反証・限界・次の行動を照合する','Self-review: compare baseline, counterevidence, limits and next actions'),
 modelReflection:tr('確認表：①両期間を同じ種類・役割で比べたか。②業務条件と実績を照合し、別の説明を検討したか。③記録のID・時刻・GUIDを結論につないだか。④検索式を第三者が再実行できるか。⑤観測範囲外を断定していないか。⑥次に誰が何を確認するか。差分と修正点を自分の考察に記録してください。','Checklist: compare the same source and role across periods; compare approvals with observed activity and consider alternatives; connect IDs, times and GUIDs to the conclusion; make the query reproducible; avoid claims beyond coverage; name who should check what next. Record differences and revisions in your reflection.'),
 hints:[tr('資産台帳と収集資料を確認し、集計や比較で気になった観測を一つ選びます。','Inspect assets and coverage, then choose an observation from aggregation or comparison.'),tr('同じ名前だけで結び付けず、親・実行GUID・宛先・業務条件を照合します。反証は別の説明を支える事実として残します。','Do not join on names alone. Compare parent, execution GUID, destination and approved conditions. Retain counterevidence that supports an alternative explanation.'),tr('4〜8件の証拠にメモを付けます。両期間・2種類以上のログと、背景・反証・観測不足の役割を含めます。提出式は両期間の全記録に適用され、選んだ証拠を再取得できるか確認します。','Annotate 4–8 evidence records spanning both periods and at least two sources, with context, counterevidence and gap roles. The submitted query runs against all records in both periods and must retrieve your selected evidence.')],
 rubric:{openHunt:true,selfReview:true,reflection:true,scope:true,operations:['search','aggregate','compare'],evidenceGroups:[]},
 explanation:{summary:tr('この演習の完了は提出構成と自己比較の確認です。仮説・結論・証拠の意味が正しいという認定ではありません。','Completion confirms submission structure and self-comparison. It does not certify the meaning of your hypothesis, conclusion or evidence.'),
 reasoning:[tr('例1：OPS-03の通信量と宛先の変化はCH-401と照合できます。承認された端末・親・時間・宛先の一致を確かめると、今回の業務という説明を検討できます。','Example 1: compare changes in OPS-03 volume and destination with CH-401. Matching host, parent, time and destination supports a business explanation for this activity.'),tr('例2：ENG-02では同名の実行でも親・場所・hash・宛先が異なります。文書閲覧後の実行と通信をGUIDで結び付け、OPS-03の承認を流用できない理由を示します。通信内容や侵害成立は断定できません。','Example 2: ENG-02 has the same process name but a different parent, path, hash and destination. Link document-related execution to communication by GUID and explain why the OPS-03 approval does not apply. Payload or successful compromise remains unproven.'),tr('例3：WEB-01の失敗認証を起点にできますが、成功の有無とその後の活動は区別します。未収集のプロセス・通信を根拠に「侵害なし」とは言えません。','Example 3: start with WEB-01 failed authentications, but distinguish authentication outcomes from later activity. Missing process and network telemetry cannot establish absence of compromise.')],
 sampleReport:tr('例（概要）：OPS-03の移行作業を調査した。比較用と今回の実行・通信を照合し、CH-401の対象・時間・親・宛先に一致する今回の活動を確認した。内容や標本外の活動は未確認。運用担当へ転送対象と作業結果を確認する。自分の報告には選んだ証拠ID、検索式、反証の検討と具体的な確認先も追記する。','Example outline: investigated OPS-03 archive migration. Baseline and current process/network records match CH-401 host, time, parent and destination for current activity. Content and activity outside the sample remain unverified. Ask operations to confirm transfer objects and job results. Add your selected evidence IDs, query, alternative explanation and specific follow-up owner.'),
 next:tr('報告を保存し、自己比較で残った不足を直すか、学習マップから必要な章を復習してください。','Save the report and address gaps from self-review, or revisit a chapter from the learning map.')}
};
module.exports={task,translations};
