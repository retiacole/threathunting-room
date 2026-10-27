'use strict';

const environment = require('./environment.cjs');
const periods = environment.periods;
// Part 2 source clocks are authored as JST business time. Catalog converts their
// legacy Z notation, native timestamps and approval windows to UTC exactly once.
const logs = [];
const tasks = [];
const assets = new Map(environment.assets.map(asset => [asset.host, asset]));
const sourceList = ['認証', '端末', '通信', '業務', '収集', 'ファイル'].map(name => ({
  name,
  description: {
    '認証': '利用者・認証方式・接続元・セッションを確認します。認証後の操作は別に照合します。',
    '端末': '取得されたプロセスやタスクの記録です。収集範囲と識別子の意味を確認します。',
    '通信': '収集経路によって見える項目が異なります。時刻・宛先・許可結果を読みます。',
    '業務': '資産の役割と、承認された作業条件を実際の記録と照合します。',
    '収集': '保存期間、取得項目、対象資産、停止区間を確認します。',
    'ファイル': 'ファイル監査や設定のスナップショットです。内容変更と実行を区別します。',
  }[name],
}));
const hashA = '85bbf6e4a0a4d8d73d414e53f4e0a5f8649e660da61c07f42071ea39a814e0c7';
const hashB = '5f247949fc80981477194273199fce2074b34189d595a70e1f007ac297391f4e';

function event(id, host, source, at, detail, extra = {}) {
  const asset = assets.get(host);
  if (!asset) throw new Error(`Unknown operations host: ${host}`);
  const sensor = extra.sensor || ({'認証': 'identity-audit', '端末': /linux|ubuntu/i.test(asset.os) ? 'linux-journal' : 'win-edr', '通信': 'edge-flow', '業務': 'change-register', '収集': 'collector-register', 'ファイル': 'file-audit'}[source]);
  return {
    id: `ops-${id}`, at, period: at.slice(8, 10) < '10' ? 'baseline' : 'current', source, sensor,
    host, device_id: asset.device_id || `dev-${host.toLowerCase()}`, user: asset.owner || '',
    event: {'認証': '認証イベント', '端末': '実行イベント', '通信': '通信イベント', '業務': '業務記録', '収集': '収集記録', 'ファイル': 'ファイル記録'}[source],
    detail, provenance: {kind: 'synthetic', sensor, format: extra.raw ? (sensor === 'linux-audit' ? 'audit' : 'syslog') : 'normalized', collectionId: `collection-${host.toLowerCase()}`, deviceIdBasis:'asset-register normalization; native identifiers remain separate'},
    ...extra,
  };
}
function add(items) { logs.push(...items); }
const group = (label, role, ...ids) => ({label, role, anyOf: ids.map(id => id.startsWith('ops-') ? id : `ops-${id}`)});
const extra = (ids, roles, reason) => ids.map(id => ({id, roles, reason}));
const baseExtra = (hosts, source, reason) => extra(environment.logs.filter(row => hosts.includes(row.host) && row.source === source).map(row => row.id), ['context'], reason);
function choices(correctId, correctLabel, alternatives, position = 1) {
  const out = alternatives.map(([id, label]) => ({id, label}));
  out.splice(position, 0, {id: correctId, label: correctLabel});
  return out;
}
function register(task) {
  tasks.push({
    part: 2, environment: 'aonagi', level: 'field', periods, sources: sourceList,
    guideMode: 'checklist', hypotheses: [], findings: [],
    ...task,
    logIds: [...environment.logs.map(row => row.id), ...logs.map(row => row.id)],
  });
}
const dGuide = [
  {title: '起点と探索条件を記録した', body: '何が同じなら関連候補かを決め、端末名だけに依存しない条件を使う。', tab: 'plan'},
  {title: '関連候補と別の説明を比べた', body: '条件を環境全体へ広げ、実行ID、時刻、業務条件が対応する記録を選ぶ。', tab: 'logs'},
  {title: '範囲と残る確認を報告した', body: '該当する複数資産を挙げ、同じ名前でも分けた活動と調査の限界を残す。', tab: 'report'},
];

add([
  event('d01-seed', 'FIN-WS-02', '端末', '2026-09-15T15:12:04Z', `image=C:/Users/ikeda/AppData/Local/DocSync/doc-sync.exe sha256=${hashA} command=sync-cache`, {user:'ikeda', process:'doc-sync.exe', parent:'reader.exe', hash:hashA, process_guid:'OPS-D1-FIN-CHILD', parent_process_guid:'OPS-D1-FIN-DOC', pid:'7032', session:'OPS-D1-FIN-LOGIN'}),
  event('d01-seed-parent', 'FIN-WS-02', '端末', '2026-09-15T15:11:58Z', 'image="C:/Program Files/Reader/reader.exe" document=C:/Users/ikeda/Downloads/budget-notes.docx', {user:'ikeda',process:'reader.exe',parent:'explorer.exe',process_guid:'OPS-D1-FIN-DOC',pid:'6980',session:'OPS-D1-FIN-LOGIN'}),
  event('d01-seed-net', 'FIN-WS-02', '通信', '2026-09-15T15:12:10Z', 'sensor=endpoint-network method=POST path=/status status=200', {user:'ikeda',sensor:'endpoint-network',process:'doc-sync.exe',destination:'media-sync.example',bytes:1180,process_guid:'OPS-D1-FIN-CHILD',session:'OPS-D1-FIN-LOGIN',request_id:'OPS-D1-NET-FIN'}),
  event('d01-spread', 'SALES-WS-03', '端末', '2026-09-16T09:24:33Z', `image=C:/Users/ono/AppData/Local/DocSync/doc-sync.exe sha256=${hashA} command=sync-cache`, {user:'ono',process:'doc-sync.exe',parent:'reader.exe',hash:hashA,process_guid:'OPS-D1-SALES-CHILD',parent_process_guid:'OPS-D1-SALES-DOC',pid:'6024',session:'OPS-D1-SALES-LOGIN'}),
  event('d01-spread-net', 'SALES-WS-03', '通信', '2026-09-16T09:24:39Z', 'sensor=endpoint-network method=POST path=/status status=200', {user:'ono',sensor:'endpoint-network',process:'doc-sync.exe',destination:'media-sync.example',bytes:1092,process_guid:'OPS-D1-SALES-CHILD',session:'OPS-D1-SALES-LOGIN',request_id:'OPS-D1-NET-SALES'}),
  event('d01-other', 'IT-ADM-01', '端末', '2026-09-15T15:12:01Z', `image="C:/Program Files/CompanyDocs/doc-sync.exe" sha256=${hashB} command=cache-inventory signature=valid`, {user:'svc-docs',process:'doc-sync.exe',parent:'company-agent.exe',hash:hashB,process_guid:'OPS-D1-ADMIN-CACHE',pid:'4836',session:'OPS-D1-ADMIN-SVC'}),
  event('d01-other-plan', 'IT-ADM-01', '業務', '2026-09-14T08:10:00Z', `change=DOC-216 status=approved target=IT-ADM-01 account=svc-docs parent=company-agent.exe image="C:/Program Files/CompanyDocs/doc-sync.exe" sha256=${hashB} window_utc=2026-09-15T15:00/15:30 purpose=cache-inventory`),
]);
register({
  id:'d01',chapter:'D',title:'一つの実行から範囲を広げる',subtitle:'同じ名前と同じ実体を区別する',minutes:'20–25',focus:'複数端末への展開',
  brief:'経理端末の文書閲覧後に起動したdoc-sync.exeを起点に、同じ実体・親子関係・通信先の組み合わせがほかの資産にもあるか調べます。最初に見つけた端末だけで調査を終えないでください。',
  context:'同じ環境には配布済みの文書管理ツールもあります。ファイル名が同じ場合でも、hash、配置先、親、実行GUIDと通信の対応を読み、調査に含める対象を決めます。',
  hypotheses:choices('matching-chain','起点と同じ実体・文書アプリの親・後続通信が、別端末にも存在する。', [['same-name','同名のツールはすべて管理用配布と同じ実体で、同じ用途に使われている。'],['single-host','起点の文書関連実行は経理端末に限られ、別端末の同名実行とは条件が異なる。']],1),
  guide:dGuide,hints:['端末名の条件をいったん外し、起点の実体を表す値で候補を探します。','同名の管理ツールは、配置先・親・hashを照合すると分けられます。','各候補の実行GUIDで通信を照合し、同じ組み合わせの資産を複数選びます。'],
  findings:choices('expand-origin','同じ実体の実行と通信を記録し、2台の文書・実行ファイルの取得元と追加の対象を確認する。',[['by-filename','同じファイル名を持つ実行をまとめ、管理用配布も同じ取得元から来た候補として順に確認する。'],['first-only','起点と別端末の実行を担当部署で分け、経理端末を先に調べて営業端末は定例点検で確認する。']],2),
  rubric:{hypotheses:['matching-chain'],targets:['FIN-WS-02','SALES-WS-03'],verdict:'supported',sources:['端末','通信','業務'],scope:true,finding:'expand-origin',operations:['search','aggregate','pivot'],evidenceGroups:[group('起点の実体','support','d01-seed'),group('起点の実行に対応する通信','support','d01-seed-net'),group('別端末の同じ実体','support','d01-spread'),group('別端末の実行に対応する通信','support','d01-spread-net'),group('同名管理ツールの適用条件','context','d01-other-plan'),group('良性の説明と比較した管理ツールの実績','context','d01-other')],evidenceExtras:[...extra(['ops-d01-seed-parent'],['support','context'],'起点の実行に対応する親プロセス。'),...extra(['ops-d01-other'],['context'],'同名でも実体・親・配置先の違う管理用配布との比較。')]},
  explanation:{summary:'FIN-WS-02とSALES-WS-03に同じ実体と後続通信があり、範囲を広げる仮説を支持します。',reasoning:['2台の実行は同じhashとreader.exeという親を持ち、各端末の実行GUIDにmedia-sync.exampleへの通信が対応します。','IT-ADM-01の同名ツールはhash・親・配置先が異なり、DOC-216の条件と一致します。名前だけで同じ事案にはしません。','同じ挙動を確認できたことは、文書の取得元や通信目的を確定したことではありません。'],next:'2台の取得履歴と文書を確認し、同じ実体または行動の組み合わせで対象を追加確認します。',sampleReport:'今回期間のFIN-WS-02とSALES-WS-03に同じhashのdoc-sync.exeと対応する外向き通信を確認した。IT-ADM-01の管理用配布は別hash・別親として分離した。取得元と通信内容は未確認であり、2台の文書とファイル来歴を引き継ぐ。'},
});

