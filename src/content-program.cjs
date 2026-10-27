'use strict';

const environment = require('./environment.cjs');
const all = new Map(environment.logs.map(row => [row.id, row]));
const foundation = environment.logs.filter(row => /^(normal-|collection-|inventory-|business-)/.test(row.id)).map(row => row.id);
const financeExample = ['event-win-20260915-140501', 'event-win-20260915-140506', 'event-file-20260915-140520'];
const group = (label, role, ...anyOf) => ({ label, role, anyOf });
const choice = (id, label) => ({ id, label });
const extra = (id, roles, reason) => ({ id, roles, reason });
const check = (title, body, tab) => ({ title, body, tab });
function snapshot(...ids) { return [...new Set([...foundation, ...ids.flat()])]; }
function base(id, chapter, title, subtitle, focus, extraIds = []) {
  return {
    id, part: 2, chapter, environment: 'aonagi', level: chapter === 'C' ? 'field' : 'practice',
    title, subtitle, focus, minutes: chapter === 'C' ? '20–30' : '10–18',
    periods: environment.periods, sources: environment.sources, logIds: snapshot(extraIds),
    hypotheses: [], findings: [], guideMode: 'checklist'
  };
}
function extrasFor(ids, role, reason) { return ids.map(id => extra(id, [role], reason)); }
const taskList = [];

taskList.push({
  ...base('a01', 'A', '調べる環境の境界', '資産台帳とログに現れる台数を分ける', '資産の母集団'),
  brief: 'ハントに着手する前に、何台を管理し、どの役割を調べるのかを確かめます。ログの件数やホストの一覧だけで調査対象の台数を決めず、台帳と突き合わせてください。',
  context: '青凪商事の台帳は15台のワークステーションと5台のサーバーを管理しています。ある端末がプロセスログに出てこなくても、台帳上の管理対象から外れたとは限りません。この課題では攻撃の判定は行わず、母集団と観測の違いを記録します。',
  choices: [
    choice('process-population', '端末プロセスが届く資産を母集団にし、未接続の資産はログの復帰時に加える。'),
    choice('managed-population', '台帳の20資産を母集団にし、届く記録の違いを資産ごとの観測条件として残す。'),
    choice('identity-population', '認証が届く資産を母集団にし、認証のない資産はネットワーク調査へ分ける。')
  ],
  guide: [
    check('台帳を確認した', '資産の台数、OS、役割、所有者を読み、端末とサーバーを区別する。', 'plan'),
    check('ログの母集団を比べた', 'ホストを集計し、ソースを変えたときに現れる資産が変わる理由を確認する。', 'aggregate'),
    check('観測されない資産を残した', '社外端末と受付端末の資料を使い、管理対象と観測対象を別々に報告する。', 'report')
  ],
  hints: [
    '集計に出るホストは、その検索条件で記録を取得できた資産です。台帳とは役割が異なります。',
    '台帳と資産別の収集資料を開き、端末プロセス・認証・境界通信の一覧を比べます。',
    '社外貸出と受付という役割の資産を見比べると、同じWindowsでも取得経路が違うと分かります。'
  ],
  rubric: {
    choice: 'managed-population', sources: ['業務', '収集'], scope: true, operations: ['search', 'aggregate'],
    evidenceGroups: [group('管理対象の台帳', 'context', 'inventory-aonagi-20260914'), group('接続していない資産の状態', 'gap', 'collection-remote-gap'), group('異なる観測経路の資産', 'context', 'collection-kiosk-network')],
    evidenceExtras: extrasFor(['collection-it-adm-01', 'collection-build-srv-01'], 'context', '台帳上の資産を収集方式の違いと対応付ける例。')
  },
  explanation: {
    summary: '管理対象は20資産です。取得できるログの種類や接続状況は、母集団から除く理由ではなく観測条件として記録します。',
    reasoning: ['台帳には15ワークステーションと5サーバーがあり、Linuxも5台含まれます。', 'REMOTE-WS-01は貸出中で端末ログが届いていませんが、管理対象として有効です。', 'KIOSK-WS-01は境界通信のみで、端末プロセスのホスト集計には現れません。', '「プロセスログに出た台数」を環境の台数と扱うと、記録のない資産が調査計画から落ちます。'],
    next: '各資産に観測可能なソースと不足を付け、次に検証できる仮説の種類を選びます。',
    sampleReport: '対象期間は9月14〜16日、母集団は台帳上の20資産（端末15、サーバー5）とする。社外端末はIdP認証のみ、受付端末は境界通信のみであり、端末プロセスに現れない資産も計画から除外しない。'
  }
});

taskList.push({
  ...base('a02', 'A', '同じ問いに使える記録', 'OS名より収集項目を確認する', 'データと仮説の対応'),
  brief: '「どの親プロセスがどの子を起動したか」を調べたいときに使える記録を選びます。OSやプロセス名が書かれているだけでは、親子関係まで取得できているとは限りません。',
  context: 'Windowsにはwin-edr、ビルドサーバーにはlinux-auditがあります。他のLinuxのauth.logにあるsshdのPIDは認証を記録したプログラムの番号で、利用者が実行したコマンドの親子関係を表すわけではありません。',
  selectionLabel: '今回の親子関係の調査に必要な項目を取得する経路',
  selectionOptions: [
    choice('linux-auth', 'Linux auth.logのsshd PIDと認証結果を使う。'),
    choice('win-process', 'WindowsのProcessGuid・親GUID・Imageを使う。'),
    choice('edge-tls', '境界通信のフローIDとTLS接続先を使う。'),
    choice('linux-audit', 'ビルドサーバーのauditd PID・PPID・実行情報を使う。')
  ],
  guide: [
    check('必要な関係を言葉にした', '親と子の対応、同じ端末、起動時刻を確認するにはどの項目が必要か考える。', 'plan'),
    check('収集資料を照合した', 'WindowsとLinuxの取得項目を読み、認証のPIDと実行時のPIDを区別する。', 'logs'),
    check('使える範囲を提出した', '使える経路を選び、別の経路に不足するものも証拠として残す。', 'report')
  ],
  hints: [
    '同じ名前のプロセスを見つけることと、その起動から生まれた子をたどることは別の操作です。',
    '収集資料のretained_processとauth.logのfieldsを見比べ、親に対応する項目を探します。',
    'ビルド用Linuxだけは実行監査があります。LinuxというOS分類だけで他の端末へ同じ能力を当てはめないようにします。'
  ],
  rubric: {
    selections: ['win-process', 'linux-audit'], sources: ['収集', '端末'], scope: true, operations: ['search'],
    evidenceGroups: [group('Windowsの親子項目', 'context', 'collection-endpoint-windows'), group('実行監査のあるLinux', 'context', 'collection-build-srv-01'), group('認証だけでは不足する項目', 'gap', 'collection-linux-auth')],
    evidenceExtras: [extra('normal-process-build-srv-01-0908', ['context'], '取得項目が実際にPID・PPIDとして使われる実行監査の例。'), extra('normal-auth-web-srv-01-0915', ['context'], 'auth.logのPIDがsshdの記録に付く例。利用者コマンドのProcessGuidとして扱わない。')]
  },
  explanation: {
    summary: 'win-edrとBUILD-SRV-01のlinux-auditが、今回の親子関係を調べるための記録です。識別子の扱いは両者で異なります。',
    reasoning: ['Windowsでは端末・時刻とProcessGuid/ParentProcessGuidを合わせます。', 'BUILD-SRV-01のauditdにはPID/PPIDと実行情報があります。GUIDは作らず、同じ端末と起動の時間を保って照合します。', 'auth.logのsshd PIDを利用者のシェルや任意の子プロセスのPIDへ読み替えることはできません。', '境界フローのIDは接続の識別子であり、端末のプロセス識別子とは別です。'],
    next: '親子関係を観測できない資産では、認証や接続先など別の仮説へ切り替えるか、必要な追加収集を計画します。',
    sampleReport: '親子実行の調査にはWindows win-edrとBUILD-SRV-01のlinux-auditを使用する。その他のLinux auth.logや境界フローには必要な親子項目がなく、GUIDを補って結合しない。'
  }
});

