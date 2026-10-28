'use strict';

// Optional explanation only: these notes add no answers or completion criteria.
const translations = {};
const tr = (ja, en) => (translations[ja] = en, ja);
const note = (titleJa, titleEn, bodyJa, bodyEn) => ({
  title: tr(titleJa, titleEn),
  body: tr(bodyJa, bodyEn),
});

const taskNotes = {
  i06: [note(
    '確認したい内容に合う相手へ',
    'Ask the people who can answer the specific question',
    '今回の棚卸しは申請と実行・通信が対応しますが、受信側の処理結果までは分かりません。実務で続きを確認するときは、作業の予定を知る相手と、受信側の記録を確認できる相手を分けて考えます。部署名を決めつけず、対象・期間・確認済みの事実・不足する情報を添えると、相手も答えられる範囲を判断しやすくなります。',
    'The inventory job matches its approval, execution and network records, but the receiving system\'s processing result is unknown. When following up in practice, distinguish the people who know the planned work from those who can inspect the receiving system\'s records. Rather than assuming a department name, provide the target, period, confirmed facts and missing information so the recipient can determine what they can answer.'
  )],
  c01: [note(
    '外部情報と自分の観測を分ける',
    'Separate external intelligence from your own observations',
    '外部レポートは調査のきっかけであり、この環境の実行を示す証拠は端末・通信の記録です。実務では、情報が扱う環境や行動と、自組織の資産・取得できるログが合うか確認してから問いにします。情報提供元へ結果を返す場合も、今回なら「指定期間に類似した親子実行と通信を確認したが、取得元や通信目的は未確認」のように、観測した範囲と限界を添えます。',
    'The external report motivates the hunt; endpoint and network records provide evidence of execution in this environment. In practice, check whether the environment and behavior described in the intelligence fit your organization\'s assets and available logs before forming a question. If you share findings with the intelligence provider, state the observed scope and limits: here, similar parent-child execution and traffic were observed in the specified period, while the acquisition source and purpose of the traffic remain unconfirmed.'
  )],
  c05: [note(
    '検索結果のゼロを読む前に',
    'Before interpreting zero search results',
    '今回の境界フローは通信の存在を示しますが、停止していた端末記録の実行GUIDを補いません。実務では収集停止に加え、ログの到着の遅れや必要項目のNULLも、条件に一致する結果が出ない理由になります。ゼロ件を安全の証明にせず、対象期間の到着状況・必要項目・収集範囲を確認し、追加データが得られた範囲で判断を見直します。',
    'The boundary flows show that traffic occurred, but they do not supply the execution GUID missing from the interrupted endpoint collection. In practice, delayed log arrival and NULL required fields, as well as collection outages, can cause a query to return no matches. Do not treat zero results as proof of safety: check arrival status, required fields and collection coverage for the period, then revisit the conclusion within the scope of any additional data.'
  )],
  g02: [note(
    '見送った問いを次の候補に残す',
    'Keep deferred questions as future candidates',
    '今回は取得できる認証・実行記録と2時間の枠に合う問いを選びました。トークンの再利用など、必要な記録が足りず見送った候補も、何が不足していたかを残しておくと次に使えます。記録が利用可能になったときや、資産・権限・関連する脅威情報が変わったときに、同じ問いを調べられるか、優先順位を変えるかを考え直します。',
    'This plan selects a question that fits the available authentication and execution records and the two-hour window. For deferred candidates such as token reuse, recording which evidence was missing makes them useful for a later hunt. When records become available, or assets, permissions or relevant threat intelligence change, reconsider whether the question can now be investigated and whether its priority should change.'
  )],
};