add([
  event('d02-plan','DESIGN-WS-02','業務','2026-09-14T10:00:00Z','change=SUP-225 status=approved targets=DESIGN-WS-02,SALES-WS-02 operator=support-aya tool=remote-assist.exe parent=support-service.exe broker=support-broker.example window_utc=2026-09-16T13:00/14:00 purpose=display-settings'),
  ...[['DESIGN-WS-02','nishi','13:16:03','DESIGN'],['SALES-WS-02','nakamura','13:28:41','SALES']].flatMap(([host,user,time,key])=>[
    event(`d02-${key}-exec`,host,'端末',`2026-09-16T${time}Z`,'image="C:/Program Files/Support/remote-assist.exe" signature=valid operator=support-aya change=SUP-225',{user,process:'remote-assist.exe',parent:'support-service.exe',process_guid:`OPS-D2-${key}`,session:`SUP-225-${key}`}),
    event(`d02-${key}-net`,host,'通信',`2026-09-16T${key==='DESIGN'?'13:16:06':'13:28:45'}Z`,'sensor=endpoint-network action=connect result=success operator=support-aya change=SUP-225',{user,sensor:'endpoint-network',process:'remote-assist.exe',destination:'support-broker.example',bytes:8400,process_guid:`OPS-D2-${key}`,session:`SUP-225-${key}`,request_id:`SUP-NET-${key}`}),
  ]),
]);
register({
  id:'d02',chapter:'D',title:'広がった操作と作業範囲',subtitle:'複数端末を一つの承認と照合する',minutes:'18–25',focus:'良性の説明を検証',
  brief:'遠隔支援ツールの利用が設計と営業の端末にあります。一つの作業として説明できる範囲か、端末・操作者・時間・接続先を照合してください。',
  context:'同じツールの利用が増えても、承認範囲内の支援か別用途かは個々の実行で確認します。申請にある名前だけでなく実行GUIDと通信の対応まで見ます。',
  hypotheses:choices('outside-support','対象2台の遠隔支援は、予定された支援作業の条件を外れている。',[['one-endpoint','支援作業の実行は設計端末だけで、営業端末の通信は別のツールに由来する。'],['broker-only','支援先の違いは接続先だけにあり、実行者と時間は端末ごとに異なる。']],0),
  guide:dGuide,hints:['申請の対象端末だけでなく、操作者・時間・親プロセスを照合します。','各端末の実行と通信が同じGUID・支援セッションでつながるか確認します。','両方の端末で作業条件が一致するなら、対象を一台に絞らず一致した範囲を報告します。'],
  findings:choices('bounded-support','2台の実行と接続を支援作業としてまとめ、端末・操作者・時間・宛先の一致を適用条件にする。',[['broker-exception','同じ接続先の支援を通常例として残し、未申請の端末も同じ操作者なら作業範囲へ加えて別途確認する。'],['tool-exception','署名済みツールの利用を記録し、操作者が異なる実行にも今回の支援申請を対応させて別途確認する。']],1),
  rubric:{hypotheses:['outside-support'],targets:['DESIGN-WS-02','SALES-WS-02'],verdict:'benign',sources:['端末','通信','業務'],scope:true,finding:'bounded-support',operations:['search','pivot'],evidenceGroups:[group('支援の承認条件','context','d02-plan'),group('設計端末の一致する実行','counter','d02-DESIGN-exec'),group('営業端末の一致する実行','counter','d02-SALES-exec'),group('設計端末のブローカーへの対応通信','counter','d02-DESIGN-net'),group('営業端末のブローカーへの対応通信','counter','d02-SALES-net')],evidenceExtras:[]},
  explanation:{summary:'2台の記録はSUP-225の対象・操作者・時間・ツール・接続先と一致し、今回の支援として説明できます。',reasoning:['DESIGN-WS-02とSALES-WS-02でそれぞれ実行GUIDに対応するブローカー通信があります。','署名が有効だからという理由だけでなく、個別の作業条件を照合しています。','裏付けが見つからないだけでなく、今回の作業を説明する承認と実行の対応があるためbenignとします。'],next:'今回の具体的な条件を記録し、同じツールでも範囲外の利用は分けて調べます。',sampleReport:'9月16日JSTの2台のremote-assist.exe利用はSUP-225の対象・support-aya・時間帯・ブローカーに一致した。対応する実行GUIDと通信を確認し、今回の支援を正当な業務として記録する。別の時間・操作者・対象までは同じ承認を適用しない。'},
});