taskList.push({
  ...base('a03', 'A', '比較期間の途中で切れた記録', '同じ日数でも収集条件は同じとは限らない', '時間範囲と可視性'),
  brief: '対象週の端末イベントが減ったとき、活動が減ったのか、取得が止まったのかを確認します。経理端末の収集資料と時刻を調べ、比較条件に必要な注記を選んでください。',
  context: '両期間とも3日間ですが、FIN-WS-03では対象週の一部時間帯にセンサー保守があります。週全体の件数だけで行動の増減を説明せず、どの経路のどの時間が比べられないかを残します。',
  choices: [
    choice('gap-window', '対象週の一部に端末収集の欠落があり、その時間を行動量の比較から区別する。'),
    choice('quiet-window', '認証が継続している時間は端末収集も有効とみなし、件数減少を活動量に反映する。'),
    choice('full-week-gap', '対象週の端末収集を全日欠落として扱い、通信と認証だけで週全体を評価する。')
  ],
  guide: [
    check('比較条件を確認した', '対象期間・比較期間の日数とソースをそろえる。', 'compare'),
    check('欠落の開始と終了を確認した', '資産別資料と保守票で、停止したセンサー・復元可否を確かめる。', 'logs'),
    check('注記する範囲を決めた', '一部時間の欠落と、他経路で残っている記録を分けて報告する。', 'report')
  ],
  hints: ['同じ3日間でも、各時間に同じセンサーが動いていたとは限りません。', '経理端末の収集資料でgap_from/gap_toとsensorsを確認します。', '停止対象は端末の実行と接続センサーです。認証や境界フローがあることを、端末収集の稼働確認へ置き換えないようにします。'],
  rubric: {
    choice: 'gap-window', targets: ['FIN-WS-03'], sources: ['収集'], scope: true, operations: ['search', 'compare'],
    evidenceGroups: [group('欠落の時間と復元可否', 'gap', 'collection-finance-gap'), group('資産の通常取得範囲', 'context', 'collection-fin-ws-03')],
    evidenceExtras: [extra('normal-auth-fin-ws-03-0915', ['context'], '端末センサーとは別の認証経路が対象日に存在する例。欠落時間のプロセスを復元する根拠ではない。')]
  },
  explanation: {
    summary: 'FIN-WS-03の9月15日10:00〜12:00 JST（01:00〜03:00 UTC）は端末収集が欠けています。週全体を欠落扱いするのでも、欠落を活動ゼロと読むのでもありません。',
    reasoning: ['停止したのはwin-edrとendpoint-networkです。', 'バッファと再送がなく、その時間の端末イベントを後から取り戻せません。', 'windows-securityとedge-flowは別経路なので、その記録があっても親子実行を補えません。', '比較する日数が等しくても、観測できた時間や項目の差を確認する必要があります。'],
    next: '比較結果に欠落時間を付け、必要なら観測可能な時間帯をそろえた再比較と代替記録の調査を分けて行います。',
    sampleReport: '比較は両週3日間だが、FIN-WS-03の9月15日10:00〜12:00 JST（01:00〜03:00 UTC）にwin-edr/endpoint-networkの復元不能な欠落がある。該当時間の件数を活動ゼロとは扱わず、別経路の認証・境界通信と区別して注記する。'
  }
});

taskList.push({
  ...base('a04', 'A', '今ある記録で着手する', '観測不足の資産にも調査計画を残す', '代替記録の選択'),
  brief: '社外貸出端末が端末センサーに接続していません。いま取得できる情報で何を調べ、どの部分は追加取得を待つのか、資産を計画から落とさず整理してください。',
  context: 'REMOTE-WS-01は管理対象のままです。社内プロキシを通らず、利用できるのはIdP認証と台帳・接続状況です。端末上の実行については、取得方法と復帰予定を別途確認する必要があります。',
  choices: [
    choice('flow-first', '境界通信から接続先を調べ、端末のPIDと対応付けてからIdP認証を補助に使う。'),
    choice('process-first', '保持済み端末記録から実行元を調べ、次の接続時に認証結果の差分を補足する。'),
    choice('identity-first', 'IdP認証と台帳を先に照合し、端末の実行確認は復帰・追加取得の計画として残す。')
  ],
  guide: [
    check('現在の取得経路を読んだ', '端末、ネットワーク、IdPの経路を区別して確認する。', 'plan'),
    check('調べられる問いを選んだ', '認証のアカウント・時間・接続を調べ、端末内の実行とは分ける。', 'logs'),
    check('追加取得の条件を残した', '保持済み記録の有無と復帰予定を踏まえ、確認できない問いを記録する。', 'report')
  ],
  hints: ['センサー未接続の資産にも、別のサービス側に残る記録がある場合があります。', '社外端末の収集状況でavailable_alternativeとnetwork_routeを確認し、実際にそのソースを検索します。', 'IdPのセッションは取得できますが、端末のプロセスや社内プロキシの記録が復元されたわけではありません。'],
  rubric: {
    choice: 'identity-first', targets: ['REMOTE-WS-01'], sources: ['認証', '収集', '業務'], scope: true, operations: ['search', 'pivot'],
    evidenceGroups: [group('現在の欠落と代替経路', 'gap', 'collection-remote-gap'), group('取得できる認証の例', 'context', 'normal-auth-remote-ws-01-0915'), group('管理対象としての台帳', 'context', 'inventory-aonagi-20260914')],
    evidenceExtras: [extra('collection-remote-ws-01', ['gap', 'context'], '社外経路とIdPのみの取得範囲を示す資産別資料。')]
  },
  explanation: {
    summary: '認証については今あるIdP記録で着手できます。端末実行は取得できたことにせず、復帰・追加取得の条件を別に残します。',
    reasoning: ['管理対象から除外すると、端末が見えないという問題自体が計画から消えます。', '最終端末受信は対象期間より前で、保持バッファもありません。', '社内プロキシ外の経路なので、社内境界通信をこの端末の完全な代替として使えません。', 'IdP認証の成功は、本人操作や認証後の端末実行まで証明しません。'],
    next: 'IdPの利用を調べた範囲を残し、端末復帰・別監査・担当者からの追加取得の可否を確認します。',
    sampleReport: 'REMOTE-WS-01は台帳上の管理対象に含める。現時点ではIdP認証を調査し、端末実行の確認は未取得として残す。端末の復帰と代替監査の可否を確認し、認証成功だけで端末状態を判断しない。'
  }
});

taskList.push({
  ...base('b01', 'B', 'この環境のいつもの動き', '役割・アカウント・時間を自分の言葉でまとめる', '正常像の記述'),
  brief: '件数の多い値を覚えるだけでなく、「どの役割の資産が、誰の権限で、いつ、何の処理をするか」という正常像を作ります。集計と比較を行い、自分の説明を模範と見比べてください。',
  context: '利用者端末の複数アプリ（09〜16時台JST）、分散更新（12時台JST／03時台UTC）、管理端末の棚卸（09時JST／00時UTC）、ビルド（02時JST／前日17時UTC）、バックアップ（04時JST／前日19時UTC）が混在しています。全資産を一つの平均へまとめず、役割の違いを残します。',
  reflectionPrompt: '資産の役割・アカウント・時刻・処理・宛先のうち、少なくとも三つを結び付けて正常像を書いてください。比較が難しい収集条件も一つ残します。',
  modelReflection: '利用者端末は08〜09時台JST（前日23〜当日00時台UTC）に認証し、複数の業務アプリを起動する。管理端末のops-adminは09時JSTの棚卸、BUILD-SRV-01のsvc-buildは02時JST（前日17時UTC）のビルド、BACKUP-SRV-01のsvc-backupは04時JST（前日19時UTC）の保管処理を行う。12時台JSTの端末更新はSYSTEMの別ジョブである。認証のみのLinuxや未接続端末は、Windowsと同じプロセス量では比較しない。',
  choices: [
    choice('fleet-average', '全資産の件数を共通基準にし、基準を超えた役割から順に調べる。'),
    choice('role-baseline', '役割・アカウント・時間をそろえ、同じ条件の過去と比べて説明する。'),
    choice('user-average', '利用者名でまとめて共通基準を作り、サーバーと端末を同じ値で比べる。')
  ],
  guide: [
    check('集計の軸を変えた', 'ホスト、ユーザー、プロセス、宛先を切り替えて役割の違いを見る。', 'aggregate'),
    check('過去と比較した', '同じソース・同じ日数で比較し、定刻のジョブと利用者の動きを分ける。', 'compare'),
    check('正常像を書いて比較した', '自分の説明と模範を見比べ、当てはまる範囲と収集上の注意を残す。', 'report')
  ],
  hints: ['正常像は「多い値」だけではなく、その値が繰り返される条件の説明です。', 'ビルド、バックアップ、管理の実行票と、同じ資産の記録を照合します。', '定刻のジョブと人の操作を別々に記述すると、件数が違う理由と比較すべき相手を説明しやすくなります。'],
  rubric: {
    choice: 'role-baseline', reflection: true, sources: ['端末', '通信', '業務', '収集'], scope: true, operations: ['aggregate', 'compare'],
    evidenceGroups: [group('ビルドの条件', 'context', 'business-build-daily'), group('ビルドの実行例', 'context', 'normal-process-build-srv-01-0908'), group('別の定刻ジョブ', 'context', 'business-backup-daily'), group('比較能力の違い', 'context', 'collection-linux-auth')],
    evidenceExtras: [extra('business-update-daily', ['context'], '利用者操作とは別のSYSTEMによる端末別に分散した更新を説明する。'), extra('business-inventory-daily', ['context'], '管理専用端末の定刻処理を説明する。'), extra('normal-backup-0915', ['context'], '業務定義と実際の定刻開始を照合する。'), extra('normal-net-build-srv-01-0915', ['context'], '定例ビルドに続くパッケージ取得の例。')]
  },
  explanation: {
    summary: '正常像は役割と条件を含む説明にすると、後で何が変化したかを検証できます。自由文の意味や文章のうまさは採点せず、書いて比較したことを確認します。',
    reasoning: ['サーバーのバッチは利用者端末とは時間帯・権限・宛先が違います。', '同じホストの通信でも利用者のブラウザーとSYSTEMの更新は別の処理です。', '定刻のジョブが毎回同じ秒でも不自然ではありません。人の認証や接続は時刻が少しずつ異なります。', 'Linux auth.logとWindowsのプロセス記録では観測している対象が違い、単純な件数差を行動差とは読めません。'],
    next: '正常像を固定した正解にせず、業務変更や収集変更があったときに更新できる基準として残します。',
    sampleReport: '基準を役割・実行アカウント・時間帯ごとに記録した。定例ビルド、バックアップ、棚卸、端末更新を利用者の操作と分け、収集項目の異なる資産を同じプロセス件数で比べない。'
  }
});