const exitNotes = {
  p03: [note(
    '新しい根拠が出たら問いを開き直す',
    'Reopen the question when new evidence appears',
    '今回の終了記録は、調べた3台・2期間でadminctl.exeの一般端末への広がりを裏付けられなかったという結果です。後から一般端末の実行や異なる親子関係が見つかれば、以前の検索条件と範囲を参照して調査を再開できます。同じ検索を繰り返すだけでなく、新しい根拠によって何を確かめられるようになったかを考えます。',
    'This closure record states that the three assets and two periods investigated did not substantiate adminctl.exe spreading to general-purpose endpoints. If execution on such an endpoint or a different parent-child relationship is found later, the earlier query and scope can support reopening the investigation. Consider what the new evidence makes testable, rather than only repeating the same search.'
  )],
  p04: [note(
    '渡した後の確認範囲も照合する',
    'Check the scope after handing findings over',
    'IRなどの受け手から、「この範囲は引き受ける」「この点は追加確認してほしい」と返されることがあります。資料を渡した後は、相手が確認する範囲と、自分の側に残る確認事項を照合します。今回なら登録と2回の起動を確認済みの事実として伝え、登録元セッションやファイル来歴への質問には、手元の記録で答えられることと追加資料が必要なことを分けます。',
    'An incident response team or another recipient may accept part of an investigation and ask for more information about the rest. After handing findings over, check which scope the recipient has accepted and which questions remain with you. Here, report the registration and two executions as confirmed facts, and distinguish what the existing records can answer about the registering session or file provenance from questions that require additional material.'
  )],
  f01: [note(
    '検索式を検知候補として相談する',
    'Discuss the query as a detection candidate',
    '検知担当へ相談するときは、この親子実行の検索式に、比較した良性例、必要なログ、見逃す行動を添えると意図を伝えやすくなります。同じ実行の通信をGUIDで照合する作業は、この式の抽出後に残っています。例外を設ける場合も、今回確認した業務条件の範囲や適用期限を考え、同じツールすべての恒久除外へ広げないようにします。実際の担当や適用・見直しの手順は各組織の運用に合わせます。',
    'When discussing this parent-child execution query with detection specialists, include the legitimate comparison examples, required logs and behavior it would miss. Correlating traffic from the same execution by GUID remains a separate step after extraction. If an exception is considered, retain the verified business conditions and consider its scope and expiry, rather than permanently excluding every use of the same tool. Ownership and the process for applying and reviewing a candidate depend on the organization.'
  )],
};