add([
  event('d03-idp-normal','IDP-SRV-01','端末','2026-09-15T15:13:07Z','image="C:/Program Files/Identity/token-service.exe" command=rotate-cache signature=valid',{user:'svc-idp',process:'token-service.exe',parent:'services.exe',process_guid:'OPS-D3-IDP-NORMAL'}),
  event('d03-file-normal','FILE-SRV-01','端末','2026-09-15T15:14:28Z','image="C:/Program Files/FileService/file-index.exe" command=refresh-index signature=valid',{user:'svc-file',process:'file-index.exe',parent:'services.exe',process_guid:'OPS-D3-FILE-NORMAL'}),
  event('d03-coverage','IDP-SRV-01','収集','2026-09-16T23:50:00Z','sensor=win-edr fixture_scope=IDP-SRV-01,FILE-SRV-01 event_type=process_start from=2026-09-14 to=2026-09-16 field=process_name delivery=complete_for_fixture extraction=all_process_start retained_days=14'),
]);
register({
  id:'d03',chapter:'D',title:'重要サーバーへの広がりを確かめる',subtitle:'該当しない範囲も調査結果として残す',minutes:'18–25',focus:'スコープの境界',
  brief:'文書同期プログラムの調査を、認証基盤と共有ファイルサーバーへ広げます。対象期間のプロセス開始に同じ実行名が現れるかを調べ、調査した2台を報告してください。',
  context:'ここで否定できるのは、収録範囲で観測するプロセス開始という条件です。別名での実行、範囲外の時刻、他の侵害手段を同じ結果で否定しません。',
  hypotheses:choices('server-process','調査した同期プログラムと同じ実行名が、対象2サーバーでも起動している。',[['service-refresh','対象2サーバーの定例サービス更新が、端末側と同じ文書アプリから起動している。'],['all-normal','対象2サーバーの新しい実行は、今回の同期プログラムと同じ親を持っている。']],2),
  guide:dGuide,hints:['端末側で見つけた実行名を保ち、対象を重要サーバーへ切り替えます。','該当する行がない場合、対象サーバーがプロセス開始の収集範囲に入るか確認します。','観測できた通常の実行と収集条件を背景として残し、調べたサーバー2台を対象に記録します。'],
  findings:choices('scope-negative','2サーバーの期間・実行名・収集条件を残し、別名の同じ実体や他の行動は追加の問いで調べる。',[['scope-close','端末用の名前とサーバー用の名前を分け、今回の実行名は今後のサーバー検索条件から除いて残す。'],['scope-link','通常サービスの実行を同期プログラムの別名候補にまとめ、端末側と同じ取得元を確認する。']],0),
  rubric:{hypotheses:['server-process'],targets:['IDP-SRV-01','FILE-SRV-01'],verdict:'unsubstantiated',sources:['端末','収集'],scope:true,finding:'scope-negative',operations:['search','compare'],evidenceGroups:[group('認証サーバーで観測できる実行','context','d03-idp-normal'),group('ファイルサーバーで観測できる実行','context','d03-file-normal'),group('検索結果を解釈する収集範囲','context','d03-coverage')],evidenceExtras:[...extra(['ops-d01-seed'],['context'],'展開する検索条件の起点となる端末側の実行。'),...baseExtra(['IDP-SRV-01','FILE-SRV-01'],'端末','対象サーバーで比較できる通常のプロセス開始。')]},
  explanation:{summary:'対象2サーバーの収録されたプロセス開始では、同じ実行名による起動は裏付けられません。',reasoning:['対象はIDP-SRV-01とFILE-SRV-01です。端末側の陽性記録を残したまま、サーバーの検索対象を分けます。','通常サービスの実行はありますがdoc-sync.exeではありません。収集資料はこの演習内の対象期間・プロセス開始の範囲を説明します。','個別の活動が承認済みだと認定した結果ではないためbenignではなく、検証した仮説の裏付けなしとします。'],next:'検索条件と観測範囲を残し、別名の同じ実体や別の行動を確認する必要があるか検討します。',sampleReport:'IDP-SRV-01とFILE-SRV-01の今回期間のプロセス開始を調べたが、端末側のdoc-sync.exeという実行名は見つからなかった。対象の収集範囲と通常実行を確認したため、この条件では裏付けなしとする。別名や他の侵害手段はこの結果から判断しない。'},
});

const eGuide = [
  {title:'検索条件と観測範囲をそろえた',body:'仮説が求めるイベントと、実際に取得している期間・項目を照合する。',tab:'logs'},
  {title:'ないことの意味を確かめた',body:'未取得、別の条件、対象活動の不在を分け、根拠となる資料を残す。',tab:'compare'},
  {title:'結論の範囲と次の行動を残した',body:'裏付けなしと観測不足を区別し、未確認事項を具体的に報告する。',tab:'report'},
];
add([
  event('e01-admin-before','IT-ADM-01','端末','2026-09-08T18:07:11Z','action=task_register task=InventoryDaily trigger=daily action_path="C:/Program Files/Company/inventory.exe" account=svc-inventory',{user:'ops-admin',sensor:'task-audit',event:'タスク定義の登録'}),
  event('e01-admin-now','IT-ADM-01','端末','2026-09-15T18:08:47Z','action=task_update task=InventoryDaily trigger=daily action_path="C:/Program Files/Company/inventory.exe" account=svc-inventory',{user:'ops-admin',sensor:'task-audit',event:'タスク定義の変更'}),
  event('e01-dev-before','DEV-WS-03','端末','2026-09-08T16:17:02Z','action=task_register task=BuildCache trigger=daily action_path="C:/Program Files/Build/cache-clean.exe" account=svc-build',{user:'rin',sensor:'task-audit',event:'タスク定義の登録'}),
  event('e01-dev-now','DEV-WS-03','端末','2026-09-15T16:18:19Z','action=task_update task=BuildCache trigger=daily action_path="C:/Program Files/Build/cache-clean.exe" account=svc-build',{user:'rin',sensor:'task-audit',event:'タスク定義の変更'}),
  event('e01-coverage','IT-ADM-01','収集','2026-09-16T23:52:00Z','sensor=task-audit fixture_scope=IT-ADM-01,DEV-WS-03 events=register,update from=2026-09-07 to=2026-09-16 fields=task,action_path,trigger,account delivery=complete_for_fixture'),
]);
register({
  id:'e01',chapter:'E',title:'条件に合う登録が見つからない',subtitle:'検索条件を残してハントを閉じる',minutes:'18–22',focus:'裏付けなしの報告',
  brief:'管理端末とWindows開発端末で、一時領域のプログラムを起動するタスクの追加・変更があるか調べます。見つからない場合も、調べた2台と条件を記録してください。',
  context:'定期タスクという仕組み自体を危険扱いせず、実行先と変更内容を確認します。対象イベントが届いているか、検索語で通常の登録まで除いてしまっていないかも確認します。',
  hypotheses:choices('temporary-action','対象2台で、一時領域の実行ファイルを起動するタスク定義が追加・変更されている。',[['changed-time','対象2台で、既存の定例タスクが手動起動のタスクへ変更されている。'],['same-image','対象2台で、同じタスク名が同じ実行ファイルを起動するよう登録されている。']],1),
  guide:eGuide,hints:['タスク名に加え、action_pathとtriggerを読みます。','対象イベントの収集資料と、両期間にある定義変更を見比べます。','一致する定義がなければ、見た2台・期間・実行先条件を残し、別の活動まで結論を広げません。'],
  findings:choices('retain-condition','今回調べた定義変更と対象外の仕組みを分け、別の保存場所や永続化手段の調査を計画する。',[['filename-change','タスク名と実行先を分けて記録し、通常タスクの実行先を一時領域の別名候補として追加確認する。'],['discard-scope','取得範囲を記録したうえで、定例名のタスクは承認照合済みとして今回の点検を終了する。']],2),
  rubric:{hypotheses:['temporary-action'],targets:['IT-ADM-01','DEV-WS-03'],verdict:'unsubstantiated',sources:['端末','収集'],scope:true,finding:'retain-condition',operations:['search','compare'],evidenceGroups:[group('管理端末の定義変更','context','e01-admin-now'),group('開発端末の定義変更','context','e01-dev-now'),group('登録・変更の観測範囲','context','e01-coverage')],evidenceExtras:extra(['ops-e01-admin-before','ops-e01-dev-before'],['context'],'同じ定義の比較期間の標本。')},
  explanation:{summary:'今回の登録・変更では一時領域を実行先とする定義は裏付けられません。',reasoning:['2台のaction_pathはProgram Files配下であり、対象とした一時領域ではありません。タスク名の印象ではなく実行先を確認しています。','収集資料は対象2台の登録・変更の範囲を説明します。取得できないから0件になったケースと分けます。','作業承認の照合を完了したわけではないので、すべての登録を正当とするbenignではなく裏付けなしです。'],next:'検索した実行先条件と範囲を残し、別の永続化手段や保存場所を調べる必要があるかを検討します。',sampleReport:'対象2台のタスク登録・変更を両期間で比較し、今回の一時領域からの起動という条件には該当しなかった。収集範囲と通常定義の標本を保存した。対象外の仕組みや個別作業の承認はこの結果から判断しない。'},
});