taskList.push({
  ...base('b02', 'B', '少ない親子関係を読む', '珍しい組み合わせを説明できるか', '頻度から候補を調べる', financeExample),
  brief: '親プロセスと子プロセスの組み合わせを少ない順に見て、珍しい実行を調べます。見つけた候補が業務条件と一致するかを確認し、頻度だけで結論を決めないでください。',
  context: '四半期の帳票処理は毎日には現れません。通常のブラウザーや定例処理と違う親子関係でも、事前に許可された範囲と実行結果が一致する場合があります。',
  findings: [choice('report-scope', '対象端末・署名スクリプト・共有出力を一つの帳票作業にまとめ、許可された業務と判断する。'), choice('daily-baseline', '実行と出力を日次の定例処理として基準へ加え、次回も同じ曜日・時間の件数と比較する。'), choice('parent-exception', '親アプリ名を帳票業務の条件として残し、スクリプトや出力先が違う実行にも同じ説明を使う。')],
  guide: [check('稀な組み合わせを見つけた', '親と子の組み合わせで集計し、少ない候補と定例処理を区別する。', 'aggregate'), check('実行のつながりを確かめた', '親GUID、子の起動、出力先を同じ時間帯で照合する。', 'timeline'), check('業務の範囲を確認した', '承認されたアカウント・期間・スクリプト・出力と比べて結論を残す。', 'report')],
  hints: ['件数の少ない組み合わせは調べる入口ですが、そのまま悪性の分類ではありません。', '親子の複合集計と少ない順の並べ替えを使い、帳票処理の端末へピボットします。', 'スクリプトの場所と署名、実行する利用者、時間、共有先が同じ承認範囲に入るか見比べます。'],
  rubric: {
    targets: ['FIN-WS-02'], verdict: 'benign', sources: ['端末', 'ファイル', '業務'], scope: true, finding: 'report-scope', operations: ['aggregate', 'search', 'pivot'],
    evidenceGroups: [group('稀な親子実行', 'support', 'event-win-20260915-140506'), group('一致する事前承認', 'counter', 'business-finance-export'), group('承認された出力', 'counter', 'event-file-20260915-140520')],
    evidenceExtras: [extra('event-win-20260915-140501', ['context', 'support'], '子のParentProcessGuidに対応する帳票アプリの起動。'), extra('normal-process-fin-ws-02-0908', ['context'], '通常のブラウザー起動と比べるための例。')]
  },
  explanation: {
    summary: 'FIN-WS-02の帳票処理は稀な親子関係ですが、FIN-417の承認と出力が一致するため、この実行は正当な業務と判断します。',
    reasoning: ['excel.exeからpowershell.exeという組み合わせが候補になります。', '親GUIDと子のParentProcessGuidで同じ起動を照合できます。', 'ikeda、14時台JST（05時台UTC）、署名済みQuarterlyExport.ps1、経理共有への出力が承認と一致します。', '親アプリ名を広く例外化するのではなく、確認した条件を残します。'],
    next: '役割・期間・スクリプト・署名・出力先を含む限定した業務条件として記録します。',
    sampleReport: '稀なexcel.exe→powershell.exeをFIN-WS-02で確認した。親子GUID、署名付きスクリプト、利用者、実行時間、共有先がFIN-417と一致するため、この実行は正当な業務と判断する。異なるスクリプトや出力先には同じ説明を当てはめない。'
  }
});

taskList.push({
  ...base('b03', 'B', '初めて見えた宛先の範囲', '初出と広がりを別々に確認する', '基準値ゼロの扱い', ['event-net-20260915-020133']),
  brief: '前週にないリポジトリ宛先が現れています。この宛先への利用が一般端末へ広がっているかを検証し、初出という事実と調査すべき範囲を分けてください。',
  context: 'repo-next.exampleは対象週にだけ出現します。比較画面で前週0件の比率が出せないことと、危険性が高いことは別です。どの資産・アカウント・処理から接続したかを確認します。',
  findings: [choice('spread-case', '宛先の初出を一般端末への展開を示す記録として残し、ビルドと端末を分けて継続して追加調査する。'), choice('build-question', '接続主体はビルドサーバーで、一般端末への展開を裏付けない。取得先の変更理由を確認する。'), choice('repo-approved', '既知のビルドと同じ処理系からの接続なので、許可された取得先として比較基準へ追加する。')],
  guide: [check('初出を確かめた', '通信を宛先別に比較し、前週0件と対象週の件数を分けて読む。', 'compare'), check('接続した主体を調べた', '候補の宛先で検索し、ホスト・アカウント・ジョブへピボットする。', 'timeline'), check('支持される範囲を残した', '一般端末への広がりと、ビルド内の変更理由を別の問いとして記録する。', 'report')],
  hints: ['前週0件は「増加率が無限大」という意味ではなく、今回の比較では初出という情報です。', '宛先の比較から候補を検索し、ホストの役割とジョブIDを確認します。', '同じビルドの別パッケージ取得と並べると、どの資産の活動かは分かります。新しい取得先の承認まで同じ資料で説明できるかも確認します。'],
  rubric: {
    targets: ['BUILD-SRV-01'], verdict: 'unsubstantiated', sources: ['通信', '業務', '収集'], scope: true, finding: 'build-question', operations: ['compare', 'aggregate', 'search', 'pivot'],
    evidenceGroups: [group('初出宛先の実行主体', 'context', 'event-net-20260915-020133'), group('ビルドの通常条件', 'context', 'business-build-daily'), group('対象資産の取得範囲', 'context', 'collection-build-srv-01')],
    evidenceExtras: [extra('normal-net-build-srv-01-0908', ['context'], '前週の通常リポジトリ取得の比較例。'), extra('normal-net-build-srv-01-0915', ['context'], '同じ日の定例パッケージ取得と新しい要求を区別する例。'), extra('inventory-aonagi-20260914', ['context'], 'ビルドサーバーと一般端末を同じ母集団内の別役割として扱う台帳。')]
  },
  explanation: {
    summary: 'このスナップショットでは新しい宛先はBUILD-SRV-01だけに見られ、一般端末への広がりは裏付けられません。取得先の変更理由は別の未確認事項です。',
    reasoning: ['前週0件・対象週1件という初出を確認します。', '接続はsvc-buildのBUILD-DAILYに付く要求で、一般利用者の端末ではありません。', '既存の許可はpackages.exampleを示しており、同じpython3からの通信という理由だけでrepo-next.exampleを承認済みとは扱いません。', '特定の展開仮説が支持されないことと、この宛先の正当性が確定したことを分けます。'],
    next: 'ビルド依存関係や設定変更の記録を確認し、新しい取得先の目的・管理者を別の問いとして調べます。',
    sampleReport: '対象週に初出のrepo-next.exampleを調査した。今回の記録はBUILD-SRV-01のsvc-buildによる1件で、一般端末への広がりは裏付けられない。既存のビルド資料にある取得先とは異なるため、取得先変更の理由は別途確認する。'
  }
});

