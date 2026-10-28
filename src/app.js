(function () {
  'use strict';
  const E = window.THEngine;
  const I = window.THI18n;
  const localize = scope => I?.apply(scope);
  const app = document.getElementById('app');
  const dialog = document.getElementById('dialog');
  const toastNode = document.getElementById('toast');
  const importInput = document.getElementById('import-file');
  const KEY = 'threat-hunting-room.progress.v1';
  const ROLES = {support:'仮説を支持',counter:'反証・別の説明',context:'背景・比較',gap:'観測不足'};
  const VERDICTS = {supported:'仮説を支持する証拠あり',benign:'正当な業務で説明できる',insufficient:'観測不足で判断できない',unsubstantiated:'調査範囲では裏付けなし'};
  const OPERATIONS = {search:'検索',aggregate:'集計',compare:'通常期間との比較',pivot:'関連記録への追跡'};
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const emptyFilters = task => ({query:'',source:'',host:'',period:'current',from:'',to:'',timezone:task?.periods?.current?.timezone||'UTC'});
  const freshUI = () => ({task:null,level:'intro',part:1,chapter:'I',aggregateSort:'count-desc',queryResult:null,exitQueryResult:null,exitGrade:null,extensionGrade:null,tab:'logs',reportTab:'evidence',filters:emptyFilters(),page:0,group:'host',aggregateRan:false,compareRan:false,compareSource:'',compareField:'host',grade:null,guideVisible:true});
  const PIVOT_FIELDS = ['host','user','source','sensor','process','destination','parent','session','pid','process_guid','parent_process_guid','request_id','device_id','hash','parent_process'];
  const queryValue = value => '"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
  let tasks, releaseVersion='', environments={}, saved = {schemaVersion:3,taskStates:{},lastTask:null,activeTask:null,timeDisplay:'utc'};
  let ui = freshUI(), storageWarning = '', pendingImport = null, toastTimer, extensionDialogOpen = false;
  try {
    const data = JSON.parse(document.getElementById('task-data').textContent);
    tasks = Array.isArray(data) ? data : data.tasks;
    releaseVersion=Array.isArray(data)?'':data.releaseVersion||'';
    environments=Array.isArray(data)?{}:(data.environments||{});
    const maps=new Map(Object.entries(environments).map(([id,env])=>[id,new Map(env.logs.map(l=>[l.id,l]))]));
    tasks=tasks.map(task=>{
      if(!task.environment||Array.isArray(task.logs))return task;
      const env=environments[task.environment],map=maps.get(task.environment);
      if(!env||!map)throw new Error('missing environment');
      return {...task,assets:env.assets,environmentName:env.name,environmentLogCount:env.logs.length,logs:task.logIds.map(id=>{const row=map.get(id);if(!row)throw new Error('missing record');return row;})};
    });
    if (!Array.isArray(tasks) || !tasks.length || !E || !window.THView) throw new Error('missing application data');
  } catch (error) {
    app.innerHTML='<main class="home"><h1>教材を開けませんでした</h1><p>HTMLファイルが最後まで保存されているか確認し、もう一度開いてください。</p></main>';
    localize(app);
    return;
  }
  const taskById = new Map(tasks.map(task => [task.id, task]));
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      saved = E.validateProgress(JSON.parse(raw), tasks);
      if(saved.migrated) {
        storageWarning='旧版の記録ID・選択肢を対応づけ、進捗を新しい条件で確認しました。第2部は日本時間の営業日に合わせてログを改訂しました。旧版の手動日付はUTCとして保持しています。保存した検索式やメモの時刻も見直してください。';
        delete saved.migrated;
      }
    }
  } catch (error) {
    storageWarning='ブラウザの保存済み進捗を読み込めませんでした。この画面では新しい進捗で開始します。進捗の保存・読込にはJSONファイルも使えます。';
  }

  function currentTask() { return taskById.get(ui.task); }
  function tutorialAction(action) {
    const state=currentState();if(ui.task!=='tutorial'||!state)return;
    state.tutorialActions=state.tutorialActions||[];
    if(!state.tutorialActions.includes(action))state.tutorialActions.push(action);
  }
  function highlightTutorial(scroll) {
    for(const node of app.querySelectorAll('.tutorial-focus'))node.classList.remove('tutorial-focus');
    if(ui.task!=='tutorial')return;
    const task=currentTask(),state=currentState(),focus=task.guide[state.guideStep]?.focus;
    const node=app.querySelector('[data-tutorial-target="'+focus+'"]');
    if(node){node.classList.add('tutorial-focus');if(scroll)node.scrollIntoView({block:'center',behavior:'smooth'});}
  }
  function showComparison(kind) {
    const task=currentTask(),state=currentState();if(!task)return;
    const isExit=kind==='exit',d=isExit?state.exitDraft:state.draft;
    const text=kind==='hypothesis'?d.ownHypothesis:d.reflection;
    const model=kind==='hypothesis'?task.modelHypothesis:isExit?task.exit?.modelReflection:task.modelReflection;
    if(!text?.trim()){notify('先に、自分の言葉で書いてみてください。');return;}
    if(!model){notify('この課題には比較用の文章がありません。');return;}
    showDialog('自分の記述と模範例を比べる','<div class="comparison-writing"><section><h3>自分が書いた内容</h3><p class="preserve-lines" data-i18n-raw="true">'+esc(text)+'</p></section><section><h3>模範例</h3><p class="preserve-lines">'+esc(model)+'</p>'+window.THCourse.selfReviewChecklist()+'</section></div><div class="notice">対象・期間・観測できること・残る限界を比べてください。表現の一致や文章の意味は自動採点しません。自分の記述を変更すると、比較の確認はやり直しになります。</div><button class="btn primary" data-action="confirm-comparison" data-kind="'+kind+'">比較したことを記録する</button>');
  }
  function updateExit(element) {
    const state=currentState(),name=element.dataset.exit;
    if(!state||!['query','choice','reflection'].includes(name))return;
    const dirty=Boolean(state.exitCompleted||ui.exitGrade||ui.exitQueryResult||(name==='reflection'&&state.exitDraft.reviewedReflection));
    state.exitCompleted=false;ui.exitGrade=null;ui.exitQueryResult=null;
    state.exitDraft[name]=element.value.slice(0,name==='query'?2000:name==='reflection'?4000:200);
    if(name==='reflection')state.exitDraft.reviewedReflection='';
    persist();if(dirty)render(true);
  }
  function blankState(task) {
    const draft={hypothesis:'',ownHypothesis:'',reviewedHypothesis:'',query:'',choice:'',selections:[],reflection:'',reviewedReflection:'',targets:[],verdict:'',sources:[],from:task.periods.current.from,to:task.periods.current.to,finding:'',alternative:'',evidence:[],summary:'',limitations:'',nextAction:''};
    return {draft,operations:[],completed:false,hintLevel:0,guideStep:0,filters:{...emptyFilters(task),...(task.initialFilters||{})},exitDraft:{...draft,from:'',to:'',targets:[],sources:[],evidence:[],selections:[]},exitCompleted:false,extensionAnswers:{},extensionCompleted:false,tutorialActions:[]};
  }
  function currentState() {
    const task=currentTask();
    if (!task) return null;
    if (!saved.taskStates[task.id]) saved.taskStates[task.id]=blankState(task);
    return saved.taskStates[task.id];
  }
  function persist(syncFilters=true) {
    const state=saved.taskStates[ui.task];
    if(state&&!window.THCourse.extensionReady(currentTask(),state)){state.extensionCompleted=false;ui.extensionGrade=null;}
    if(syncFilters)saved.activeTask=ui.task;
    if(syncFilters&&ui.task&&saved.taskStates[ui.task])saved.taskStates[ui.task].filters={...ui.filters};
    try { localStorage.setItem(KEY,JSON.stringify(saved)); }
    catch (error) { storageWarning='このブラウザでは自動保存できません。「保存」で進捗JSONをダウンロードしてください。画面を閉じるまでは学習を続けられます。'; }
  }
  function notify(message) {
    clearTimeout(toastTimer);
    toastNode.textContent=message;
    localize(toastNode);
    toastNode.classList.add('show');
    toastTimer=setTimeout(()=>toastNode.classList.remove('show'),4000);
  }
  function focusSignature(element) {
    if (!element || !app.contains(element)) return null;
    const key = ['draft','exit','evidenceRole','evidenceNote','array','exitArray'].find(name=>element.dataset && element.dataset[name]);
    return {id:element.id,key,value:key ? element.dataset[key] : '',inputValue:element.value,start:element.selectionStart,end:element.selectionEnd};
  }
  function render(keepFocus) {
    const focus=keepFocus ? focusSignature(document.activeElement) : null;
    ui.timeDisplay=saved.timeDisplay||'utc';
    app.innerHTML=window.THView.render({tasks,environments,saved,ui,storageWarning,releaseVersion});
    localize(document.body);
    highlightTutorial(false);
    document.title=(currentTask() ? (I?I.text(currentTask().title):currentTask().title)+' — ' : '')+'ThreatHunting-room';
    if (focus) {
      let target=null;
      if (focus.id) target=document.getElementById(focus.id);
      if (!target && focus.key) target=[...app.querySelectorAll('[data-'+focus.key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']')].find(el=>el.dataset[focus.key]===focus.value && (focus.key!=='array' || el.value===focus.inputValue));
      if (target) {
        target.focus({preventScroll:true});
        if (typeof focus.start==='number' && typeof target.setSelectionRange==='function') {
          try { target.setSelectionRange(focus.start,focus.end); } catch (error) { /* select/date inputs have no caret range */ }
        }
      }
    }
  }
  function setRoute(id) {
    try { history.pushState(null,'',id ? '#'+encodeURIComponent(id) : '#'); }
    catch (error) { location.hash=id || ''; }
  }
  function startTask(id,changeRoute) {
    const task=taskById.get(id);
    if (!task) return;
    ui={...freshUI(),task:id,level:task.level,part:task.part||1,chapter:window.THCourse.chapter(task)};
    if(task.level==='field'||task.part===2)ui.tab='plan';
    const state=currentState();
    ui.filters={...emptyFilters(task),...(state.filters||{})};
    state.guideStep=Math.min(state.guideStep,Math.max(0,(task.guide || []).length-1));
    if(id==='tutorial'&&state.guideStep>7&&(!state.completed||!state.tutorialActions.includes('graded')))state.guideStep=7;
    if(id==='tutorial'&&state.guideStep>8&&!state.tutorialActions.includes('viewed-solution'))state.guideStep=8;
    if (state.completed) ui.grade=E.gradeTask(task,state.draft,state.operations);
    if(state.exitCompleted&&task.exit)ui.exitGrade=E.gradeExit(task,state.exitDraft);
    if(state.extensionCompleted&&task.extension)ui.extensionGrade=E.gradeExtension(task,state.extensionAnswers);
    if(id==='tutorial'){const step=task.guide[state.guideStep];ui.tab=step?.tab==='report'?'logs':step?.tab||'logs';if(step?.reportTab&&step.focus!=='report-tabs')ui.reportTab=step.reportTab;}
    else saved.lastTask=id;
    if (changeRoute!==false) setRoute(id);
    persist();render();window.scrollTo({top:0,behavior:'instant'});
  }
  function goHome(changeRoute) {
    const {level,part,chapter}=ui;
    ui={...freshUI(),level,part,chapter};
    saved.activeTask=null;persist(false);
    if(changeRoute!==false)setRoute(null);
    render();window.scrollTo({top:0,behavior:'instant'});
  }
  function routeFromHash() {
    let id='';
    try { id=decodeURIComponent(location.hash.slice(1)); } catch (error) { /* ignore broken fragment */ }
    if(taskById.has(id))startTask(id,false);
    else goHome(false);
  }
  function invalidate() {
    const state=currentState();
    const wasGraded=Boolean(ui.grade || ui.queryResult || (state && state.completed));
    if(state){
      state.completed=false;state.exitCompleted=false;
      if(ui.task==='tutorial'){
        state.tutorialActions=(state.tutorialActions||[]).filter(action=>!['graded','viewed-solution'].includes(action));
        if(state.guideStep>7){state.guideStep=7;ui.reportTab='answers';}
      }
    }
    ui.queryResult=null;ui.exitGrade=null;
    ui.grade=null;
    return wasGraded;
  }
  function operation(name) {
    const state=currentState();
    if(state && !state.operations.includes(name))state.operations.push(name);
  }
  function searchPerformed() {
    const f=ui.filters;
    if(E.parseQuery(f.query).errors.length)return;
    if(f.query.trim() || f.source || f.host || f.from || f.to || f.period==='baseline')operation('search');
  }
  function filterChanged() {
    ui.page=0;ui.aggregateRan=false;
    searchPerformed();persist();render();
  }
  function closeDialog() {
    const returnToExtension=extensionDialogOpen;
    if(dialog.open)dialog.close();pendingImport=null;extensionDialogOpen=false;
    if(returnToExtension)app.querySelector('[data-action="open-extension"]')?.focus({preventScroll:true});
  }
  function showDialog(title,html) {
    extensionDialogOpen=false;
    dialog.innerHTML='<div class="dialog-head"><h2 id="dialog-title">'+esc(title)+'</h2><button class="btn quiet" data-action="close-dialog" aria-label="ダイアログを閉じる">閉じる ×</button></div><div class="dialog-body">'+html+'</div>';
    localize(dialog);
    if(!dialog.open)dialog.showModal();
    dialog.scrollTop=0;
  }
  function showExtension(keepPosition=false) {
    const task=currentTask(),state=currentState();
    if(!window.THCourse.extensionReady(task,state))return;
    const focusId=keepPosition?document.activeElement?.id:null,top=dialog.scrollTop;
    showDialog(task.extension.title,window.THCourse.extensionPanel(task,state,ui.extensionGrade));
    extensionDialogOpen=true;
    if(keepPosition){dialog.scrollTop=top;document.getElementById(focusId)?.focus({preventScroll:true});}
  }
  function download(filename,content,type) {
    const url=URL.createObjectURL(new Blob([content],{type:type || 'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function showHelp() {
    showDialog('ThreatHunting-roomの使い方','<p><button class="btn primary" data-action="tutorial-start">操作チュートリアルを開く</button></p><p>仮説を立て、環境全体の記録から候補を見つけ、根拠付きで結論を出す教材です。操作チュートリアル1問、第1部15問、第2部23問を収録しています。第1部の練習・実践9問には、調査を成果物へつなぐ追加ステップがあります。</p><ol><li><b>計画：</b>依頼と環境説明を読み、確かめたい仮説とログを選びます。</li><li><b>調査：</b>ログ検索、集計、通常期間との比較、時系列を使って確かめます。端末名などをクリックすると関連記録を追えます。</li><li><b>証拠：</b>重要な記録を最大8件残し、「支持」「反証」「背景」「観測不足」の役割を指定します。</li><li><b>回答：</b>このタスクで求められる対象や結論を選び、「証拠と回答を確認する」で確認します。</li></ol><p>入門では必要な項目だけを扱い、後半になるほど自分で考える範囲が増えます。ヒントと解説はいつでも利用でき、誤答やヒントによる減点はありません。</p><div class="notice">ログはすべて架空の学習用サンプルです。件数は収録された記録の数で、実環境の全イベントや発生率を表しません。自由記述の意味や報告の品質は自動採点しません。</div><p>進捗はこのブラウザに自動保存します。「保存」でJSONを持ち出し、「読込」で復元できます。外部サービスへの通信は行いません。</p>');
  }
  function showSearchHelp() {
    showDialog('検索式の使い方','<p>空白はAND、大文字の <code>OR</code> はいずれかの条件です。ANDを先に評価します。文字の大小は区別しません。<code>host</code> / <code>user</code> / <code>source</code> / <code>sensor</code> / <code>process</code> / <code>destination</code> / <code>parent</code> と、識別子 <code>session</code> / <code>pid</code> / <code>process_guid</code> / <code>parent_process_guid</code> / <code>request_id</code> / <code>device_id</code> / <code>hash</code> が使えます。日付は <code>after:2026-09-14 before:2026-09-16</code> のように指定でき、両端の日を含むUTC日付で評価します。</p><pre>parent:docview.exe source:端末\nsensor:edge-flow destination:relay-room.example\nhost:WS-42 session:0x248\nprocess_guid:{7a96381a-9311-42cb-950d-cc885da9e7f1} OR parent_process_guid:{7a96381a-9311-42cb-950d-cc885da9e7f1}\nsource:通信 destination:alpha.example OR source:通信 destination:beta.example\nprocess:powershell.exe -source:業務</pre><p>識別子・ハッシュ・sensorは完全一致、それ以外は部分一致です。<code>-語句</code> で除外、<code>&quot;複数の語句&quot;</code> でまとまりを指定します。<code>&quot;OR&quot;</code> は文字列として検索します。括弧によるグループ化には対応しません。</p><p>画面のログ種類・端末・期間・日付と、提出欄の固定評価範囲は、ORの両方の条件に適用します。検索式に書く日付条件は、そのORグループだけに適用します。固定範囲より狭い日を選ぶ場合は両方のグループへ書きます。</p><pre>after:2026-09-15 before:2026-09-15 source:通信 destination:alpha.example OR after:2026-09-15 before:2026-09-15 source:通信 destination:beta.example</pre><p>この式は9月15日UTCの2つの宛先を調べます。JSTでは9月15日09:00から9月16日09:00未満です。JST併記をオンにしても検索式の日付条件はUTCのままです。画面の日付欄はラベルの時間帯で評価します。第2部はJSTが既定で、UTCへ切り替えることもできます。例えば9月15日JSTは9月14日15:00 UTCから9月15日15:00 UTC未満です。提出式は表示された固定評価範囲で採点されます。</p><p>記録上のPID・セッションをクリックすると同じ端末に絞り、GUIDをクリックするとそのプロセスと子プロセスを探します。PID・セッションは時刻を照合し、同一番号だけで関連付けないでください。</p><div class="notice">この検索式は教材用の簡易構文です。KQL・SPLなど実製品の検索言語を完全には再現していません。</div>');
  }
  function showRoles() {
    if(currentTask()?.rubric.openHunt){showDialog('証拠の役割','<p>支持は自分の仮説を裏付ける事実、反証は仮説と異なる説明、背景は比較や条件、観測不足は記録の限界を示します。</p><p>同じ記録でも仮説によって役割が変わります。この自主ハントでは、役割がそろっていることとメモの記入だけを確認します。関連性・役割・文章の意味は自動判定しません。自分の仮説と解説の観点を使って確かめてください。</p>');return;}
    showDialog('証拠の役割','<ul><li><b>仮説を支持：</b>調べている事実や、想定している活動の仮説を裏付ける記録。</li><li><b>反証・別の説明：</b>正常な業務など、別の説明を支える記録。</li><li><b>背景・比較：</b>通常時の状態、資産の役割、調査範囲を理解するための記録。</li><li><b>観測不足：</b>収集停止や対象外など、分からない理由を示す記録。</li></ul><p>同じ記録でも、どの仮説を検証しているかで役割が変わります。この教材では各課題の仮説に対する役割を確認します。</p><p>必須の根拠に加え、課題で関連付けられる補足証拠も受け付けます。無関係な記録や役割違いは、対象の記録IDを採点結果に表示します。</p><p>証拠メモは自分の振り返り用です。文章の意味は自動採点されません。</p>');
  }
  function showHint(advance) {
    const task=currentTask(),state=currentState();if(!task)return;
    const max=Math.min(3,(task.hints || []).length);
    state.hintLevel=Math.min(max,Math.max(1,state.hintLevel+(advance ? 1 : 0)));
    persist();
    const html=(task.hints || []).slice(0,state.hintLevel).map((hint,index)=>'<div class="hint"><h3>ヒント '+(index+1)+'</h3><p>'+esc(hint)+'</p></div>').join('');
    showDialog('調査のヒント',html+'<p class="small muted">ヒントを使っても減点されません。解説を見るだけではタスクは完了しません。</p>'+(state.hintLevel<max ? '<button class="btn primary" data-action="next-hint">次のヒントを見る</button>' : '<button class="btn" data-action="solution">解説と報告例を見る</button>'));
    render();
  }
  function showSolution() {
    const task=currentTask();if(!task)return;
    if(task.id==='tutorial'&&currentState().completed&&currentState().tutorialActions.includes('graded')){tutorialAction('viewed-solution');persist();render();}
    const x=task.explanation || {},r=task.rubric;
    const hypothesis=(task.hypotheses || []).find(h=>(r.hypotheses || []).includes(h.id));
    const finding=(task.findings || []).find(f=>f.id===r.finding);
    const answerRows=[];
    if(task.rubric.query&&x.sampleQuery)answerRows.push('<p><b>検索条件の一例：</b><code>'+esc(x.sampleQuery)+'</code></p>');
    if(task.choices)answerRows.push('<p><b>判断：</b>'+esc(task.choices.find(o=>o.id===r.choice)?.label||'')+'</p>');
    if(task.selectionOptions)answerRows.push('<p><b>必要項目：</b>'+esc((r.selections||[]).map(id=>task.selectionOptions.find(o=>o.id===id)?.label||id).join(' / '))+'</p>');
    if(task.reflectionPrompt)answerRows.push('<p><b>記述の模範例：</b>'+esc(task.modelReflection||'')+'</p>');
    if(hypothesis)answerRows.push('<p><b>仮説：</b>'+esc(hypothesis.label)+'</p>');
    if(r.targets)answerRows.push('<p><b>対象：</b>'+esc(r.targets.join(' / ') || '対象なし')+'</p>');
    if(r.sources)answerRows.push('<p><b>必要なログ：</b>'+r.sources.map(name=>'<span data-i18n-source>'+esc(name)+'</span>').join(' / ')+'</p>');
    if(r.verdict)answerRows.push('<p><b>結論：</b>'+esc(VERDICTS[r.verdict])+'</p>');
    if(r.alternative)answerRows.push('<p><b>良性の説明を検討した結果：</b>'+esc(task.alternativeExplanations.find(item=>item.id===r.alternative)?.label||'')+'</p>');
    if(finding)answerRows.push('<p><b>残る確認：</b>'+esc(finding.label)+'</p>');
    if(task.hypothesisPrompt)answerRows.unshift('<h3>自分の仮説と模範例</h3><p class="preserve-lines" data-i18n-raw="'+Boolean(currentState().draft.ownHypothesis)+'">'+esc(currentState().draft.ownHypothesis || '（未記入）')+'</p><p>'+esc(task.modelHypothesis)+'</p>');
    const evidence=(r.evidenceGroups || []).map(group=>'<li><b>'+esc(group.label)+'</b>：'+esc(group.anyOf.join(' または '))+'（'+esc(ROLES[group.role])+'）</li>').join('');
    const extras=(r.evidenceExtras || []).map(item=>'<li><b>'+esc(item.id)+'</b>（'+esc(item.roles.map(role=>ROLES[role]).join(' / '))+'）：'+esc(item.reason)+'</li>').join('');
    showDialog('解説・報告例','<p>'+esc(x.summary)+'</p><ol>'+(x.reasoning || []).map(line=>'<li>'+esc(line)+'</li>').join('')+'</ol><div class="answer-box">'+answerRows.join('')+'</div>'+(evidence ? '<h3>必要な根拠の例</h3><ul>'+evidence+'</ul>' : '')+(extras ? '<details><summary>補足証拠として使える記録と役割</summary><ul>'+extras+'</ul></details>' : '')+'<h3>報告の例</h3><pre data-i18n-example>'+esc(x.sampleReport || '')+'</pre>'+window.THCourse.selfReviewChecklist()+'<p><b>次に考えること：</b>'+esc(x.next)+'</p><p class="small muted">解説を確認しても進捗は完了になりません。自分の回答と証拠をそろえ、「証拠と回答を確認する」を実行してください。自由文の意味は自動採点しません。</p>'+window.THCourse.practiceNotes(task)+window.THCourse.extensionLink(task,currentState()));
  }
  function showLog(id) {
    const task=currentTask(),state=currentState();if(!task)return;
    const log=task.logs.find(item=>item.id===id);if(!log)return;
    if(task.id==='tutorial'&&task.rubric.evidenceGroups[0].anyOf.includes(id)){tutorialAction('opened-log');persist();render();}
    showDialog('記録の詳細 · '+log.id,'<div class="log-detail-meta"><span class="badge" data-i18n-raw="true">'+esc(log.source)+'</span>'+window.THView.timeMarkup(log.at,ui.timeDisplay)+'<span class="log-period">'+esc(log.period==='baseline' ? '通常期間' : '調査期間')+'</span></div><h3 data-i18n-raw="true">'+esc(log.event)+'</h3><p data-i18n-raw="true">'+esc(log.detail)+'</p>'+(log.raw?'<h3>元のログ（合成）</h3><pre>'+esc(log.raw)+'</pre>':'')+'<h3>構造化した項目</h3><pre>'+esc(JSON.stringify(log,null,2))+'</pre>'+(state.draft.evidence.some(item=>item.id===id) ? '<p class="small">この記録は証拠に登録済みです。</p>' : '<button class="btn primary" data-action="add-evidence" data-id="'+esc(id)+'">証拠に追加</button>'));
  }
  function exportReport() {
    const task=currentTask(),state=currentState();if(!task)return;
    download('ThreatHunting-room-'+task.id+'-report.txt',window.THReports.record(task,state));
    notify('7項目のハント記録と成果物を保存しました。');
  }
  function exportLogs() {
    const task=currentTask();if(!task)return;
    const rows=E.filterLogs(task.logs,ui.filters);
    if(!rows.length){notify('書き出せる記録がありません。検索条件を確認してください。');return;}
    const columns=['id','at','period','source','sensor','host','user','event','detail','destination','process','parent','session','pid','process_guid','parent_process_guid','request_id','device_id','hash','raw','bytes'];
    const cell=value=>{let string=String(value==null ? '' : value);if(/^[=+\-@\t\r]/.test(string))string="'"+string;return '"'+string.replace(/"/g,'""')+'"';};
    const csv='\uFEFF'+[columns.join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n');
    download('ThreatHunting-room-'+task.id+'-logs.csv',csv,'text/csv;charset=utf-8');notify(rows.length+'件の検索結果をCSVに書き出しました。');
  }
  function setGuideStep(index) {
    const task=currentTask(),state=currentState();if(!task)return;
    const guides=task.guide || [];
    state.guideStep=Math.max(0,Math.min(guides.length-1,Number.isFinite(index) ? index : 0));
    const step=guides[state.guideStep];
    if(step && step.tab==='report')ui.reportTab='answers';
    else if(step && ['plan','logs','aggregate','compare','timeline'].includes(step.tab))ui.tab=step.tab;
    if(task.id==='tutorial'&&step?.reportTab&&step.focus!=='report-tabs')ui.reportTab=step.reportTab;
    ui.guideVisible=true;ui.page=0;persist();render();
    if(task.id==='tutorial')highlightTutorial(true);
    if(step && step.tab==='report')app.querySelector('.report')?.scrollIntoView({block:'start',behavior:'smooth'});
  }
  function performAction(button) {
    const action=button.dataset.action,task=currentTask(),state=task ? currentState() : null;
    switch(action) {
      case 'home':goHome();break;
      case 'tutorial-start':if(taskById.has('tutorial')){if(button.dataset.reset==='true')saved.taskStates.tutorial=blankState(taskById.get('tutorial'));closeDialog();startTask('tutorial');}break;
      case 'tutorial-focus':if(task?.id==='tutorial'){const step=task.guide[state.guideStep];ui.tab=step.tab==='report'?'logs':step.tab||'logs';if(step.reportTab&&step.focus!=='report-tabs')ui.reportTab=step.reportTab;render();highlightTutorial(true);}break;
      case 'part':if(['1','2'].includes(button.dataset.part)){ui.part=Number(button.dataset.part);ui.chapter=ui.part===1?'I':'A';render();}break;
      case 'chapter':if(window.THCourse.chapters[button.dataset.chapter]){ui.chapter=button.dataset.chapter;ui.part=window.THCourse.chapters[ui.chapter].part;render();}break;
      case 'export-plan':download('ThreatHunting-room-first-hunt-plan.txt',window.THReports.plan(tasks,saved,Object.values(environments)[0]));notify('自分の記録を含むハント計画書のひな形を保存しました。');break;
      case 'start':startTask(button.dataset.id);break;
      case 'level':if(['intro','practice','field'].includes(button.dataset.level)){ui.level=button.dataset.level;ui.part=1;ui.chapter=ui.level==='intro'?'I':ui.level==='practice'?'P':'F';render();}break;
      case 'help':showHelp();break;
      case 'export':download('ThreatHunting-room-progress.json',JSON.stringify(saved,null,2),'application/json;charset=utf-8');notify('進捗JSONを保存しました。');break;
      case 'import':importInput.click();break;
      case 'close-dialog':closeDialog();break;
      case 'confirm-import':{
        const imported=pendingImport;if(!imported)return;
        const last=imported.lastTask || saved.lastTask;
        saved={schemaVersion:3,taskStates:{...saved.taskStates,...imported.taskStates},lastTask:last,activeTask:imported.activeTask||null,timeDisplay:imported.timeDisplay||'utc'};
        closeDialog();persist(false);
        if(imported.activeTask==='tutorial'&&imported.taskStates.tutorial)startTask('tutorial');else if(last && taskById.has(last))startTask(last);else goHome();
        notify(imported.migrated ? '旧版の進捗を引き継ぎました。変更された回答と証拠を新しい採点条件で確認しました。' : '進捗を読み込みました。完了状態は回答から再確認しました。');break;
      }
      case 'tab':if(task && ['logs','plan','aggregate','compare','timeline'].includes(button.dataset.tab)){ui.tab=button.dataset.tab;ui.page=0;render();}break;
      case 'report-tab':if(['evidence','answers','exit'].includes(button.dataset.tab)){ui.reportTab=button.dataset.tab;if(task?.id==='tutorial'&&ui.reportTab==='answers')tutorialAction('opened-answers');persist();render();}break;
      case 'toggle-guide':ui.guideVisible=!ui.guideVisible;render();break;
      case 'guide-prev':if(state)setGuideStep(state.guideStep-1);break;
      case 'guide-next':if(state){if(task.id==='tutorial'&&!window.THTutorial.ready(task,state,ui,E)){notify('案内された操作を済ませてから次へ進みましょう。');break;}if(state.guideStep>=(task.guide||[]).length-1){ui.reportTab='answers';render();app.querySelector('.report')?.scrollIntoView({block:'start',behavior:'smooth'});}else setGuideStep(state.guideStep+1);}break;
      case 'guide-step':if(task?.id!=='tutorial')setGuideStep(Number(button.dataset.step));break;
      case 'clear-filters':ui.filters=emptyFilters(task);ui.page=0;ui.aggregateRan=false;persist();render();break;
      case 'apply-date':{
        const pendingQuery=document.getElementById('query')?.value;
        const from=app.querySelector('[data-filter-date="from"]')?.value || '',to=app.querySelector('[data-filter-date="to"]')?.value || '';
        if(from && to && from>to){notify('開始日は終了日以前にしてください。');return;}
        ui.filters.from=from;ui.filters.to=to;filterChanged();
        if(pendingQuery!==undefined&&document.getElementById('query'))document.getElementById('query').value=pendingQuery;
        break;
      }
      case 'inventory-sources':if(task?.id==='a01'){ui.filters={...emptyFilters(task),source:'収集',period:'all'};ui.tab='logs';filterChanged();}break;
      case 'source':if(task && task.sources.some(s=>s.name===button.dataset.source)){ui.filters.source=button.dataset.source;ui.tab='logs';filterChanged();}break;
      case 'toggle-time':{
        const inputs=[['#query',document.getElementById('query')],['[data-filter-date="from"]',app.querySelector('[data-filter-date="from"]')],['[data-filter-date="to"]',app.querySelector('[data-filter-date="to"]')]];
        const pending=ui.tab==='logs'?inputs.filter(([,element])=>element).map(([selector,element])=>[selector,element.value]):[];
        saved.timeDisplay=saved.timeDisplay==='utc-jst'?'utc':'utc-jst';persist();render();
        for(const [selector,value] of pending){const element=selector==='#query'?document.getElementById('query'):app.querySelector(selector);if(element)element.value=value;}
        break;
      }
      case 'search-help':showSearchHelp();break;
      case 'page-prev':ui.page=Math.max(0,ui.page-1);render();break;
      case 'page-next':ui.page++;render();break;
      case 'run-aggregate':if(task){if(E.parseQuery(ui.filters.query).errors.length){notify('先に検索式のエラーを修正してください。');return;}ui.aggregateRan=true;operation('aggregate');persist();render();}break;
      case 'run-compare':if(task){ui.compareRan=true;operation('compare');persist();render();}break;
      case 'pivot':{
        const field=button.dataset.field;
        if(!task || !PIVOT_FIELDS.includes(field))return;
        const value=button.dataset.value || '';if(!value || value==='（記録なし）'){notify('この項目には追跡できる値が記録されていません。');return;}
        let query=field+':'+queryValue(value);
        if(field==='parent_process'){if(!button.dataset.parent||!button.dataset.process){notify('親と子の両方が記録された行から追跡してください。');return;}query='parent:'+queryValue(button.dataset.parent)+' process:'+queryValue(button.dataset.process);}
        if(['process_guid','parent_process_guid'].includes(field))query='process_guid:'+queryValue(value)+' OR parent_process_guid:'+queryValue(value);
        ui.filters={...emptyFilters(task),period:'all',query};
        if(['pid','session'].includes(field) && button.dataset.host)ui.filters.host=button.dataset.host;
        ui.tab='logs';ui.page=0;ui.aggregateRan=false;operation('pivot');operation('search');persist();render();notify('通常期間も含めて関連記録を検索しました。');break;
      }
      case 'add-evidence':{
        if(!task || !task.logs.some(log=>log.id===button.dataset.id))return;
        if(state.draft.evidence.some(e=>e.id===button.dataset.id)){notify('この記録は登録済みです。');return;}
        if(state.draft.evidence.length>=8){notify('証拠は最大8件です。必要な根拠に絞ってください。');return;}
        invalidate();state.draft.evidence.push({id:button.dataset.id,role:'context',note:''});ui.reportTab='evidence';persist();if(dialog.open)closeDialog();render();notify('証拠に追加しました。役割を確認してください。');break;
      }
      case 'remove-evidence':if(state){invalidate();state.draft.evidence=state.draft.evidence.filter(e=>e.id!==button.dataset.id);persist();render();}break;
      case 'log-detail':showLog(button.dataset.id);break;
      case 'roles-help':showRoles();break;
      case 'hint':showHint(false);break;
      case 'next-hint':showHint(true);break;
      case 'solution':showSolution();break;
      case 'compare-hypothesis':showComparison('hypothesis');break;
      case 'compare-reflection':showComparison('reflection');break;
      case 'compare-exit-reflection':showComparison('exit');break;
      case 'confirm-comparison':{
        if(!task)return;const kind=button.dataset.kind,d=kind==='exit'?state.exitDraft:state.draft;
        const field=kind==='hypothesis'?'ownHypothesis':'reflection',review=kind==='hypothesis'?'reviewedHypothesis':'reviewedReflection';
        if(!d[field]?.trim())return;
        if(kind==='exit'){state.exitCompleted=false;ui.exitGrade=null;}else invalidate();
        d[review]=d[field];persist();closeDialog();render();notify('模範例と比較したことを記録しました。');break;
      }
      case 'copy-query':{
        if(!state)return;const isExit=button.dataset.exit==='true';
        if(isExit){state.exitDraft.query=ui.filters.query;state.exitCompleted=false;ui.exitGrade=null;ui.exitQueryResult=null;}
        else{invalidate();state.draft.query=ui.filters.query;}
        persist();render();notify('探索中の検索式を提出欄へコピーしました。端末・期間など画面のフィルターはコピーしていません。');break;
      }
      case 'test-query':case 'test-exit-query':{
        if(!task)return;const isExit=action==='test-exit-query',spec=isExit?task.exit?.rubric.query:task.rubric.query;
        if(!spec&&!(task.rubric.openHunt&&!isExit))return;const d=isExit?state.exitDraft:state.draft;
        const result=task.rubric.openHunt&&!isExit?E.checkOpenQuery(task,d):E.gradeQuery(isExit&&task.exit.logs?task.exit.logs:task.logs,d.query||'',spec);
        if(isExit)ui.exitQueryResult=result;else ui.queryResult=result;
        if(!result.errors.length&&!isExit&&d.query?.trim())operation('search');
        persist();render();break;
      }
      case 'open-extension':showExtension();break;
      case 'grade-extension':if(window.THCourse.extensionReady(task,state)){ui.extensionGrade=E.gradeExtension(task,state.extensionAnswers);state.extensionCompleted=ui.extensionGrade.passed;persist();render();showExtension();dialog.querySelector('.extension-feedback')?.focus({preventScroll:true});}break;
      case 'grade-exit':if(task?.exit&&state.completed){ui.exitGrade=E.gradeExit(task,state.exitDraft);state.exitCompleted=ui.exitGrade.passed;ui.exitQueryResult=ui.exitGrade.query||null;persist();render();notify(state.exitCompleted?'調査から成果物まで完了しました。':'成果物の未達成項目を確認してください。');}break;
      case 'exit-solution':if(task?.exit){const x=task.exit,ex=x.explanation||{};showDialog('成果物の解説','<h3>'+esc(x.title)+'</h3><p>'+esc(typeof ex==='string'?ex:ex.summary||'')+'</p>'+(ex.sampleQuery?'<pre>'+esc(ex.sampleQuery)+'</pre>':'')+'<p class="preserve-lines">'+esc(x.modelReflection||ex.sampleReport||'')+'</p>'+window.THCourse.selfReviewChecklist()+'<p>'+esc(ex.next||'')+'</p>'+window.THCourse.practiceNotes(x)+window.THCourse.extensionLink(task,state));}break;
      case 'grade':if(task){ui.grade=E.gradeTask(task,state.draft,state.operations);state.completed=ui.grade.passed;if(state.completed)tutorialAction('graded');state.exitCompleted=state.completed&&Boolean(task.exit)&&E.gradeExit(task,state.exitDraft).passed;ui.queryResult=ui.grade.query||null;persist();render();notify(ui.grade.passed ? task.rubric.openHunt?'提出構成と自己比較を確認しました。内容の正しさは自動判定していません。':'タスクを完了しました。解説で考え方を振り返れます。' : '未達成の観点を確認し、調査と回答を見直してください。');app.querySelector('.feedback')?.scrollIntoView({block:'nearest',behavior:'smooth'});}break;
      case 'restart':if(task)showDialog('このタスクをやり直す','<p>「'+esc(task.title)+'」の回答・証拠・操作履歴・ヒント履歴を初期状態に戻します。他のタスクの進捗は残ります。</p><div class="row"><button class="btn primary" data-action="confirm-restart">このタスクを初期化する</button><button class="btn" data-action="close-dialog">戻る</button></div>');break;
      case 'confirm-restart':if(task){saved.taskStates[task.id]=blankState(task);closeDialog();startTask(task.id);notify('このタスクを最初から始めます。');}break;
      case 'export-report':exportReport();break;
      case 'export-logs':exportLogs();break;
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');
    if(!button || button.disabled)return;
    event.preventDefault();
    try{performAction(button);}catch(error){notify('操作を完了できませんでした。入力内容を確認し、もう一度お試しください。');console.error(error);}
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='search-form')return;
    event.preventDefault();ui.filters.query=document.getElementById('query').value.slice(0,2000);filterChanged();
  });
  function updateDraft(element) {
    const state=currentState();if(!state)return false;
    const name=element.dataset.draft;
    if(!['hypothesis','ownHypothesis','from','to','verdict','finding','alternative','summary','query','choice','reflection','limitations','nextAction'].includes(name))return false;
    if((name==='from' && element.value && state.draft.to && element.value>state.draft.to)||(name==='to' && element.value && state.draft.from && element.value<state.draft.from)){
      element.value=state.draft[name];notify('開始日は終了日以前にしてください。');return false;
    }
    const reviewed=(name==='ownHypothesis'&&state.draft.reviewedHypothesis)||(name==='reflection'&&state.draft.reviewedReflection);
    const dirty=invalidate()||Boolean(reviewed);
    state.draft[name]=element.value.slice(0,name==='summary'?12000:['ownHypothesis','reflection','limitations','nextAction'].includes(name)?4000:name==='query'?2000:200);
    if(name==='ownHypothesis')state.draft.reviewedHypothesis='';if(name==='reflection')state.draft.reviewedReflection='';
    persist();if(dirty)render(true);
    return true;
  }
  document.addEventListener('input',event=>{
    const element=event.target;
    if(element.matches('[data-exit]')){updateExit(element);return;}
    if(element.matches('[data-draft]')){updateDraft(element);return;}
    if(element.matches('[data-evidence-note]')){
      const state=currentState(),evidence=state && state.draft.evidence.find(e=>e.id===element.dataset.evidenceNote);
      if(evidence){evidence.note=element.value.slice(0,2000);const dirty=currentTask()?.rubric.openHunt?invalidate():false;persist();if(dirty)render(true);}
    }
  });
  document.addEventListener('change',event=>{
    const element=event.target,state=currentState();
    if(element.matches('[data-language]')){
      if(I?.setLanguage(element.value)){document.title=(currentTask()?I.text(currentTask().title)+' — ':'')+'ThreatHunting-room';}
      return;
    }
    if(element.matches('[data-filter]')){
      const key=element.dataset.filter;
      if(['source','host','period','timezone'].includes(key)){
        const pending=key==='timezone'?[['#query',document.getElementById('query')],['[data-filter-date="from"]',app.querySelector('[data-filter-date="from"]')],['[data-filter-date="to"]',app.querySelector('[data-filter-date="to"]')]].filter(([,node])=>node).map(([selector,node])=>[selector,node.value]):[];
        ui.filters[key]=element.value;filterChanged();
        for(const [selector,value] of pending){const node=selector==='#query'?document.getElementById('query'):app.querySelector(selector);if(node)node.value=value;}
      }return;
    }
    if(element.id==='aggregate-sort'){ui.aggregateSort=element.value;ui.aggregateRan=false;render();return;}
    if(element.id==='aggregate-field'){ui.group=element.value;ui.aggregateRan=false;render();return;}
    if(element.id==='compare-field'){ui.compareField=element.value;ui.compareRan=false;render();return;}
    if(element.id==='compare-source'){ui.compareSource=element.value;ui.compareRan=false;render();return;}
    if(!state)return;
    if(element.matches('[data-extension-answer]')){
      const task=currentTask(),question=task.extension?.questions.find(q=>q.id===element.dataset.extensionAnswer);
      if(!window.THCourse.extensionReady(task,state)||!question||!question.options.some(o=>o.id===element.value)||!element.checked)return;
      state.extensionAnswers={...state.extensionAnswers,[question.id]:element.value};state.extensionCompleted=false;ui.extensionGrade=null;
      persist();render();showExtension(true);return;
    }
    if(element.matches('[data-exit]')){updateExit(element);return;}
    if(element.matches('[data-draft]')){updateDraft(element);return;}
    if(element.matches('[data-array]')){
      const field=element.dataset.array;if(!['targets','sources','selections'].includes(field))return;
      invalidate();const values=new Set(state.draft[field]||[]);if(element.checked)values.add(element.value);else values.delete(element.value);state.draft[field]=[...values];persist();render(true);return;
    }
    if(element.matches('[data-exit-array]')){const values=new Set(state.exitDraft.selections||[]);if(element.checked)values.add(element.value);else values.delete(element.value);state.exitDraft.selections=[...values];state.exitCompleted=false;ui.exitGrade=null;persist();render(true);return;}
    if(element.matches('[data-evidence-role]')){
      const item=state.draft.evidence.find(e=>e.id===element.dataset.evidenceRole);
      if(item && Object.hasOwn(ROLES,element.value)){invalidate();item.role=element.value;persist();render(true);}return;
    }
  });
  importInput.addEventListener('change',async()=>{
    const file=importInput.files && importInput.files[0];if(!file)return;
    try{
      if(file.size>4000000)throw new Error('進捗ファイルは4MB以内で選んでください。');
      const parsed=JSON.parse(await file.text());
      const incoming=E.validateProgress(parsed,tasks);
      const count=Object.keys(incoming.taskStates).length;
      if(!count)throw new Error('このファイルにはタスクの進捗がありません。');
      const completed=Object.values(incoming.taskStates).filter(x=>x.completed).length;
      showDialog('進捗を読み込む','<p><span data-i18n-raw="true">'+esc(file.name)+'</span><br>保存されている進捗：'+count+'タスク（採点条件達成：'+completed+'件）</p><p>同じタスクの進捗は読み込む内容で置き換えます。他のタスクは残ります。</p>'+ (incoming.migrated ? '<p>旧版の記録ID・選択肢を対応づけ、新しい採点条件で確認しました。第2部のログ時刻を改訂しました。旧版の手動日付はUTCとして保持しています。保存した検索式・自由記述の時刻は自動変換しないため、内容を見直してください。</p>' : '') + ' <div class="row"><button class="btn primary" data-action="confirm-import">この進捗を読み込む</button><button class="btn" data-action="close-dialog">戻る</button></div>');
      pendingImport=incoming;
    }catch(error){showDialog('進捗を読み込めませんでした','<p>'+esc(error instanceof SyntaxError ? 'JSONの形式が正しくありません。ThreatHunting-roomから保存した進捗ファイルを選んでください。' : error.message)+'</p><p>現在の進捗は変更していません。</p>');}
    finally{importInput.value='';}
  });
  dialog.addEventListener('cancel',event=>{pendingImport=null;if(extensionDialogOpen){event.preventDefault();closeDialog();}});
  document.addEventListener('keydown',event=>{
    if(event.key==='/' && !dialog.open && !event.ctrlKey && !event.metaKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){
      const query=document.getElementById('query');if(query){event.preventDefault();query.focus();}
    }
  });
  window.addEventListener('hashchange',routeFromHash);
  window.addEventListener('popstate',routeFromHash);
  if(!location.hash&&taskById.has('tutorial')&&!Object.keys(saved.taskStates).some(id=>id!=='tutorial')&&!window.THTutorial.finished(saved.taskStates.tutorial))startTask('tutorial');else routeFromHash();
})();