add([
  event('e02-auth','REMOTE-WS-01','認証','2026-09-15T20:41:22Z','sensor=idp-auth account=haya method=password+mfa result=success src=198.51.100.72 resource=remote-access device_claim=REMOTE-WS-01',{user:'haya',sensor:'idp-auth',session:'OPS-E2-IDP-91',request_id:'OPS-E2-LOGIN-91'}),
  event('e02-coverage','REMOTE-WS-01','収集','2026-09-16T08:30:00Z','asset=REMOTE-WS-01 sensor=idp-auth delivered=authentication from=2026-09-14 to=2026-09-16 endpoint_last_seen=2026-09-04T17:20:00Z expected_reconnect=2026-09-18T09:00:00Z process_start=not_delivered local_buffer=unavailable alternative_local_audit=unknown'),
  event('e02-owner','REMOTE-WS-01','業務','2026-09-14T09:30:00Z','asset=REMOTE-WS-01 owner=haya role=field-sales remote_access_window=06:00/22:00 remote_access_window_timezone=Asia/Tokyo approved_resources=sales-portal.example support_contact=endpoint-team'),
]);
register({
  id:'e02',chapter:'E',title:'認証の先が見えない端末',subtitle:'裏付けなしと観測不足を分ける',minutes:'15–22',focus:'長期未着の可視性の穴',
  brief:'遠隔端末の夜間サインイン後に、未確認のプログラムが起動したという仮説を調べます。ログ一覧にプロセスがない理由と、認証だけで言えることを整理してください。',
  context:'この端末はIdPの認証記録が先に利用できる状態です。成功したサインインと、その後に実行したプログラムは別の事実です。時刻だけを理由に業務外と決めません。',
  hypotheses:choices('post-login-process','遠隔端末のサインイン後に、未確認のプログラムが起動した。',[['login-failure','遠隔端末の利用は認証の失敗で止まり、その後のセッションは作られていない。'],['resource-login','遠隔端末の記録は、夜間のプログラム実行を伴わない通常の認証だけである。']],0),
  guide:eGuide,hints:['認証の成功は実行プログラムを示す項目を持つか確認します。','短時間の保守停止と区別し、端末の最終受信時刻と未着期間を確認します。','起動したとも、起動しなかったとも判断できない範囲と、代替資料の担当を残します。'],
  findings:choices('collect-endpoint','認証と端末記録の未着期間を残し、再接続の見込みと別のローカル監査の残存を担当へ確認する。',[['infer-browser','夜間利用を時間帯で分け、承認時間内のサインイン後は通常ブラウザーの利用として記録する。'],['close-no-process','検索条件と0件の結果をまとめ、未着期間にプログラムが起動しなかった例として次回と比較する。']],1),
  rubric:{hypotheses:['post-login-process'],targets:['REMOTE-WS-01'],verdict:'insufficient',sources:['認証','収集'],scope:true,finding:'collect-endpoint',operations:['search','pivot'],evidenceGroups:[group('観測できた認証','context','e02-auth'),group('実行を確認できない収集状態','gap','e02-coverage')],evidenceExtras:[...extra(['ops-e02-owner'],['context'],'夜間という時刻だけで承認外と判断しないための利用条件。'),...baseExtra(['REMOTE-WS-01'],'収集','端末の最終受信時刻と収集状態を示す補足資料。')]},
  explanation:{summary:'IdP認証は確認できますが、その後の端末実行を確かめるデータがなく観測不足です。',reasoning:['9月15日20:41 JST（11:41 UTC）の認証は成功しています。JSTの利用時間06:00〜22:00の条件内ですが、認証後の操作内容を承認する証拠にはなりません。','対象期間より前から端末記録が未着で、ローカルバッファもないため、検索の0件はプロセスが起動しなかったことを示しません。','裏付けなしは、検証に必要な範囲を観測した結果です。今回はその前提が不足しています。'],next:'担当へ再接続の見込みと別のローカル監査の利用可否を確認し、過去の復元可否も分けて記録します。',sampleReport:'REMOTE-WS-01で9月15日20:41 JSTのIdP認証は成功している。端末記録は9月4日JSTから未着でバッファもなく、認証後のプログラム起動は観測不足で判断できない。認証は残し、端末担当へ収集状態と代替記録を確認する。'},
});

add([
  ...['12:21:07','12:21:39','12:22:14'].map((time,n)=>event(`e03-deny-${n+1}`,'KIOSK-WS-01','通信',`2026-09-15T${time}Z`,'sensor=edge-flow action=deny transport=tcp dst_port=443 rule=KIOSK-EGRESS bytes_out=0 bytes_in=0',{user:'',sensor:'edge-flow',destination:'telemetry-helper.example',bytes:0,flow_id:`OPS-E3-FLOW-${n+1}`})),
  event('e03-coverage','KIOSK-WS-01','収集','2026-09-16T23:45:00Z','sensor=edge-flow asset=KIOSK-WS-01 from=2026-09-14 to=2026-09-16 fixture_scope=all_egress_decisions fields=timestamp,device_id,destination,action,rule,bytes_out,bytes_in loss=0 user_identity=not_collected'),
  event('e03-normal','KIOSK-WS-01','通信','2026-09-15T12:23:46Z','sensor=edge-flow action=allow transport=tcp dst_port=443 rule=KIOSK-PORTAL bytes_out=960 bytes_in=4096',{user:'',sensor:'edge-flow',destination:'reception-portal.example',bytes:5056,flow_id:'OPS-E3-PORTAL'}),
]);
register({
  id:'e03',chapter:'E',title:'試行と成立を分けて閉じる',subtitle:'許可結果のない接続をどう報告するか',minutes:'18–22',focus:'否定的な調査結果',
  brief:'受付端末から新しい宛先への接続試行がありました。対象期間に、その宛先への許可された外向き通信が成立したという仮説を検証します。',
  context:'受付端末で利用できるのは境界センサーの通信記録です。利用者やプロセスの調査とは範囲を分け、接続先・action・転送量と収集範囲を確認します。',
  hypotheses:choices('permitted-egress','新しい宛先への接続試行は、許可された外向き通信として成立している。',[['portal-redirect','新しい宛先への試行と、その後の受付ポータル通信は同じ通信として継続している。'],['no-observation','対象期間の受付端末は境界センサーで観測されず、接続の許可結果を調べられない。']],2),
  guide:eGuide,hints:['actionと送受信量を確認し、宛先が違う後続通信と分けます。','許可された通常通信が記録されることと、対象宛先の判断が収集範囲に入ることを確かめます。','接続成立の裏付けがなかった範囲を記録し、試行を起こした端末内の原因は別の課題として残します。'],
  findings:choices('retain-denied','拒否された試行と観測範囲をまとめ、試行を起こした端末内の処理を確認する手段を検討する。',[['merge-portal','宛先ごとの記録を残し、後続のポータル許可を最初の試行が経路変更して成立した根拠にする。'],['infer-user','端末IDと利用者を分けて記載し、資産台帳の担当者を接続試行の実際の操作者として確認する。']],0),
  rubric:{hypotheses:['permitted-egress'],targets:['KIOSK-WS-01'],verdict:'unsubstantiated',sources:['通信','収集'],scope:true,finding:'retain-denied',operations:['search','compare'],evidenceGroups:[group('対象宛先の拒否判断','counter','e03-deny-1','e03-deny-2','e03-deny-3'),group('許可結果を確認できる観測範囲','context','e03-coverage'),group('別宛先の通常通信との区別','context','e03-normal')],evidenceExtras:baseExtra(['KIOSK-WS-01'],'収集','端末の境界通信という観測範囲を補う資料。')},
  explanation:{summary:'対象宛先への3試行は拒否され、観測範囲では許可された外向き接続は裏付けられません。',reasoning:['対象宛先のactionはdeny、送受信量は0です。受付ポータルのallowは別宛先・別flow_idなので置き換えません。','収集資料はこの演習の対象期間の境界判断を説明します。端末のプロセスや操作者は観測対象ではありません。','接続を止めたことは、試行の理由が正当だったと判断するbenignとは異なります。'],next:'拒否を起こした設定や実行元の確認が必要かを担当へ相談し、取得できない端末内情報を分けて残します。',sampleReport:'KIOSK-WS-01の対象宛先への3試行は境界で拒否されており、今回の観測範囲では許可された接続は裏付けられない。後続の受付ポータル通信は別宛先として分離した。試行の実行元や操作者は境界記録から特定していない。'},
});