const c1Ids = ['intelligence-note-20260914', 'event-win-20260915-112001', 'event-win-20260915-112005', 'event-net-20260915-112009'];
taskList.push({
  ...base('c01', 'C', '外部情報から環境の問いを作る', 'ファイル名から行動の関係へ', '脅威情報を起点にしたハント', [...c1Ids, ...financeExample]),
  brief: '外部の観測情報を、この環境で検証できる仮説にします。2026年9月14〜16日（JST）のWindows資産から、docview.exeを親とするpowershell.exeの起動と、powershell.exeからsession-api.exampleへの通信を候補として抽出してください。同じ実行に対応するかを確認し、帳票業務という別の説明を今回に適用できるか判断します。',
  context: '外部情報のファイル名は一つの観測例です。ここでは名前の一致より行動の組み合わせを調べます。提出クエリの主評価・別評価はともに9月14〜16日（JST）へ固定し、画面の探索フィルターとは独立しています。期間はJST営業日で制限されるため、ORの各枝へ日付条件を重ねる必要はありません。原記録はUTCで、検索式のafter:/before:は明示したUTC日付です。',
  hypothesisPrompt: '対象・期間・観測したい行動・必要な記録・別の説明を含めて仮説を書き、調査後に模範と比較してください。',
  modelHypothesis: '9月14〜16日（JST）のWindows資産で、文書アプリを親とするスクリプト起動と、その同じ実行に続く新しい外部通信があるか調べる。親子GUIDと接続GUIDで照合し、署名済みの帳票処理など業務上の別の実行を区別する。',
  alternativeExplanations: [
    choice('finance-user-only', 'FIN-417と今回の親アプリ・署名済みスクリプトは一致するが、利用者が異なる。営業担当による帳票の代理実行と考え、担当者の追加承認を確認する。'),
    choice('finance-scope-mismatch', 'FIN-417の対象は経理端末・Excel・署名済み帳票スクリプトで、今回の営業端末・文書アプリ・一時領域スクリプトには適用できない。'),
    choice('finance-time-only', 'FIN-417と今回の端末・利用者・スクリプトは一致するが、許可時間が異なる。営業資料を扱う同じ帳票処理の時間外実行として作業票の延長を確認する。')
  ],
  findings: [choice('file-name', '外部情報の文書の例示ファイル名を条件として残し、その名前に一致した取得経路を別途確認する。'), choice('same-tool', '同じ実行ツールの利用を共通の行動とみなし、親アプリが違う資産にも調査範囲を広げる。'), choice('same-execution', '親子と通信が同じ実行を示す候補を追い、文書・スクリプトの来歴と接続目的を追加確認する。')],
  guide: [check('自分の仮説を書いた', '外部情報を、この環境の対象・期間・データで検証できる問いへ置き換える。', 'plan'), check('候補と対照を調べた', '親子関係と接続を照合し、同じツールを使う別業務を比較する。', 'timeline'), check('クエリと報告を提出した', '該当する子プロセスとその宛先への通信を返すクエリを作り、自分の仮説を見直す。', 'report')],
  hints: ['例示ファイル名の代わりに、親アプリと子の実行、後続通信という関係を探します。', '親・プロセスの条件と宛先の条件をORで組み、候補からGUIDを使って確認します。', '帳票アプリ由来の実行は別の業務説明があります。提出結果には対象の子の起動と通信を残し、親アプリ自体の起動は補足証拠として分けます。'],
  rubric: {
    selfReview: true, targets: ['SALES-WS-03'], verdict: 'supported', sources: ['端末', '通信', '業務'], scope: true, finding: 'same-execution', alternative: 'finance-scope-mismatch', operations: ['search', 'aggregate', 'pivot'],
    evidenceGroups: [group('対象となる親子実行', 'support', 'event-win-20260915-112005'), group('同じ実行の通信', 'support', 'event-net-20260915-112009'), group('比較する業務条件', 'context', 'business-finance-export'), group('比較する実際の業務実行', 'context', 'event-win-20260915-140506')],
    evidenceExtras: [extra('event-win-20260915-112001', ['context', 'support'], '子の親GUIDに対応する文書アプリと対象文書。'), extra('intelligence-note-20260914', ['context'], '仮説の出典で、この環境の実行証拠そのものとは別。'), extra('normal-rare-docview-preview', ['context'], '同じ文書アプリでも異なる子を起動する比較例。'), extra('business-docview-preview', ['context'], 'プレビューの対象・実行者・時間を説明する許可で、調査対象スクリプトには適用しない。'), extra('normal-rare-session-portal', ['context'], '同じ宛先へのブラウザー通信を別の実行として区別する比較例。'), extra('business-partner-portal-test', ['context'], 'ブラウザーでの試験利用の範囲。調査対象スクリプト通信の許可ではない。')],
    query: { expected: ['event-win-20260915-112005', 'event-net-20260915-112009'], filters: { period: 'current', timezone: 'Asia/Tokyo', from: '2026-09-14', to: '2026-09-16' } }
  },
  explanation: {
    summary: 'SALES-WS-03で文書アプリ由来のスクリプトと同じ実行の外部接続が対応し、仮説を支持します。攻撃者名や被害全体までを示す結果ではありません。',
    reasoning: ['子のParentProcessGuidは文書アプリのProcessGuidと一致し、通信のProcessGuidは子のものと一致します。', '署名済み帳票の実行は親、利用者、スクリプト、承認が異なるため、同じpowershell.exeとして一括しません。', '帳票業務という良性説明はFIN-417の対象・親・署名済みスクリプトに限られます。今回の営業端末・docview.exe・一時領域のスクリプトへ適用しない理由を記録します。', '期間は両評価の固定条件です。ORでは行動条件を組み、同じ実行かどうかはGUIDで確認します。', '自由に書いた仮説の意味は機械採点せず、書いた内容を模範と比較したことを確認します。'],
    next: '文書とスクリプトの来歴、通信の目的、同じ親子関係と宛先の範囲を追加確認します。',
    sampleQuery: 'source:端末 parent:docview.exe process:powershell.exe OR source:通信 destination:session-api.example process:powershell.exe',
    sampleReport: '対象週のSALES-WS-03で文書アプリの子としてスクリプトが起動し、同じGUIDでsession-api.exampleへ通信した。帳票業務の別実行とは条件が異なり、仮説を支持する。取得経路と通信目的を追加確認する。'
  }
});

taskList.push({
  ...base('c02', 'C', '手法から管理接続を調べる', 'RDPの利用と承認範囲を照合する', 'ATT&CK手法を起点にしたハント', ['event-auth-20260915-193011', 'event-business-20260915-194500', 'reference-attack-rdp']),
  brief: 'MITRE ATT&CKのT1021.001（Remote Desktop Protocol）を起点に、正当なアカウントによるRDP利用がアクセス拡大に使われていないかを調べます。検証する範囲を自分で仮説にし、2026年9月14〜16日（JST）のops-adminによるRDPログオンを返すクエリを提出してください。',
  context: 'MITREの手法記述では、有効なアカウントを使ったRDP接続が攻撃者のアクセス拡大に使われることがあります。ただしRDPは管理にも使われるため、接続元・アカウント・時刻・事前許可を照合します。参照: MITRE ATT&CK T1021.001 https://attack.mitre.org/techniques/T1021/001/ （2026-10-27確認。アプリは参照先を自動取得しません）。',
  hypothesisPrompt: 'RDPを使ったアクセス拡大という手法を、この環境の対象・アカウント・許可範囲で検証できる仮説にしてください。通常の保守として説明できる条件も含めます。',
  modelHypothesis: 'T1021.001を起点に、9月14〜16日（JST）のops-adminによるRDPが許可された端末・時間・作業範囲を超えたアクセスに使われていないかを調べる。ログオン種別・接続元・時刻を事前承認・作業記録と照合し、予定保守で説明できる範囲は区別する。',
  findings: [choice('bounded-maintenance', '接続元・時間・担当者が一致する記録を同じ保守作業にまとめ、実施範囲を報告する。'), choice('off-hours-incident', '19時台JSTという通常との差を主な根拠として事案候補に残し、今回の作業許可とは分けて判断する。'), choice('account-exception', '管理者アカウントの利用を今回の保守として扱い、接続先や時間の相違は次の棚卸で見直す。')],
  guide: [check('変化を仮説にした', '時間・接続先・認証方式のどれを比較し、どこを承認と照合するか書く。', 'plan'), check('同じ作業へ対応付けた', '認証の時刻・利用者・接続元を作業票と照合し、事前承認の範囲を確かめる。', 'timeline'), check('抽出と判断を分けた', '対象週の該当ログオンを返す条件と、その正当性の判断を別に残す。', 'report')],
  hints: ['時刻の違いは調査の入口です。業務上の時刻はJST、センサー原記録はUTCです。両者を対応付けて比較します。適用される作業条件を探します。', '認証ソースで管理者アカウントとリモートログオンの種類を絞り、セッションを照会します。', 'ログのLogonTypeと、事前許可にある接続元・時間・作業を比べます。提出クエリには作業票ではなく認証行を返します。'],
  rubric: {
    selfReview: true, targets: ['FILE-SRV-01'], verdict: 'benign', sources: ['認証', '業務'], scope: true, finding: 'bounded-maintenance', operations: ['search', 'compare', 'pivot'],
    evidenceGroups: [group('調査対象の認証', 'support', 'event-auth-20260915-193011'), group('許可された範囲', 'counter', 'business-helpdesk-maint'), group('対応する保守作業の記録', 'counter', 'event-business-20260915-194500')],
    evidenceExtras: [extra('normal-rdp-file-srv-01-0907', ['context'], '前週にも同じ管理者・接続元によるRDPがある。時刻やリモート接続だけを異常とはしない。'), extra('normal-rdp-idp-srv-01-0908', ['context'], '別の管理対象サーバーに対する前週のRDPの比較例。'), extra('business-baseline-rdp', ['context'], '前週のRDPを説明する作業範囲。今回の接続にはOPS-418を個別に照合する。'), extra('normal-console-admin-0915', ['context'], '同じアカウントの対話ログオンをRDP抽出から区別する。'), extra('normal-rdp-storage-0915', ['context'], '同じ時間帯のRDPでも別アカウントの作業である。'), extra('reference-attack-rdp', ['context'], '仮説の起点にする手法の出典で、当該接続が悪性と判断されたことを意味しない。')],
    query: { expected: ['event-auth-20260915-193011'], filters: { period: 'current', timezone: 'Asia/Tokyo', from: '2026-09-14', to: '2026-09-16' } }
  },
  explanation: {
    summary: 'FILE-SRV-01へのリモートログオンは、OPS-418の時間・接続元・アカウント・作業と一致し、確認したセッションについては正当な保守です。',
    reasoning: ['認証はLogonType=10です。前週にも許可されたRDPがあり、利用者の対話ログオンや別アカウントのRDPとは区別します。', '作業票に内部セッションIDはありません。19:30 JST（10:30 UTC）という時刻、ops-admin、IT-ADM-01からFILE-SRV-01という経路、保守内容を照合します。', '例外はこの作業の範囲に限定し、同じアカウントの将来の利用へ広げません。', '抽出条件は候補を見つけるもので、条件に一致したこと自体を悪性判定にしません。'],
    next: '確認した作業範囲を記録し、別時間・別端末・別セッションに同じ説明が適用できるかは別途確認します。',
    sampleQuery: 'source:認証 user:ops-admin "LogonType=10"',
    sampleReport: '対象週のops-adminによるリモートログオンを抽出した。FILE-SRV-01の19:30 JSTのセッションは、事前のOPS-418と完了票に一致する。確認した範囲では正当な保守として記録し、アカウント全体の例外とはしない。'
  }
});