// Translation examples are reading material, never executable in the course engine.
exitNotes.f01.push({
  ...note(
    'この検索を実際の製品へ移すには',
    'Translate this query to a real product',
    'F01の検索は、文書アプリを親とするPowerShell起動の候補を取り出します。docview.exeは教材の架空名です。以下は構文の対応例で、実環境での動作・精度を検証したルールではありません。SPLは演習用index=threathunting / sourcetype=threathunting:processと、実行ファイル名だけを持つparent・processフィールドを仮定します。KQLはMicrosoft Defender XDRのDeviceProcessEventsを仮定し、必要なセンサーと収集を確認します。両方とも実行時に同じ対象とUTC期間を設定します。SigmaはフルパスのImage・ParentImageを持つWindowsプロセス作成ログ用の抜粋で、実際のバックエンドとフィールド変換が必要です。通信との相関、正当な業務との比較、名前変更による見逃しの確認は別途行います。詳細と出典はリポジトリのdocs/PRACTICE_BRIDGE.md（English: docs/PRACTICE_BRIDGE.en.md）にあります。',
    'The F01 query finds candidate PowerShell launches from a document application. docview.exe is a fictional course name. These examples show syntax mappings; they are not rules validated for production behavior or accuracy. SPL assumes a training index named threathunting, a threathunting:process sourcetype, and parent/process fields containing executable basenames. KQL assumes Microsoft Defender XDR DeviceProcessEvents; check that the required sensors and collection are available. Set the same targets and UTC time range in both products when running the queries. The Sigma fragment assumes Windows process-creation logs with full Image and ParentImage paths and needs a backend and field mapping. Network correlation, legitimate-work comparisons, and checks for renamed executables remain separate. Details and sources are in the repository at docs/PRACTICE_BRIDGE.en.md (Japanese: docs/PRACTICE_BRIDGE.md).'
  ),
  examples: [
    {label: tr('教材の検索', 'Course query'), query: 'source:端末 parent:docview.exe process:powershell.exe'},
    {label: 'Splunk SPL', query: 'index=threathunting sourcetype="threathunting:process" parent="docview.exe" process="powershell.exe"\n| table _time host parent process process_guid'},
    {label: 'Microsoft Defender XDR / KQL', query: 'DeviceProcessEvents\n| where ActionType == "ProcessCreated"\n| where InitiatingProcessFileName =~ "docview.exe" and FileName =~ "powershell.exe"\n| project Timestamp, DeviceId, DeviceName, InitiatingProcessFileName, FileName, ProcessId, ProcessCreationTime'},
    {label: tr('Sigma（ルールの抜粋）', 'Sigma (rule fragment)'), query: "logsource:\n  category: process_creation\n  product: windows\ndetection:\n  selection:\n    ParentImage|endswith: '\\docview.exe'\n    Image|endswith: '\\powershell.exe'\n  condition: selection"}
  ]
});
exitNotes.f01.push(note(
  'ATT&CKで行動を言い表す',
  'Describe behavior with ATT&CK',
  'PowerShellによるコマンド・スクリプト実行は、MITRE ATT&CKのT1059.001（PowerShell）を参照して調査の観点を共有できます。このプロセス名が見えただけでは、悪用や侵害を認定できません。この検索でT1059.001全体を検知できるわけでもありません。docview.exeからの起動、スクリプト内容、実行者、来歴、後続の通信を合わせて確認し、未確認の通信目的に別の技法IDを断定的に付けないようにします。',
  'Use MITRE ATT&CK T1059.001 (PowerShell) as a reference when discussing command and script execution through PowerShell. Seeing the process name alone does not establish abuse or compromise, and this query does not cover every instance of T1059.001. Review the parent application, script content, account, provenance, and subsequent traffic together. Do not assign another technique solely on an unverified assumption about the purpose of a connection.'
));
taskNotes.c01.push(note(
  '外部情報から、検証可能な問いへ',
  'Turn external intelligence into a testable question',
  'TaHiTI（Targeted Hunting integrating Threat Intelligence）は、脅威情報をハントの起点や調査中の文脈に結び付ける方法です。C01では「外部で報告されたから、この環境でも侵害があった」とせず、対象・期間・必要ログ・別の説明を定めます。ATT&CK T1059.001（PowerShell）は行動を表す参照先として使い、観測していない攻撃段階や攻撃者まで推定しません。',
  'TaHiTI (Targeted Hunting integrating Threat Intelligence) connects threat intelligence to the starting point and context of a hunt. In C01, define targets, a time period, required logs, and alternative explanations instead of treating an external report as proof of compromise here. Use ATT&CK T1059.001 (PowerShell) to describe the behavior under investigation without inferring unobserved attack stages or an actor.'
));
taskNotes.g02.push(note(
  'ハントの手法と教材をつなぐ',
  'Connect the course to hunting methodologies',
  'PEAKはPrepare・Execute・Actの各段階にKnowledgeを生かす枠組みです。教材との対応例として、A/C/Gの可視性・問い・計画をPrepare、B/D/Lなどでの比較と検証をExecute、成果物の検知候補・引継ぎ・改善をActとして振り返れます。TaHiTIのInitiate・Hunt・Finalizeにも、調査の開始・実施・結果の整理を照らせます。これは学習のための対応例で、どちらの手法の全工程も再現・認定するものではありません。詳しい対応と公式資料はリポジトリの実務への橋渡しガイドにあります。',
  'PEAK applies Knowledge throughout Prepare, Execute, and Act. As a learning crosswalk, relate visibility, hypotheses, and planning in A/C/G to Prepare; comparisons and investigation in chapters such as B/D/L to Execute; and detection candidates, handoffs, and improvements in the deliverables to Act. TaHiTI uses Initiate, Hunt, and Finalize to organize the beginning, investigation, and outcome of a hunt. These are learning connections, not a complete implementation or certification of either methodology. The repository practice bridge guide provides the crosswalk and official sources.'
));

function cloneNote(item) {
  return {...item, ...(item.examples ? {examples: item.examples.map(example => ({...example}))} : {})};
}

function applyPracticeNotes(tasks) {
  return tasks.map(task => {
    if (taskNotes[task.id]) return {...task, practiceNotes: taskNotes[task.id].map(cloneNote)};
    if (exitNotes[task.id]) {
      if (!task.exit) throw new Error('Practice notes require an exit for ' + task.id);
      return {...task, exit: {...task.exit, practiceNotes: exitNotes[task.id].map(cloneNote)}};
    }
    return task;
  });
}

module.exports = {applyPracticeNotes, translations};