const linuxGuide = [
  {title:'原文と正規化された項目を照合した',body:'UTCで収録したrawのサービス名・PID・利用者・時刻を読み、業務上のJST時刻と換算して照合する。WindowsのGUIDがある前提で結び付けない。',tab:'logs'},
  {title:'設定と実際の利用を分けた',body:'設定の変更、認証、実行開始や要求を別の記録として扱い、業務条件と比較する。',tab:'timeline'},
  {title:'確認した範囲で結論を残した',body:'何が対応するかと、因果関係や完了結果まで確認できるかを分けて報告する。',tab:'report'},
];
add([
  event('l01-coverage','WEB-SRV-01','収集','2026-09-14T08:40:00Z','asset=WEB-SRV-01 sensors=linux-auth,cron-monitor,linux-cron cron_definition_path=/var/spool/cron/crontabs/svc-web cron_run_path=/var/log/syslog retained_cron_run=timestamp,host,pid,user,CMD retained_process_start=none change_actor=not_collected'),
  event('l01-cron-before','WEB-SRV-01','ファイル','2026-09-08T01:35:00Z','action=snapshot path=/var/spool/cron/crontabs/svc-web owner=svc-web schedule="*/15 * * * *" command=/usr/local/bin/health-check',{user:'svc-web',sensor:'cron-monitor'}),
  event('l01-ssh','WEB-SRV-01','認証','2026-09-15T21:14:27Z','service=sshd result=accepted method=password src=198.51.100.77 src_port=51284 protocol=ssh2',{user:'svc-web',process:'sshd',pid:'8291',sensor:'linux-auth',raw:'Sep 15 21:14:27 WEB-SRV-01 sshd[8291]: Accepted password for svc-web from 198.51.100.77 port 51284 ssh2'}),
  event('l01-cron-now','WEB-SRV-01','ファイル','2026-09-15T21:18:42Z','action=snapshot path=/var/spool/cron/crontabs/svc-web owner=svc-web schedule="*/15 * * * *" command=/usr/local/bin/health-check added_schedule="*/5 * * * *" added_command=/tmp/.cache/status-check',{user:'svc-web',sensor:'cron-monitor'}),
  event('l01-cron-run','WEB-SRV-01','端末','2026-09-15T21:20:01Z','service=cron action=command_start command=/tmp/.cache/status-check',{user:'svc-web',process:'cron',pid:'9342',sensor:'linux-cron',raw:'Sep 15 21:20:01 WEB-SRV-01 CRON[9342]: (svc-web) CMD (/tmp/.cache/status-check)'}),
  event('l01-oneoff-auth','WEB-SRV-01','認証','2026-09-16T14:36:28Z','program=sshd result=accepted method=password src=192.0.2.59 src_port=46217 protocol=ssh2',{user:'svc-web',process:'sshd',pid:'10427',sensor:'linux-auth',raw:'Sep 16 14:36:28 WEB-SRV-01 sshd[10427]: Accepted password for svc-web from 192.0.2.59 port 46217 ssh2'}),
  event('l01-oneoff-plan','WEB-SRV-01','業務','2026-09-16T13:51:12Z','change=WEB-223 status=approved target=WEB-SRV-01 account=svc-web method=password source=192.0.2.59 window_utc=2026-09-16T14:30/15:00 purpose=one-time-health-diagnostic allowed_command=/usr/local/bin/health-check owner=web-team'),
  event('l01-maintenance','WEB-SRV-01','業務','2026-09-14T08:42:00Z','change=WEB-HEALTH-14 status=approved account=svc-web login_method=publickey source=192.0.2.39 login_window_utc=01:20/02:05 cron_schedule="*/15 * * * *" cron_command=/usr/local/bin/health-check owner=web-team'),
]);
register({
  id:'l01',chapter:'L',title:'サービス用アカウントとcron',subtitle:'認証・設定・起動を別の証拠で確認する',minutes:'20–28',focus:'Linuxの対話利用と定期実行',
  brief:'Webサーバーのサービス用アカウントについて、定例と異なる認証とcronの利用が同期間にあるか調べます。設定差分だけで実際の起動まで断定しないようにします。',
  context:'auth.log相当のsshd記録、cron設定の保存標本、CRONの起動記録を使います。ログのPIDは各サービスのプロセスを示し、すべてが同じセッションや実行を表すわけではありません。',
  hypotheses:choices('off-schedule-cron','定例と異なるサービス用アカウントの認証と、一時領域を使うcron起動が同期間にある。',[['planned-health','認証とcronの変更は、鍵認証と既存のhealth-checkによる定例保守で説明できる。'],['config-only','cronの追加は設定標本だけに現れ、対象期間の起動記録には対応する処理がない。']],1),
  guide:linuxGuide,hints:['定例資料の認証方式・接続元・時間と、sshdの原文を比べます。','crontabの差分で追加された実行先を探し、CRONのCMDに対応する記録があるか確認します。','同じアカウントで近い時刻という事実と、その認証が設定変更を実行したという因果関係は分けて残します。'],
  findings:choices('trace-cron-origin','定例・臨時作業との相違と追加起動を残し、設定変更者とファイルの来歴・内容を確認する。',[['tie-ssh-cause','認証と設定の記録をそれぞれ残し、近い時刻の同一アカウントのSSH接続を変更元として追跡する。'],['keep-health','既存のhealth-checkと追加処理を別欄に残し、同じcrontabのため定例保守の適用範囲へ含める。']],0),
  rubric:{hypotheses:['off-schedule-cron'],targets:['WEB-SRV-01'],verdict:'supported',sources:['認証','ファイル','端末','業務'],scope:true,finding:'trace-cron-origin',operations:['search','compare','pivot'],evidenceGroups:[group('定例と異なる認証','support','l01-ssh'),group('以前のcron定義','context','l01-cron-before'),group('追加されたcron定義','support','l01-cron-now'),group('追加先に対応する起動','support','l01-cron-run'),group('定例の認証と実行条件','context','l01-maintenance'),group('良性の説明と比較した臨時認証','context','l01-oneoff-auth'),group('臨時認証の適用条件','context','l01-oneoff-plan')],evidenceExtras:[...extra(['ops-l01-coverage'],['context'],'cron定義とCRONのCMD行を収集し、一般のプロセス開始や変更者は取得しない範囲。'),...baseExtra(['WEB-SRV-01'],'認証','以前のサービス認証の方式・時刻・送信元との比較。')]},
  explanation:{summary:'定例と異なるパスワード認証、一時領域のcron定義、そのCMD起動が観測され、仮説を支持します。',reasoning:['定例は01:20〜02:05 JSTの許可窓で行う鍵認証の保守です。今回の9月15日21時台JSTのパスワード認証は方式・送信元・時間が異なります。','以前のhealth-checkに加えて/tmp/.cache/status-checkが設定に現れ、9月15日21:20 JST（12:20 UTC）のCRON記録にも同じ実行先があります。','9月16日14:36 JSTの珍しいパスワード認証はWEB-223の端末・接続元・方式・時間に一致します。その承認を前夜の異なる接続元へ適用しません。','sshdのPIDとCRONのPIDは別です。収録資料に変更者を結ぶ監査がないため、SSH接続が変更原因だったとは確定していません。'],next:'cron変更の監査と実行先ファイルの来歴・内容を担当へ確認します。',sampleReport:'WEB-SRV-01で定例条件と異なるsvc-webのパスワード認証を確認し、crontabに一時領域の処理が追加され、そのCMD起動も観測した。定例保守だけでは説明できない挙動を支持する。設定変更者と認証の因果関係、ファイルの目的は未確認である。'},
});