const qHash = all.get('event-file-20260915-071211').hash;
taskList.push({
  ...base('c03', 'C', '対応済みの標本から広がりを調べる', '同じハッシュと同じ実行を区別する', '既知事案を起点にしたハント', ['event-file-20260915-071211', 'event-file-20260915-071217']),
  brief: `過去対応の標本ハッシュ ${qHash} を手掛かりに、この環境で同じ内容が実行されたかを調べます。まず2026年9月14〜16日（JST）のハッシュ一致行を、隔離・実行などのソースを限定せず返すクエリを作り、ファイルの存在とプロセスの実行を分けて判断してください。`,
  context: 'ハッシュは原内容の識別に使われますが、隔離コンテナー内の保持標本にも付与されます。どのソースで何を記録したハッシュなのかを確認し、保管場所の一致をそのまま実行の広がりと読まないようにします。',
  hypothesisPrompt: '既知標本が対象期間に実行されたかを検証する仮説を書いてください。一致がファイル保持だけだった場合に何が言えるかも含めます。',
  modelHypothesis: '9月14〜16日（JST）に既知ハッシュの内容が実行されたかを調べる。ハッシュ一致を広く抽出し、隔離ストアの原内容ハッシュとプロセス開始時の実行ファイルハッシュを区別する。保持標本しか見つからなければ、観測した範囲で実行の裏付けなしとし、対象外の期間まで否定しない。',
  findings: [choice('hash-execution', '既知ハッシュの一致を実行の証拠として残し、保持先ごとの関連する認証を分けて追加確認する。'), choice('retained-objects', '一致した行を保持標本の同期としてまとめ、今回の取得範囲では実行の裏付けなしと報告する。'), choice('first-copy', '同期時刻の早い資産を実行元とみなし、遅い資産についてはコピーの保管状況を確認する。')],
  guide: [check('仮説と識別子を記録した', '一致を探すハッシュと、実行を示すために必要なソースを分ける。', 'plan'), check('一致行の意味を確認した', 'ファイル保持・隔離・プロセス開始を区別し、取得範囲を照合する。', 'logs'), check('結果と限界を提出した', '一致した2資産を報告し、クエリの結果と実行に関する結論を混同しない。', 'report')],
  hints: ['同じハッシュは同じ種類のイベントを意味しません。まずsourceとactionを読みます。', 'hashフィールドの完全一致検索を使い、保持ストアの項目と端末の実行項目を比べます。', '暗号化コンテナーと原内容ハッシュの関係を確認します。提出クエリでは保管記録も含めた一致行を残し、その解釈を報告で分けます。'],
  rubric: {
    selfReview: true, targets: ['FILE-SRV-01', 'DESIGN-WS-01'], verdict: 'unsubstantiated', sources: ['ファイル', '端末', '収集', '業務'], scope: true, finding: 'retained-objects', operations: ['search', 'aggregate', 'pivot'],
    evidenceGroups: [group('サーバー側の一致', 'context', 'event-file-20260915-071211'), group('端末側の一致', 'context', 'event-file-20260915-071217'), group('一致するフィールドの意味', 'context', 'collection-quarantine-hash'), group('保持する業務の範囲', 'context', 'business-quarantine-retention')],
    evidenceExtras: [extra('collection-file-srv-01', ['context'], 'サーバー側に別途プロセス開始センサーがあることを確認する。'), extra('collection-design-ws-01', ['context'], '端末側のプロセス記録の取得条件を確認する。')],
    query: { expected: ['event-file-20260915-071211', 'event-file-20260915-071217'], filters: { period: 'current', timezone: 'Asia/Tokyo', from: '2026-09-14', to: '2026-09-16' } }
  },
  explanation: {
    summary: '一致したのは2資産の隔離標本です。今回のスナップショットでは同じ内容の実行を裏付ける記録はなく、保持と実行を区別して残します。',
    reasoning: ['original_sha256は隔離前の原内容を示す値で、暗号化コンテナー自身の実行を示すフィールドではありません。', '両行ともquarantine_syncで、QUARANTINE-SYNCの保持場所と一致します。', '実行の調査には別センサーのProcessGuidや実行時ハッシュを使います。ファイルログにGUIDを補いません。', '観測した期間で裏付けがないことは、他期間で未実行だったことの証明ではありません。'],
    next: '標本保持の一致として記録し、必要なら別期間のプロセス記録と対応時の調査結果を確認します。',
    sampleQuery: `hash:${qHash}`,
    sampleReport: '既知ハッシュはFILE-SRV-01とDESIGN-WS-01の隔離同期で一致した。両行は保持標本の原内容ハッシュであり、対象期間の実行を示す記録とは別である。今回の範囲では実行の広がりは裏付けられず、保持と実行を分けて記録する。'
  }
});

taskList.push({
  ...base('c04', 'C', '重要資産から取得範囲を調べる', '業務上の影響と共有オブジェクト', '重要資産を起点にしたハント', ['event-auth-20260915-162002', 'event-net-20260915-162007']),
  brief: '調査期間は2026年9月14〜16日（JST）です。財務と設計のデータを保管するFILE-SRV-01を起点に、承認範囲外の外部取得が起きていないか調べます。資産の重要性と許可された共有範囲を自分の仮説にし、2026年9月15日（JST）に依頼の時間・受領者から特定したセッションの認証行と、path=/downloadの応答行を返すクエリを提出します。',
  context: 'FILE-SRV-01は財務報告と設計業務を支え、data-ownerが公開可能な集計ファイルだけを外部共有として許可しています。資産全体が重要でも、今回応答したデータの機密性は別に確認します。オブジェクトや本文の保存条件も調べてください。抽出対象は認証と/download応答で、同じセッションの/listや/status応答は含めません。',
  hypothesisPrompt: 'この資産が重要な理由と守るデータを述べ、共有の許可範囲を超えた取得をどの記録で確かめるか書いてください。資産の重要性と実際の被害確認を分けます。',
  modelHypothesis: '財務・設計を支えるFILE-SRV-01を優先し、9月14〜16日（JST）のうち、依頼日の15日の共有セッションで承認外オブジェクトが取得されたか調べる。時間・受領者を承認と照合し、セッションと要求IDで認証・応答・対象物の監査を結び、対象物を確認できなければ資産の重要性から被害を推定せず不足として残す。',
  findings: [choice('response-volume', '応答量を取得対象の大きさとして残し、許可されたファイルの容量と比べて範囲を判断する。'), choice('token-recipient', '認証相手が許可された受領者なので、このセッションの応答を承認内の取得として記録する。'), choice('object-gap', '認証と応答を同じセッションにまとめ、取得対象を確かめる別監査と所有者記録を探す。')],
  guide: [check('依頼を仮説にした', '承認された対象・受領者・期間のどこを検証するか決める。', 'plan'), check('同じセッションを抽出した', '認証と応答の識別子を照合し、保持されている項目を調べる。', 'timeline'), check('観測不足を具体化した', '必要な対象物の情報と、実際に保存された情報の差を報告する。', 'report')],
  hints: ['認証された相手と、渡されたオブジェクトは別の確認事項です。', '依頼の時間・接続元・受領者から認証を探し、得たセッションでダウンロード応答を調べます。', '同じセッションであることは確認できます。対象物まで分かる欄があるかを確認し、応答量からファイル名を補わないようにします。'],
  rubric: {
    selfReview: true, targets: ['FILE-SRV-01'], verdict: 'insufficient', sources: ['認証', '通信', '業務', '収集'], scope: true, finding: 'object-gap', operations: ['search', 'pivot'],
    evidenceGroups: [group('認証されたセッション', 'support', 'event-auth-20260915-162002'), group('対応する応答', 'support', 'event-net-20260915-162007'), group('対象物の未収集', 'gap', 'collection-share-gateway'), group('確認する承認範囲', 'context', 'business-share-request')],
    evidenceExtras: [extra('collection-file-srv-01', ['context'], 'Windows端末側の収集と共有ゲートウェイのオブジェクト監査が別経路であると区別する。'), extra('business-critical-files', ['context'], '重要資産の業務影響と公開可能な対象を確認する。資産の重要性だけで実際の取得内容を決めない。')],
    query: { expected: ['event-auth-20260915-162002', 'event-net-20260915-162007'], filters: { period: 'current', timezone: 'Asia/Tokyo', from: '2026-09-15', to: '2026-09-15' } }
  },
  explanation: {
    summary: '共有セッションの認証と1 MiBの応答は確認できますが、対象オブジェクトが保存されていないため承認範囲外の取得かは判断できません。',
    reasoning: ['SHARE-911で認証と応答をつなげられます。', '受領者が承認範囲内でも、取得対象が承認範囲内だったことまでは示しません。', 'object_idと本文の監査は対象期間に未収集で、Windowsのファイル監査とは別経路です。', '応答量やHTTP 200だけをファイル内容や機密情報量へ読み替えません。'],
    next: 'サービス側の別監査やデータ所有者の処理記録を確認し、復元できない項目はそのまま限界として残します。',
    sampleQuery: 'host:FILE-SRV-01 source:認証 user:partner-07 session:SHARE-911 OR host:FILE-SRV-01 source:通信 user:partner-07 session:SHARE-911 "path=/download"',
    sampleReport: 'SHARE-911の認証と応答は対応するが、対象期間のゲートウェイにはobject_idや本文がない。承認外オブジェクト取得の有無は観測不足であり、別監査と所有者の記録を確認する。'
  }
});

taskList.push({
  ...base('c05', 'C', '検知条件の届かない範囲を調べる', 'ルールの前提と代替記録', '検知ルールの抜けを起点にしたハント', ['event-net-20260915-103159', 'event-net-20260915-103203']),
  brief: '調査期間は2026年9月14〜16日（JST）です。既存ルールDET-PROC-17は端末実行と通信をProcessGuidで結びます。その入力が欠ける時間帯に、ルールで扱えない外部通信がないか仮説を立てます。提出クエリでは9月15日（JST全日）のFIN-WS-03からrelay-room.exampleへの境界フローを、TLSの有無を問わず抽出してください。',
  context: 'DET-PROC-17はwin-edrとendpoint-networkの両方を必要とし、device_idとProcessGuidで結合します。境界フローは別経路でGUIDがなく、このルールの入力を置き換えません。2026年9月15日（JST全日）のFIN-WS-03からrelay-room.exampleへの境界フローを返す探索クエリと、ルールが評価できる範囲を分けて提出します。ポート80の非TLSフローも抽出対象です。境界レコードはsensor=edge-flowです。端末側センサーの通信はこの抽出には含めません。',
  hypothesisPrompt: '既存ルールが必要とする項目と、欠けた場合に対象外となる行動を述べて仮説を書いてください。代替検索で確かめられることと、悪性や実行元まで言えない部分を分けます。',
  modelHypothesis: 'DET-PROC-17がProcessGuid付きの二つの入力を得られない時間に、FIN-WS-03で未確認プログラム由来の外部通信があったか調べる。境界フローで通信の存在を確認し、同時刻の実行を結べるか検証する。結べなければ悪性や実行元を推測せず、ルール依存の可視性と収集ヘルス監視の改善として残す。',
  findings: [choice('alternate-endpoint', '通信の存在は確認できるが実行元は対応付かないため、端末の別監査と追加取得の可否を調べる。'), choice('nearest-process', '前後の最も近い実行を通信元として残し、別時刻の接続と分けてプログラムの更新履歴を調べる。'), choice('daily-update', '同じ端末の12時台JSTの更新と一つの処理にまとめ、接続先が変わった理由を配布担当へ確認する。')],
  guide: [check('欠落から問いを作った', '欠落時間に検証したい行動と、その確認に必要な項目を自分で書く。', 'plan'), check('代替経路を検索した', '境界フローで対象の時刻・資産・宛先を確かめ、実行元が記録されているかを見る。', 'logs'), check('結び付かない範囲を残した', '結合できる識別子と不足する識別子を区別し、次に探す資料を報告する。', 'report')],
  hints: ['欠落したソースの代わりに別経路の通信を調べても、同じ情報が得られるとは限りません。', '収集停止の時間帯と境界フローの時刻を合わせ、境界センサーの取得項目を読みます。', '端末や利用者が同じというだけでは、前後の実行とこのフローは対応しません。提出結果は該当宛先の境界フローです。sensor:edge-flowで取得経路を指定できます。'],
  rubric: {
    selfReview: true, targets: ['FIN-WS-03'], verdict: 'insufficient', sources: ['通信', '収集', '端末', '業務'], scope: true, finding: 'alternate-endpoint', operations: ['search', 'compare', 'pivot'],
    evidenceGroups: [group('欠落時間内の通信', 'support', 'event-net-20260915-103203'), group('端末記録の欠落', 'gap', 'collection-finance-gap'), group('境界経路の取得項目', 'gap', 'collection-edge-flow'), group('ルールの必要条件', 'context', 'business-detection-process-egress')],
    evidenceExtras: [extra('event-net-20260915-103159', ['support', 'context'], '同じ端末・宛先のポート80の境界フロー。TLSだけに抽出を限定しない。'), extra('collection-rule-dependencies', ['context'], 'ルールの結合条件と、境界フローでは代替できない項目を確認する。'), extra('collection-fin-ws-03', ['context', 'gap'], '資産別の取得経路と同じ停止区間を確認する。'), extra('normal-process-fin-ws-03-0915', ['context'], '欠落前には実行記録があるが、10:32 JST（01:32 UTC）の通信元を決める根拠にはしない。'), extra('normal-update-fin-ws-03-0915', ['context'], '12時台JSTの別の更新要求と宛先を比較し、欠落時間のフローへさかのぼって結合しない。')],
    query: { expected: ['event-net-20260915-103159', 'event-net-20260915-103203'], filters: { period: 'current', timezone: 'Asia/Tokyo', from: '2026-09-15', to: '2026-09-15' } }
  },
  explanation: {
    summary: '欠落時間内の外部通信は確認できますが、実行元の仮説を検証する記録がありません。可視性の改善と代替取得につながる成果として残します。',
    reasoning: ['10:31〜10:32 JST（01:31〜01:32 UTC）の2フローは10:00〜12:00 JST（01:00〜03:00 UTC）の端末収集停止時間に入ります。', 'edge-flowのflow_idは通信記録の識別子で、端末のProcessGuidではありません。', '同日の通常ブラウザーや12時台JSTの更新は別の時刻・別の宛先で、同じプロセスだと推測できません。', 'ポート80と443の両フローが抽出対象です。続けて現れたことだけで、同じプロセスやリダイレクトの因果関係とは判断しません。', '観測不足という結果でも、対象・必要な項目・次の確認を具体的に記録します。'],
    next: '端末側の別監査を確認するとともに、ルールに必要な両入力の停止を別のヘルス監視で把握する計画を残します。境界フローを使う代替検索は実行元を確定する検知へ読み替えません。',
    sampleQuery: 'host:FIN-WS-03 source:通信 sensor:edge-flow destination:relay-room.example',
    sampleReport: 'FIN-WS-03で欠落時間内のrelay-room.exampleへのフローを確認した。端末実行の記録は復元不能で、境界センサーにも実行元の識別子がないため仮説は観測不足。前後の別実行を当てはめず、代替資料と収集改善を確認する。'
  }
});