const oldFingerprint='SHA256:XwMm4p2rSiN9eB4MdVJrkg5uYR9QLt2m0yBm6Xh3r7A';
const newFingerprint='SHA256:V9J7nT2wGm4kQ8rFs6X1cYa0Be3Pu5Dh9Zi2Lo7Na4E';
add([
  event('l02-key-before','BUILD-SRV-01','ファイル','2026-09-08T06:10:00Z',`action=snapshot path=/home/svc-build/.ssh/authorized_keys owner=svc-build key_type=ssh-ed25519 fingerprint=${oldFingerprint} options=restrict forced_command=/usr/local/bin/build-dispatch`,{user:'svc-build',sensor:'key-monitor'}),
  event('l02-plan','BUILD-SRV-01','業務','2026-09-14T13:00:00Z',`change=BUILD-KEY-27 status=approved target=BUILD-SRV-01 account=svc-build window_utc=2026-09-15T06:00/06:20 old_fingerprint=${oldFingerprint} new_fingerprint=${newFingerprint} source=192.0.2.38 options=restrict forced_command=/usr/local/bin/build-dispatch`),
  event('l02-key-now','BUILD-SRV-01','ファイル','2026-09-15T06:07:13Z',`action=snapshot path=/home/svc-build/.ssh/authorized_keys owner=svc-build key_type=ssh-ed25519 fingerprint=${newFingerprint} options=restrict forced_command=/usr/local/bin/build-dispatch`,{user:'svc-build',sensor:'key-monitor'}),
  event('l02-auth','BUILD-SRV-01','認証','2026-09-15T06:09:31Z',`service=sshd result=accepted method=publickey src=192.0.2.38 src_port=41802 key_type=ED25519 fingerprint=${newFingerprint}`,{user:'svc-build',process:'sshd',pid:'6134',sensor:'linux-auth',raw:`Sep 15 06:09:31 BUILD-SRV-01 sshd[6134]: Accepted publickey for svc-build from 192.0.2.38 port 41802 ssh2: ED25519 ${newFingerprint}`}),
  event('l02-dispatch','BUILD-SRV-01','端末','2026-09-15T06:09:32Z','type=EXECVE uid=1102 argc=2 a0=/usr/local/bin/build-dispatch a1=nightly-cache pid=6138 ppid=6134',{user:'svc-build',process:'build-dispatch',parent:'sshd',pid:'6138',parent_pid:'6134',sensor:'linux-audit',raw:'type=SYSCALL msg=audit(1789452572.000:412): syscall=59 success=yes ppid=6134 pid=6138 uid=1102 comm="build-dispatch" exe="/usr/local/bin/build-dispatch"\ntype=EXECVE msg=audit(1789452572.000:412): argc=2 a0="/usr/local/bin/build-dispatch" a1="nightly-cache"'}),
]);
register({
  id:'l02',chapter:'L',title:'authorized_keysの変更を照合する',subtitle:'鍵の変化と承認された利用を結び付ける',minutes:'20–25',focus:'Linuxの鍵変更',
  brief:'ビルドサーバーのauthorized_keysの内容が変わりました。新しい鍵が承認された変更と一致し、その利用条件も一致するか調べてください。',
  context:'鍵が追加・交換された事実だけでは利用目的は決まりません。フィンガープリント、制限オプション、強制コマンド、接続元と時間を確認します。',
  hypotheses:choices('unapproved-key','サービス用アカウントの鍵変更と利用が、承認された更新条件を外れている。',[['key-not-used','鍵の変更は設定だけに現れ、対象期間の認証では新しい鍵が使われていない。'],['interactive-change','鍵の変更と同時に制限コマンドが外れ、対話用の利用へ変わっている。']],2),
  guide:linuxGuide,hints:['変更前後のフィンガープリントと鍵のオプションを比較します。','認証原文のフィンガープリントを変更後の設定・承認と照合します。','制限されたコマンドの実行も確かめ、一致した条件だけを今回の説明として残します。'],
  findings:choices('key-scope','鍵・制限・接続元・時間と実行内容を更新記録に記載し、後の変更は同じ条件で別途照合する。',[['fingerprint-only','新しい鍵を通常例として残し、後日の制限オプション変更も同じ鍵更新の適用範囲へ含める。'],['sshd-only','設定と認証を別途保存し、認証成功の時刻が一致するため制限コマンドの実行確認は終了する。']],1),
  rubric:{hypotheses:['unapproved-key'],targets:['BUILD-SRV-01'],verdict:'benign',sources:['ファイル','認証','端末','業務'],scope:true,finding:'key-scope',operations:['search','compare','pivot'],evidenceGroups:[group('鍵変更の承認条件','context','l02-plan'),group('承認と一致する新しい鍵設定','counter','l02-key-now'),group('一致する鍵での認証','counter','l02-auth'),group('制限されたコマンドの実行','counter','l02-dispatch')],evidenceExtras:[...extra(['ops-l02-key-before'],['context'],'交換前の鍵と制限オプションを示す比較標本。'),...baseExtra(['BUILD-SRV-01'],'認証','同じサービスアカウントの定例認証との比較。')]},
  explanation:{summary:'鍵・制限・接続元・時間と実行内容がBUILD-KEY-27に一致し、今回の更新は正当な業務で説明できます。',reasoning:['新しいフィンガープリントは申請された値と一致し、restrictとbuild-dispatchの強制コマンドが保たれています。変更と利用は9月15日06:00〜06:20 JST（9月14日21:00〜21:20 UTC）の承認窓に収まります。','同じフィンガープリントの認証と、sshdの子であるbuild-dispatchの実行が記録されています。LinuxのPID/PPIDで照合しGUIDは作っていません。','単に不審な証拠がなかった結果ではなく、今回の変更と利用が承認条件に対応するためbenignです。'],next:'許可した鍵だけでなく制限条件を含めて変更記録を残し、後の変更は別に確認します。',sampleReport:'BUILD-SRV-01のauthorized_keys変更はBUILD-KEY-27とフィンガープリント・制限・時間が一致した。同じ鍵での認証と強制されたbuild-dispatchの実行を確認し、今回の更新を正当な業務と判断する。他の鍵や制限緩和にはこの説明を流用しない。'},
});

add([
  event('l03-ticket','DEV-WS-02','業務','2026-09-16T11:30:00Z','ticket=SUP-LINUX-43 status=approved target=DEV-WS-02 operator=rei window_utc=2026-09-16T14:00/14:30 input=/var/log output=/tmp/support.tgz destination=support-drop.example owner=linux-support'),
  event('l03-archive','DEV-WS-02','認証','2026-09-16T14:03:17Z','service=sudo invoking_user=rei run_as=root tty=pts/1 cwd=/home/rei command="/usr/bin/tar -czf /tmp/support.tgz /var/log"',{user:'rei',process:'sudo',pid:'4521',sensor:'linux-auth',raw:'Sep 16 14:03:17 DEV-WS-02 sudo[4521]: rei : TTY=pts/1 ; PWD=/home/rei ; USER=root ; COMMAND=/usr/bin/tar -czf /tmp/support.tgz /var/log'}),
  event('l03-send','DEV-WS-02','認証','2026-09-16T14:04:06Z','service=sudo invoking_user=rei run_as=root tty=pts/1 cwd=/home/rei command="/usr/bin/curl --upload-file /tmp/support.tgz https://support-drop.example/upload"',{user:'rei',process:'sudo',pid:'4580',sensor:'linux-auth',raw:'Sep 16 14:04:06 DEV-WS-02 sudo[4580]: rei : TTY=pts/1 ; PWD=/home/rei ; USER=root ; COMMAND=/usr/bin/curl --upload-file /tmp/support.tgz https://support-drop.example/upload'}),
  event('l03-coverage','DEV-WS-02','収集','2026-09-16T14:40:00Z','asset=DEV-WS-02 sensor=linux-auth retained=sudo_command,pam,sshd process_exit=not_collected command_stdout=not_collected file_content=not_collected network_result=not_collected receiver_receipt=not_collected auditd_exec=disabled'),
]);
register({
  id:'l03',chapter:'L',title:'sudoの記録はどこまで示すか',subtitle:'実行要求と転送完了を区別する',minutes:'18–25',focus:'Linuxログの観測限界',
  brief:'診断資料を作り外部窓口へ送るsudoの記録があります。指定された転送が完了したという仮説を、利用可能な資料で確かめてください。',
  context:'sudoのCOMMAND欄は実行しようとしたコマンドを示します。アーカイブの内容、子プロセスの終了、受信側の結果まで自動的に証明する欄ではありません。',
  hypotheses:choices('upload-complete','sudoで準備された診断アーカイブは、指定された外部窓口への転送を完了した。',[['different-operator','資料作成と転送のsudo記録は、別の利用者が別のファイルを扱った操作である。'],['old-backup','外部窓口へのsudo記録は、今回の診断作業より前の定例バックアップに属する。']],0),
  guide:linuxGuide,hints:['作成と転送で指定されたファイル、利用者、時刻が対応するか読みます。','完了を判定するための終了状態や受信票が、どの資料にあるか確認します。','承認された作業であることと、実際に送信を完了したことを分けて報告します。'],
  findings:choices('verify-receipt','資料の作成・転送要求と完了結果を分け、終了状態・送信物・受信票を確認する記録を探す。',[['treat-command-success','準備と転送の要求をまとめ、申請先への転送成功として受信側に診断作業の完了を連絡する。'],['follow-new-pid','PIDごとに操作を整理して残し、資料作成と転送は別利用者の作業としてそれぞれの担当を確認する。']],2),
  rubric:{hypotheses:['upload-complete'],targets:['DEV-WS-02'],verdict:'insufficient',sources:['認証','収集','業務'],scope:true,finding:'verify-receipt',operations:['search','pivot'],evidenceGroups:[group('資料作成の実行要求','context','l03-archive'),group('同じ出力の転送要求','support','l03-send'),group('完了を確認する記録の不足','gap','l03-coverage'),group('今回の作業範囲','context','l03-ticket')],evidenceExtras:baseExtra(['DEV-WS-02'],'収集','auth.log中心の収集条件と取得できない実行結果の補足。')},
  explanation:{summary:'同じ資料の作成と転送を要求したことは分かりますが、転送完了は観測不足で判断できません。',reasoning:['sudoの2行はreiが9月16日14:03〜14:04 JST（05:03〜05:04 UTC）に/tmp/support.tgzを作成・転送するコマンドを要求したことを示します。','収録していない終了状態や受信票を、COMMAND欄から推定しません。PIDが違うのは別のsudo実行であり、別利用者を意味しません。','作業申請との一致は業務目的の説明です。今回の仮説である転送完了の可否を埋めるものではありません。'],next:'端末のアプリ出力や受信窓口の受付記録を確認し、資料の内容と受領を別々に照合します。',sampleReport:'DEV-WS-02でreiによる診断アーカイブ作成と同じファイルの転送要求をsudoログで確認した。申請の対象・時間・宛先には一致するが、終了状態・ファイル内容・受信票がなく、転送完了は観測不足で判断できない。代替記録を確認する。'},
});

add([
  event('g01-constraints','FILE-SRV-01','業務','2026-09-16T09:00:00Z','planning_week=2026-W38 analyst_time_minutes=120 focus=first_repeatable_hunt approval_owner=file-service-team deliverable=bounded-hunt-record'),
  event('g01-intel','IDP-SRV-01','業務','2026-09-16T09:05:00Z','source=fictional-sector-advisory observed_behavior=service-account-interactive-logon target_role=file-service subsequent_behavior=unusual-process-launch date_received=2026-09-16'),
  event('g01-file-scope','FILE-SRV-01','収集','2026-09-16T09:10:00Z','asset=FILE-SRV-01 available=windows-security,win-edr-process fields=account,logon_type,device_id,session,process_guid,parent_process_guid retention_days=14 estimated_hunt_minutes=90 object_audit=not_collected'),
  event('g01-idp-scope','IDP-SRV-01','収集','2026-09-16T09:12:00Z','asset=IDP-SRV-01 available=authentication,win-edr-process token_id=not_collected token_reuse_history=not_collected estimated_hunt_minutes=180'),
  event('g01-backlog','WEB-SRV-01','業務','2026-09-16T09:15:00Z','candidate=web-cron-drift baseline_review=2026-09-15 scope=cron-definitions owner=web-team estimated_hunt_minutes=110 next_change=2026-09-23'),
]);
register({
  id:'g01',chapter:'G',title:'今週の一つを選ぶ',subtitle:'重要性・関連度・可視性・時間を並べる',minutes:'15–22',focus:'ハントの優先順位',
  brief:'初回のハントに使える時間は2時間です。候補の重要性、届いた情報との関連、取得できる証拠、所要時間を比較し、今週実施する一つと理由を残してください。',
  context:'重要な資産ほど優先とは限らず、実施できる問いかも考えます。選ばなかった候補は不要になったわけではなく、可視性改善や別週の候補として扱います。',
  choices:choices('file-interactive','共有ファイルサーバーで、サービスアカウントの対話ログオンと後続プロセスを調べる。',[['idp-token','認証基盤で、同じトークンの再利用履歴を端末をまたいで追跡する。'],['remote-execution','記録が未着の遠隔端末で、サインイン後に起動したプログラムを全件調べる。'],['web-cron','昨日確認したWebサーバーのcron定義を、次回変更前にもう一度全件点検する。'],['kiosk-program','受付端末の外部接続を、起動したプログラムと操作利用者まで対応付ける。']],2),
  reflectionPrompt:'選んだ候補を今週実施できる理由を、資産・脅威情報・取得できる項目・時間から説明してください。見送った候補の扱いも一つ残します。',
  modelReflection:'サービスアカウントの対話ログオンから後続実行を調べる問いは、今回の情報が示すfile-serviceという対象と行動に合う。FILE-SRV-01ではlogon_type・session・実行GUIDを取得でき、見積90分は2時間枠に入る。トークン再利用や遠隔端末の全実行は必要項目が不足し、可視性改善を先に確認する候補とする。',
  guide:[{title:'候補ごとに成立条件を比べた',body:'重要資産かどうかに加え、必要なログ項目と時間枠が合うかを資料から確認する。',tab:'plan'},{title:'一つ選び、理由を比較した',body:'候補を選んで理由を書き、模範と比べて判断に抜けた観点がないか確認する。文章の意味は自動採点しない。',tab:'report'}],
  hints:['同じ重要度でも、問いに必要な項目が取得できるかで着手順が変わります。','届いた情報の対象役割と、対話ログオンから実行へつなぐ項目がある候補を比べます。','見積時間が枠内に入り、今回の情報と証拠の両方がそろう候補を優先し、他は準備課題として残します。'],
  rubric:{choice:'file-interactive',reflection:true,evidenceGroups:[group('今週の制約','context','g01-constraints'),group('届いた情報の関連','context','g01-intel'),group('必要項目と実施可能性','context','g01-file-scope')],evidenceExtras:[...extra(['ops-g01-idp-scope','ops-g01-backlog','ops-e02-coverage','ops-e03-coverage'],['context'],'見送る候補の可視性・直近の確認・時間制約を比較する材料。')]},
  explanation:{summary:'今回の条件ではFILE-SRV-01のサービスアカウント利用を調べる候補が、関連性・可視性・時間枠を満たします。',reasoning:['受領情報はfile-serviceでのサービスアカウントの対話認証と後続実行を扱っています。','必要な認証と実行の項目があり、見積90分は2時間枠に入ります。','この選択は一般的な優先順位の固定規則ではなく、提示された今週の条件に基づくものです。自由文の意味は自動採点しません。'],next:'選んだ問いの対象・期間・完了条件・保存する記録を決め、最初のハント計画へ落とします。',sampleReport:'今週はFILE-SRV-01でサービスアカウントの対話認証と後続実行を調べる。今回情報と対象が一致し、必要項目が取得でき、90分の見積で2時間枠に収まる。記録が未着の端末の全実行とトークン再利用は必要データを先に整える。'},
});