// Independently authored result-set validation. Clock values below are local JST
// authoring values with temporary Z suffixes; catalog converts them once to UTC.
// Native payloads, indexed fields,
// timestamps and provenance are created together instead of copying a visible
// row and leaving the old host/session in its payload. No prose is graded.
const { createHash } = require('node:crypto');
const validationHash = value => createHash('sha256').update(value).digest('hex');
const validationGuid = value => {
  const h = validationHash(value);
  return `{${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}}`;
};
function validationRow(id, at, host, source, sensor, user, detail, observed = {}) {
  const asset = environment.assets.find(item => item.host === host);
  if (!asset) throw new Error(`Unknown validation asset: ${host}`);
  const day = at.slice(0, 10);
  const period = Object.keys(environment.periods).find(key => day >= environment.periods[key].from && day <= environment.periods[key].to);
  if (!period) throw new Error(`Validation date outside declared periods: ${id} ${day}`);
  return environment.normalizeLog({ id, at, period, host,
    device_id: asset.device_id, source, sensor, user, event: source === '端末' ? 'プロセス開始を記録' : source === '認証' ? '認証を記録' : 'センサーの記録',
    detail, provenance: { kind: 'synthetic', sensor, format: 'synthetic-key-value', collectionId: `collection-${host.toLowerCase()}` }, ...observed });
}
function processFixture(id, at, host, user, process, parent, observed = {}) {
  const pg = observed.process_guid || validationGuid(`${id}-process`);
  const ppg = observed.parent_process_guid || validationGuid(`${id}-parent`);
  const pid = observed.pid || 7500 + Number.parseInt(validationHash(id).slice(0, 3), 16);
  const session = observed.session || `0x${validationHash(`${host}-${at.slice(0, 10)}-${user}`).slice(0, 8)}`;
  const appPath = name => name === 'powershell.exe' ? 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
    : name === 'explorer.exe' ? 'C:/Windows/explorer.exe' : ['docview.exe', 'preview-renderer.exe'].includes(name) ? `C:/Program Files/DocView/${name}`
    : name === 'excel.exe' ? 'C:/Program Files/Microsoft Office/root/Office16/excel.exe' : `C:/Program Files/Aonagi/${name}`;
  const image = appPath(process);
  const parentImage = appPath(parent);
  return validationRow(id, at, host, '端末', 'win-edr', user,
    `Image="${image}" ParentImage="${parentImage}" ProcessGuid=${pg} ParentProcessGuid=${ppg} ProcessId=${pid} ParentProcessId=4092 User=${user} LogonId=${session}${observed.script ? ` Script="${observed.script}"` : ''}${observed.signature ? ` SignatureStatus=${observed.signature}` : ''}${observed.publisher ? ` Publisher=${observed.publisher}` : ''}`,
    { process, parent, process_guid: pg, parent_process_guid: ppg, pid, parent_pid: 4092, session, ...observed });
}
function endpointFixture(id, at, host, user, process, destination, observed = {}) {
  const pg = observed.process_guid || validationGuid(`${id}-process`);
  const pid = observed.pid || 7904;
  const session = observed.session || `0x${validationHash(`${host}-${at.slice(0, 10)}-${user}`).slice(0, 8)}`;
  const image = process === 'powershell.exe' ? 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe' : `C:/Program Files/Aonagi/${process}`;
  const bytes = observed.bytes ?? 512 + Number.parseInt(validationHash(id).slice(0, 4), 16);
  const port = observed.port ?? 443;
  return validationRow(id, at, host, '通信', 'endpoint-network', user,
    `DestinationHostname=${destination} DestinationPort=${port} Protocol=tcp ProcessGuid=${pg} ProcessId=${pid} Image="${image}" BytesSent=${bytes} LogonId=${session}`,
    { process, process_guid: pg, pid, session, destination, bytes, ...observed });
}
function authFixture(id, at, host, user, type) {
  const remote = [3, 10].includes(type);
  return validationRow(id, at, host, '認証', 'windows-security', user,
    `EventID=4624 TargetUserName=${user} TargetDomainName=AONAGI LogonType=${type} WorkstationName=${remote ? 'IT-ADM-01' : host} IpAddress=${remote ? '192.0.2.33' : '127.0.0.1'} TargetLogonId=0x${validationHash(id).slice(0, 8)} AuthenticationPackageName=Negotiate`);
}
function heldOut(id, rows, expected) {
  taskList.find(task => task.id === id).rubric.query.validation = { logs: rows, expected };
}
const c01ChildGuid = validationGuid('document-followup-finance');
const c01Session = '0xb8324f12';
heldOut('c01', [
  processFixture('validation-c01-child', '2026-09-16T13:27:41Z', 'FIN-WS-01', 'mori', 'powershell.exe', 'docview.exe', { process_guid: c01ChildGuid, pid: 8804, session: c01Session, script: 'C:/Users/mori/AppData/Temp/session.ps1' }),
  endpointFixture('validation-c01-egress', '2026-09-16T13:27:47Z', 'FIN-WS-01', 'mori', 'powershell.exe', 'session-api.example', { process_guid: c01ChildGuid, pid: 8804, session: c01Session }),
  processFixture('validation-c01-same-parent', '2026-09-15T10:31:12Z', 'DESIGN-WS-02', 'nishi', 'preview-renderer.exe', 'docview.exe', { signature: 'Valid', publisher: 'DocView' }),
  processFixture('validation-c01-same-child', '2026-09-15T14:12:32Z', 'FIN-WS-02', 'ikeda', 'powershell.exe', 'excel.exe', { process_guid: validationGuid('finance-rerun'), pid: 9912, script: 'C:/Finance/QuarterlyExport.ps1', signature: 'Valid', publisher: 'Aonagi-Finance' }),
  endpointFixture('validation-c01-browser-destination', '2026-09-15T13:19:03Z', 'DESIGN-WS-03', 'suga', 'browser.exe', 'session-api.example', { bytes: 4821 }),
  endpointFixture('validation-c01-other-destination', '2026-09-15T14:12:36Z', 'FIN-WS-02', 'ikeda', 'powershell.exe', 'erp.example', { process_guid: validationGuid('finance-rerun'), pid: 9912, bytes: 17304 }),
  processFixture('validation-c01-parent-start', '2026-09-16T13:27:37Z', 'FIN-WS-01', 'mori', 'docview.exe', 'explorer.exe', { process_guid: validationGuid('validation-c01-child-parent'), pid: 4092, parent_pid: 1800, session: c01Session }),
  ...['business-finance-export', 'business-docview-preview', 'business-partner-portal-test'].map(id => {
    const original = all.get(id);
    return validationRow(`validation-c01-${id}`, original.at, original.host, '業務', 'business-register', original.user, original.detail);
  })
], ['validation-c01-child', 'validation-c01-egress']);
heldOut('c02', [
  authFixture('validation-c02-file-rdp', '2026-09-16T18:36:41Z', 'FILE-SRV-01', 'ops-admin', 10),
  authFixture('validation-c02-idp-rdp', '2026-09-14T19:11:23Z', 'IDP-SRV-01', 'ops-admin', 10),
  authFixture('validation-c02-console', '2026-09-16T18:35:12Z', 'FILE-SRV-01', 'ops-admin', 2),
  authFixture('validation-c02-unlock', '2026-09-14T19:08:52Z', 'IT-ADM-01', 'ops-admin', 7),
  authFixture('validation-c02-other-account', '2026-09-16T18:37:08Z', 'FILE-SRV-01', 'storage-reader', 10),
  authFixture('validation-c02-other-account-idp', '2026-09-14T19:18:06Z', 'IDP-SRV-01', 'idp-admin', 10),
  authFixture('validation-c02-before-window', '2026-09-09T18:36:41Z', 'FILE-SRV-01', 'ops-admin', 10),
  authFixture('validation-c02-network-logon', '2026-09-15T09:01:18Z', 'FILE-SRV-01', 'ops-admin', 3),
  validationRow('validation-c02-storage-work', '2026-09-16T17:50:00Z', 'FILE-SRV-01', '業務', 'business-register', 'storage-owner', 'change=OPS-432 date=2026-09-16 window=18:30Z/19:00Z source=IT-ADM-01 target=FILE-SRV-01 account=storage-reader method=RDP allowed_action=read-status-dashboard'),
  validationRow('validation-c02-idp-work', '2026-09-14T18:30:00Z', 'IDP-SRV-01', '業務', 'business-register', 'identity-owner', 'change=OPS-433 date=2026-09-14 window=19:00Z/19:30Z source=IT-ADM-01 target=IDP-SRV-01 account=idp-admin method=RDP allowed_action=certificate-review')
], ['validation-c02-file-rdp', 'validation-c02-idp-rdp']);
const anotherHash = validationHash('quarantine-sample-q18');
const otherArchivedHash = validationHash('quarantine-sample-q21');
heldOut('c03', [
  validationRow('validation-c03-retained-file', '2026-09-16T07:18:21Z', 'FILE-SRV-01', 'ファイル', 'quarantine-store', 'sensor-service', `action=quarantine_sync storage=D:/Quarantine/Q17.enc original_sha256=${qHash} container=encrypted job=QUARANTINE-SYNC`, { hash: qHash }),
  validationRow('validation-c03-retained-design', '2026-09-16T07:18:26Z', 'DESIGN-WS-01', 'ファイル', 'quarantine-store', 'sensor-service', `action=quarantine_sync storage=C:/ProgramData/Sensor/Quarantine/Q17.enc original_sha256=${qHash} container=encrypted job=QUARANTINE-SYNC`, { hash: qHash }),
  processFixture('validation-c03-process-hash', '2026-09-16T11:24:38Z', 'FIN-WS-01', 'mori', 'report-helper.exe', 'explorer.exe', { hash: qHash }),
  validationRow('validation-c03-same-name', '2026-09-16T08:41:03Z', 'FILE-SRV-01', 'ファイル', 'quarantine-store', 'sensor-service', `action=quarantine_sync storage=D:/Quarantine/Q18.enc original_sha256=${anotherHash} container=encrypted job=QUARANTINE-SYNC`, { hash: anotherHash }),
  processFixture('validation-c03-other-process-hash', '2026-09-16T12:03:19Z', 'FIN-WS-01', 'mori', 'report-helper.exe', 'explorer.exe', { hash: validationHash('approved-report-helper-v3'), signature: 'Valid', publisher: 'Aonagi-Finance' }),
  validationRow('validation-c03-other-archive', '2026-09-16T09:27:44Z', 'DESIGN-WS-01', 'ファイル', 'quarantine-store', 'sensor-service', `action=quarantine_sync storage=C:/ProgramData/Sensor/Quarantine/Q21.enc original_sha256=${otherArchivedHash} container=encrypted job=QUARANTINE-SYNC`, { hash: otherArchivedHash }),
  validationRow('validation-c03-reference-only', '2026-09-16T06:12:31Z', 'IT-ADM-01', '業務', 'business-register', 'response-owner', `case=IR-218 reference_hash=${qHash} approved_action=retain-encrypted-sample locations=FILE-SRV-01,DESIGN-WS-01`),
  validationRow('validation-c03-retention-scope', '2026-09-14T07:33:00Z', 'FILE-SRV-01', '業務', 'business-register', 'response-owner', 'case=IR-226 retained_samples=Q18,Q21 approved_action=retain-encrypted-sample expiration=2026-09-30 owner=incident-response')
], ['validation-c03-retained-file', 'validation-c03-retained-design', 'validation-c03-process-hash']);
function shareFixture(id, at, source, session, path, user = 'partner-07') {
  const bytes = path === '/status' ? 146 : path === '/list' ? 2843 : 131072 + Number.parseInt(validationHash(id).slice(0, 5), 16);
  return source === '認証'
    ? validationRow(id, at, 'FILE-SRV-01', source, 'share-identity', user, `sensor=share-identity session=${session} account=${user} method=link-token result=success source_ip=198.51.100.71`, { session })
    : validationRow(id, at, 'FILE-SRV-01', source, 'share-gateway', user, `session=${session} request_id=REQ-${validationHash(id).slice(0, 12)} method=GET path=${path} status=200 response_bytes=${bytes}`, { session, request_id: `REQ-${validationHash(id).slice(0, 12)}`, destination: 'share-gateway.example', bytes });
}
heldOut('c04', [
  shareFixture('validation-c04-auth', '2026-09-15T16:21:09Z', '認証', 'SHARE-911'),
  shareFixture('validation-c04-download', '2026-09-15T16:21:17Z', '通信', 'SHARE-911', '/download'),
  shareFixture('validation-c04-list', '2026-09-15T16:21:13Z', '通信', 'SHARE-911', '/list'),
  shareFixture('validation-c04-status', '2026-09-15T16:22:31Z', '通信', 'SHARE-911', '/status'),
  shareFixture('validation-c04-other-auth', '2026-09-15T16:25:01Z', '認証', 'SHARE-912'),
  shareFixture('validation-c04-other-download', '2026-09-15T16:25:08Z', '通信', 'SHARE-912', '/download'),
  shareFixture('validation-c04-before-window', '2026-09-14T14:37:22Z', '通信', 'SHARE-908', '/download'),
  shareFixture('validation-c04-after-window', '2026-09-16T15:51:39Z', '認証', 'SHARE-921'),
  validationRow('validation-c04-portal-workflow', '2026-09-14T08:45:00Z', 'FILE-SRV-01', '業務', 'business-register', 'data-owner', 'service=partner-quarterly allowed_recipient=PARTNER-07 allowed_objects=public-summary.csv workflow=list-available-items,download-selected-item,status-check effective=2026-09-14/2026-09-16')
], ['validation-c04-auth', 'validation-c04-download']);
function flowFixture(id, at, host, destination, options = {}) {
  const index = environment.assets.findIndex(asset => asset.host === host);
  const tls = options.tls ?? true;
  const dstPort = options.dstPort ?? (tls ? 443 : 80);
  const srcPort = 49152 + Number.parseInt(validationHash(id).slice(0, 4), 16) % 16384;
  const sent = options.bytesSent ?? 384 + Number.parseInt(validationHash(id).slice(4, 8), 16);
  const received = options.bytesReceived ?? 120 + Number.parseInt(validationHash(id).slice(8, 12), 16);
  const dst = destination === 'monitor.example' ? '203.0.113.42' : '203.0.113.96';
  return validationRow(id, at, host, '通信', 'edge-flow', '', `flow_id=${validationHash(id).slice(0, 16)} src=192.0.2.${21 + index} dst=${dst} destination=${destination} src_port=${srcPort} dst_port=${dstPort} protocol=tcp tls=${tls} bytes_out=${sent} bytes_in=${received}`, { destination, bytes: sent + received });
}
heldOut('c05', [
  flowFixture('validation-c05-gap-flow', '2026-09-15T10:44:26Z', 'FIN-WS-03', 'relay-room.example', { bytesSent: 2614, bytesReceived: 7780 }),
  flowFixture('validation-c05-other-host', '2026-09-15T10:43:08Z', 'DEV-WS-01', 'relay-room.example', { dstPort: 8080, tls: false, bytesSent: 784, bytesReceived: 18823 }),
  flowFixture('validation-c05-other-destination', '2026-09-15T10:45:39Z', 'FIN-WS-03', 'monitor.example', { dstPort: 8443, bytesSent: 912, bytesReceived: 172 }),
  flowFixture('validation-c05-other-protocol', '2026-09-15T10:44:20Z', 'FIN-WS-03', 'relay-room.example', { tls: false, bytesSent: 434, bytesReceived: 298 }),
  endpointFixture('validation-c05-other-sensor', '2026-09-15T12:21:58Z', 'FIN-WS-03', 'abe', 'browser.exe', 'relay-room.example', { bytes: 5196 }),
  flowFixture('validation-c05-before-window', '2026-09-14T15:09:26Z', 'FIN-WS-03', 'relay-room.example', { bytesSent: 1433, bytesReceived: 28419 }),
  flowFixture('validation-c05-after-window', '2026-09-16T08:52:49Z', 'FIN-WS-03', 'relay-room.example', { tls: false, bytesSent: 319, bytesReceived: 247 }),
  validationRow('validation-c05-dev-proxy', '2026-09-15T08:00:00Z', 'DEV-WS-01', '業務', 'business-register', 'development-owner', 'change=DEV-284 date=2026-09-15 window=10:00Z/11:00Z host=DEV-WS-01 account=yui destination=relay-room.example port=8080 allowed_action=development-relay-connectivity-test'),
  validationRow('validation-c05-maintenance', '2026-09-14T17:21:00Z', 'FIN-WS-03', '業務', 'business-register', 'endpoint-owner', 'change=AGENT-316 date=2026-09-15 window=10:00Z/12:00Z host=FIN-WS-03 destination=monitor.example port=8443 allowed_action=maintenance-health-check')
], ['validation-c05-gap-flow', 'validation-c05-other-protocol']);

const findingOrder = { b02: ['report-scope', 'daily-baseline', 'parent-exception'], b03: ['spread-case', 'repo-approved', 'build-question'], c01: ['file-name', 'same-execution', 'same-tool'], c02: ['bounded-maintenance', 'off-hours-incident', 'account-exception'], c03: ['hash-execution', 'first-copy', 'retained-objects'], c04: ['response-volume', 'object-gap', 'token-recipient'], c05: ['nearest-process', 'alternate-endpoint', 'daily-update'] };
for (const task of taskList) if (findingOrder[task.id]) task.findings.sort((a, b) => findingOrder[task.id].indexOf(a.id) - findingOrder[task.id].indexOf(b.id));

const origins = { a01: '資産棚卸', a02: 'データ能力の確認', a03: '収集期間の確認', a04: '代替記録の計画', b01: '正常像の作成', b02: '稀な親子関係', b03: '初出宛先の比較', c01: '脅威レポート', c02: 'ATT&CK手法 T1021.001', c03: '過去インシデント', c04: '重要資産', c05: '検知ルールの抜け' };
for (const task of taskList) task.origin = origins[task.id];
taskList.find(task => task.id === 'b01').initialFilters = { period: 'baseline' };

module.exports = taskList;