add([
  event('g02-work-window','FILE-SRV-01','業務','2026-09-16T10:00:00Z','plan=FIRST-HUNT-01 owner=file-service-team analyst_time_minutes=120 target=FILE-SRV-01 baseline=2026-09-07/2026-09-09 current=2026-09-14/2026-09-16 export_before=2026-09-20 review=weekly rerun_trigger=account-policy-change,collector-change,new-relevant-intelligence'),
  event('g02-retention','FILE-SRV-01','収集','2026-09-16T10:02:00Z','asset=FILE-SRV-01 sensors=windows-security,win-edr-process retention_days=14 baseline_oldest=2026-09-07 oldest_expires=2026-09-21T00:00:00Z export_format=csv calendar_timezone=Asia/Tokyo export_timestamp_timezone=UTC'),
]);
register({
  id:'g02',chapter:'G',title:'初めてのハントを計画にする',subtitle:'一度の調査と、次の見直しを決める',minutes:'18–25',focus:'計画と周期',
  brief:'選んだ初回ハントを2時間で始められる計画にします。対象、必要データ、保存期限、担当との照合、次の見直しについて、今週の計画へ入れる項目を選んでください。',
  context:'比較用データも保持期限を持ちます。毎回ゼロから調べ直すのではなく、記録を残し、環境や情報が変わったときに条件を再評価できる形を作ります。',
  selectionLabel:'今回の計画へ入れる項目',
  selectionOptions:[
    {id:'scope-file',label:'FILE-SRV-01の指定2期間を対象にし、サービス認証から後続実行を確認する。'},
    {id:'collect-after',label:'比較用の抽出は次回の週次確認時にまとめ、今週は結果の要約だけを残す。'},
    {id:'preserve-before-expiry',label:'保持期限前に条件と結果を書き出し、調査期間はJST、イベント時刻はUTCと明記する。'},
    {id:'owner-review',label:'file-service-teamへ利用条件を照合し、観測事実・判断・不足を分けて残す。'},
    {id:'all-assets-now',label:'初回から遠隔端末と受付端末も同じ認証・実行の条件に含めて範囲を広げる。'},
    {id:'weekly-and-change',label:'週次に候補を見直し、権限・収集条件・関連情報の変化で再実施を判断する。'},
    {id:'sources-session',label:'認証と端末のsession・実行GUIDを使い、相関できない記録は不足として残す。'},
  ],
  reflectionPrompt:'今回の対象・期間・使う記録・調査の終え方・担当への確認・次の見直しを、実行する人が分かる短い計画にまとめてください。',
  modelReflection:'2時間でFILE-SRV-01の指定された基準期間と今回期間を比較する。サービスアカウントの対話ログオンを探し、sessionと実行GUIDで後続操作を照合する。file-service-teamへ業務条件を確認し、支持・正当な説明・裏付けなし・不足を観測範囲に限って記録する。9月20日JST中に条件と結果を保存し、週次または権限・収集・関連情報の変更時に次の実施を判断する。',
  guide:[{title:'期間と保存期限を確認した',body:'調査日だけでなく、比較期間の最古の記録がいつ失われるかを確かめる。',tab:'plan'},{title:'実施条件と見直しを選んだ',body:'担当が実施できる範囲と使う項目、終了時に残す内容、次の見直しを計画へ入れる。',tab:'report'},{title:'自分の計画を模範と比較した',body:'記入内容を比較し、実行時の確認先や観測不足の扱いが抜けていないか確認する。',tab:'report'}],
  hints:['2時間枠と取得できるソースに合う対象を保ちます。','比較用の最古の記録と保存期限を読み、週次の再確認を待ってよいか考えます。','対象・識別子・担当・期限・見直しの5観点をそろえ、未取得の端末へ同じ条件を広げないようにします。'],
  rubric:{selections:['scope-file','preserve-before-expiry','owner-review','weekly-and-change','sources-session'],reflection:true,evidenceGroups:[group('実施枠と見直しの条件','context','g02-work-window'),group('比較データの保持期限','context','g02-retention')],evidenceExtras:extra(['ops-g01-constraints','ops-g01-intel','ops-g01-file-scope'],['context'],'選んだハントの関連性・制約・利用できる項目を計画へ引き継ぐ。')},
  explanation:{summary:'対象と期間、相関に使う項目、担当照合、保存期限、見直しの契機を計画へ入れます。',reasoning:['今回のデータで同じ調査ができるFILE-SRV-01を対象に保ち、未取得の遠隔端末や境界通信だけの受付端末を混ぜません。','比較用の最古の記録は9月21日00:00 JST（9月20日15:00 UTC）に保持期限を迎えます。9月20日JST中に保存し、翌週まで抽出を待たない計画にします。','週次の候補見直しに加え、条件が変わった場合の再評価を決めます。自由記述の意味は自動採点せず模範との比較を記録します。'],next:'ハント記録と初回計画を保存し、実際の環境でデータ・権限・担当を確認してから適用します。',sampleReport:'初回はFILE-SRV-01の認証・実行を2時間枠で調べる。指定2期間を比較し、session・GUIDで相関する。担当への業務条件の確認と、観測範囲を限定した結果を残す。比較記録の期限前に条件・結果を書き出し、週次と条件変更時に次の実施を見直す。'},
});

const d01=tasks.find(task=>task.id==='d01');
d01.alternativeExplanations=[
  {id:'signed-path-only',label:'管理用と2台のファイルは署名者が異なり、管理プログラムの署名検証にも失敗している。その署名の違いが、配布の説明を適用できない理由になる。'},
  {id:'binary-origin-mismatch',label:'管理用配布とはハッシュと親が異なり、2台では文書アプリから同じ実体と通信が対応するため、同名の管理作業では説明できない。'},
  {id:'deployment-window-only',label:'2台とも配布申請の時間窓より前に起動しており、許可された開始時刻と実績が一致しない。その時間の違いだけが、今回の管理作業から外れる理由になる。'}
];
d01.rubric.alternative='binary-origin-mismatch';
d01.explanation.reasoning.push('DOC-216で説明できる同名ツールは管理端末の別ハッシュ・company-agent.exeを親とする配布である。調査対象2台は同じ別ハッシュとreader.exeの親を持ち、各実行GUIDにmedia-sync.exampleへの通信が対応するため、名前だけで管理作業の説明を適用しない。');
const l01=tasks.find(task=>task.id==='l01');
l01.alternativeExplanations=[
  {id:'access-window-mismatch',label:'臨時保守と認証方式は同じでも日付・接続元・許可コマンドが合わず、定例の鍵認証とhealth-checkでも追加のcron起動を説明できない。'},
  {id:'maintenance-pid-match',label:'臨時保守と今回のSSHは同じPIDで日付をまたいで続いているが、cron側のPIDだけが違うため、同じ保守セッションとして扱えない。'},
  {id:'health-definition-removed',label:'今回のcrontabでは承認済みのhealth-checkが削除され、その空いた時刻へ一時領域の処理が置き換えられたため、定例の設定とは合わない。'}
];
l01.rubric.alternative='access-window-mismatch';
l01.explanation.reasoning.push('9月16日のWEB-223は14:30〜15:00 JST（05:30〜06:00 UTC）、192.0.2.59、health-checkの臨時診断を許可する。9月15日21時台JST（12時台UTC）の別送信元と一時領域のcron起動には一致しない。定例health-checkが残ることも、追加コマンドの許可を示さない。');
for(const task of tasks)task.context += ' 調査期間と本文・模範解答の日付・時刻はJST（UTC+9）です。イベント時刻と原文はUTCで保持し、業務票は欄の時間帯表記に従います。JST併記を使い、業務日と許可された時間窓を照合してください。';

module.exports = {logs,tasks};
