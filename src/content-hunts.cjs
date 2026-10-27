'use strict';

// Authoring helpers only. The build embeds the returned plain data in the offline HTML.
const periods = {
  baseline: { from: '2026-09-07', to: '2026-09-09' },
  current: { from: '2026-09-14', to: '2026-09-16' }
};
const dates = { baseline: ['07', '08', '09'], current: ['14', '15', '16'] };
const descriptions = {
  '通信': '宛先、時刻、通信量を記録した合成ログ。通信内容や実際の操作者までは分かりません。',
  '認証': 'アカウント、接続先、認証方式、結果の合成ログ。成功だけでは本人操作や正当性を証明しません。',
  '端末': 'プロセスやタスクの合成イベント。収集対象と取得できる項目は収集資料も確認してください。',
  '業務': '資産の役割、作業計画、申請、実行記録。承認された範囲とログの実績を照合します。',
  '収集': '収集対象、期間、欠落、取得項目の資料。イベントがない理由を判断するために使います。',
  'ファイル': 'ファイルの読み取りや出力の記録。通信ログと同じ単位・対象か照合する必要があります。'
};
const sources = names => names.map(name => ({ name, description: descriptions[name] }));
function structuredFields(detail) {
  const fields = {};
  for (const key of ['process_guid', 'parent_process_guid', 'request_id', 'session', 'session_id', 'pid', 'parent_pid', 'sensor', 'channel']) {
    const match = detail.match(new RegExp(`(?:^|\\s)${key}=([^\\s。、]+)`));
    if (match && match[1] !== 'interactive') fields[key] = match[1];
  }
  if (fields.session_id) fields.session = fields.session_id;
  return fields;
}
const observedTimes = {
  'p02-e01':'02:10:19','p02-e03':'02:10:24','p02-e04':'02:20:43','p02-r01':'03:55:39',
  'p04-e01':'08:40:13','p04-e02':'08:45:29','p04-e03':'08:31:17','p04-e04':'08:31:19','p04-r01':'04:17:31','p04-r02':'04:12:14',
  'p05-e01':'18:10:17','p05-e02':'18:12:41','p05-e03':'11:00:23','p05-e04':'18:13:08',
  'p05-r01':'18:10:34','p05-r02':'18:12:19','p05-r03':'11:00:41',
  'f03-e01':'19:20:26','f03-e02':'19:22:43','f03-e03':'09:00:14','f03-e04':'09:01:37','f03-e05':'09:00:17',
  'f03-e06':'06:03:21','f03-e07':'06:03:34','f03-r01':'06:03:23','f03-r02':'06:10:42'
};
const log = (id, period, day, time, source, host, user, event, detail, extra = {}) => ({
  id, at: `2026-09-${day}T${observedTimes[id] || time}Z`, period, source, host, user, event, detail,
  ...structuredFields(detail), ...extra
});

// Each host has a stable role and repeats its role's workflow on three days.
// 3 hosts × 3 days × 3/4 operations = 27/36 meaningful background rows per period.
function jitter(seed, span) { let n=2166136261; for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)%span; }
function timePlus(time, seconds) { return new Date(Date.parse(`2026-09-15T${time}Z`)+seconds*1000).toISOString().slice(11,19); }
function observedStep(time, host, day, step) { return timePlus(time,2+jitter(`${host}-${day}-${step}`,53)); }
function scheduledRun(host, day) {
  const start=timePlus('04:00:00',3+jitter(`${host}-${day}-dispatch`,45));
  let duration=270+jitter(`${host}-${day}-duration`,95);
  if(timePlus(start,duration).endsWith(':00'))duration++;
  const end=timePlus(start,duration);
  return {start,end,receipt:timePlus(end,23),duration};
}
function routine(id, profiles, templates) {
  const out = [];
  for (const period of ['baseline', 'current']) {
    dates[period].forEach((day, dayIndex) => {
      profiles.forEach((profile, hostIndex) => {
        templates.forEach((template, templateIndex) => {
          const row = template({ ...profile, period, day, dayIndex, hostIndex });
          const unscheduled=['p01','p03','p06','f01','f02'].includes(id) && !['業務','収集'].includes(row.source) && row.extra?.process!=='updater.exe';
          if(unscheduled)row.time=new Date(Date.parse(`2026-09-${day}T${row.time}Z`)+(jitter(`${profile.host}-${day}`,1801)-900)*1000).toISOString().slice(11,19);
          out.push(log(`${id}-n-${period === 'baseline' ? 'b' : 'c'}${out.length + 1}`, period, day,
            row.time, row.source, profile.host, row.user ?? profile.user, row.event, row.detail, row.extra));
        });
      });
    });
  }
  return out;
}
const officeProfiles = () => [
  { host: 'SALES-WS-01', user: 'aoki', role: '営業' },
  { host: 'FIN-WS-01', user: 'mori', role: '経理' },
  { host: 'DESIGN-WS-01', user: 'kudo', role: '設計' }
];
const officeTemplates = [
  ({ user, role, host, day }) => ({ time: '08:50:00', source: '認証', event: '対話型認証を記録', detail: `account=${user} method=端末証明書 result=success department=${role} session_id=LOGIN-${host}-${day}` }),
  ({ host, day }) => ({ time: '09:00:00', source: '端末', event: 'プロセスの開始を記録', detail: `path="C:/Program Files/Browser/browser.exe" signature=valid session_id=LOGIN-${host}-${day} process_guid=BROWSER-${host}-${day} pid=4200 parent_pid=1800`, extra: { process: 'browser.exe', parent: 'explorer.exe' } }),
  ({ host, day }) => ({ time: '09:01:00', source: '通信', event: 'HTTPS要求を記録', detail: `method=GET path=/team/handbook status=200 category=社内資料 process_guid=BROWSER-${host}-${day} pid=4200 session_id=LOGIN-${host}-${day} request_id=DOC-${host}-${day}`, extra: { destination: 'docs.example', process: 'browser.exe', bytes: 24576 } }),
  ({ host, day }) => ({ time: '12:00:00', source: '通信', user: 'svc-update', event: '更新確認を記録', detail: `sensor=update-client method=GET path=/catalog.json status=200 job=UPDATE-DAILY process_guid=UPDATE-${host}-${day} request_id=UPDATE-${host}-${day}`, extra: { destination: 'updates.example', process: 'updater.exe', bytes: 4096 } })
];
const group = (label, role, ...anyOf) => ({ label, role, anyOf });

const p01 = {
  id: 'p01', level: 'practice', title: '間隔をそろえる通信', subtitle: '時刻・宛先・プロセスをつなぐ', minutes: '12–18', focus: '周期と実行元の照合',
  brief: '定期通信は更新処理でも起こります。前週と比べて増えた宛先を探し、通信を発生させたプロセスまで調べてください。',
  context: '営業・経理・設計の3端末を同じ3日間ずつ比較します。端末ごとの日次更新は12:00 UTCです。調査したいのは、既存の更新処理では説明できない定期通信があるかどうかです。', periods,
  hypotheses: [
    {
        "id": "mirror-retry",
        "label": "更新プログラムのミラー切替と再試行が、新しい宛先への短い通信間隔を生んでいる。"
    },
    {
        "id": "app-polling",
        "label": "通常更新とは別に起動したプログラムが、新しい宛先へ短い間隔で通信している。"
    },
    {
        "id": "user-refresh",
        "label": "ブラウザーの自動更新が、利用者のセッションごとに同じ宛先へ通信している。"
    }
],
  sources: sources(['通信', '端末', '認証', '業務']),
  guide: [
    { title: '仮説と比較条件を決める', body: '仮説を選び、通信と端末の記録を使う計画を立てます。対象週は9月14〜16日、比較週は9月7〜9日です。', tab: 'plan' },
    { title: '宛先を集計して前週と比べる', body: '通信に絞り、宛先別の件数を集計します。比較画面でも通信を指定し、新しく現れた宛先を確認しましょう。件数だけで結論を出しません。', tab: 'aggregate' },
    { title: '通信間隔と実行元を確かめる', body: '候補の宛先で検索し、時系列へ進みます。端末から関連記録へピボットし、プロセス名、親、開始時刻を照合してください。', tab: 'timeline' },
    { title: '独立した証拠を選ぶ', body: '間隔を示す二つの時刻、プロセス開始、業務資料の範囲を残します。観測した挙動と、その目的について未確認なことを分けて報告します。', tab: 'report' }
  ],
  hints: [
    '前週にもある定期更新と、対象週にだけ現れる宛先を分けて考えましょう。',
    '通信ソースで宛先を比較し、対象週だけの宛先を検索します。その端末の端末ログへピボットしてください。',
    '新しい宛先には、更新ミラーという説明がある候補もあります。短い間隔の通信を実行GUIDで起動元へ対応させ、各候補の端末・プログラムを業務条件と比べます。'
  ],
  logs: [
    ...routine('p01', officeProfiles(), officeTemplates),
    log('p01-e01', 'current', '15', '09:59:40', '端末', 'FIN-WS-01', 'mori', 'プロセスの開始を記録', 'path=C:/Users/mori/AppData/Local/SyncAgent/sync-agent.exe signature=unsigned parent_path=C:/Users/mori/Downloads/viewer.exe process_guid=P1-P41 parent_process_guid=P1-P40 pid=6412 parent_pid=6336 session_id=LOGIN-FIN-WS-01-15', { process: 'sync-agent.exe', parent: 'viewer.exe' }),
    ...['10:00:00', '10:00:58', '10:02:01', '10:03:00', '10:04:01'].map((time, n) => log(`p01-e${String(n + 2).padStart(2, '0')}`, 'current', '15', time, '通信', 'FIN-WS-01', 'mori', 'HTTPS要求を記録', `method=POST path=/check request_id=P1-${n + 1} status=200 bytes_out=512 process_guid=P1-P41 pid=6412 session_id=LOGIN-FIN-WS-01-15`, { destination: 'sync-node.example', process: 'sync-agent.exe', bytes: 512 })),
    log('p01-e07', 'current', '14', '08:00:00', '業務', 'FIN-WS-01', 'it-ops', '対象週の実施予定を記録', 'plan=UPDATE-DAILY targets=SALES-WS-01,FIN-WS-01,DESIGN-WS-01 account=svc-update program=updater.exe destination=updates.example start_utc=12:00 valid_from=2026-09-14 valid_to=2026-09-16 action=catalog-read status=approved')
  ],
  findings: [
    {
        "id": "update-exception",
        "label": "新しい同期先を更新ミラーの変更票にまとめ、配布対象と通信失敗の再試行を追加確認する。"
    },
    {
        "id": "browser-session",
        "label": "利用者のセッションごとに通信を並べ、ブラウザーの再読み込み設定とページの取得元を確認する。"
    },
    {
        "id": "trace-origin",
        "label": "同期プログラムの起動と通信をまとめ、親のファイル・取得経路・送信内容を追加確認する。"
    }
],
  rubric: { hypotheses: ['app-polling'], targets: ['FIN-WS-01'], verdict: 'supported', sources: ['通信', '端末', '業務'], scope: true, finding: 'trace-origin',
    evidenceGroups: [group('通信の始点', 'support', 'p01-e02'), group('同じ宛先への後続通信', 'support', 'p01-e06'), group('実行元の起動', 'support', 'p01-e01'), group('承認された更新処理の範囲', 'context', 'p01-e07')],
    operations: ['search', 'aggregate', 'compare', 'pivot'] },
  legacy: {
    "hypothesis": {
        "h1": "app-polling",
        "h2": "",
        "h3": ""
    },
    "finding": {
        "next": "trace-origin",
        "stop": "",
        "all": ""
    },
    "targets": {
        "WS-P1-01": "SALES-WS-01",
        "WS-P1-02": "FIN-WS-01",
        "WS-P1-03": "DESIGN-WS-01"
    }
},
  explanation: {
    summary: '既存の更新とは別の新規プロセスによる定期通信という仮説を、今回の記録は支持します。通信の目的や侵害全体の確定は別の確認が必要です。',
    reasoning: ['両期間の通常更新は全3端末で同じ12:00のパターンです。対象週の更新ミラー切替はPATCH-919で説明できますが、別の sync-node.example を分けて比較できます。', 'FIN-WS-01 の10:00:00〜10:04:01の通信間隔は58、63、59、61秒です。端末ログの sync-agent.exe と通信ログの実行元が一致します。', '起動元はダウンロード領域の viewer.exe で、申請台帳が示す updater.exe の配布とは異なります。署名がないことや周期だけを根拠に目的まで断定しません。', 'この教材の通信は合成サンプルです。5件の周期が、その前後にも永続していたことまでは証明しません。'],
    next: '実行ファイルの来歴、署名・ハッシュ、取得経路、通信内容、同じ特徴の他端末での有無を確認する計画を残します。',
    sampleReport: '9月14〜16日を対象に通信・端末・業務資料を照合した。FIN-WS-01 では9月15日10:00:00〜10:04:01に sync-node.example への通信が58〜63秒間隔で5件あり、09:59に起動した sync-agent.exe と一致する。承認済みの updater.exe / updates.example とは異なるため仮説を支持する。通信目的と取得経路は未確認であり、担当チームへファイル調査と追加の通信確認を引き継ぐ。'
  }
};

const identityProfiles = [
  { host: 'REPORT-SRV-01', user: 'svc-report', role: '定例集計' },
  { host: 'BACKUP-SRV-01', user: 'svc-backup', role: 'バックアップ' },
  { host: 'BUILD-SRV-01', user: 'svc-build', role: 'ビルド' }
];
const identityTemplates = [
  ({ role,host,day }) => ({ time: observedStep(role === 'バックアップ' ? '03:55:00' : '01:00:00',host,day,'certificate'), source: '認証', event: '証明書認証を記録', detail: `method=certificate result=success workload=${role} interactive=false` }),
  ({ role,host,day }) => ({ time: role === 'バックアップ' ? scheduledRun(host,day).start : observedStep('01:01:00',host,day,'job'), source: '業務', event: '日次ジョブを開始', detail: `job=${role === 'バックアップ' ? 'Daily-バックアップ' : role} schedule=daily scheduled_start_utc=${role === 'バックアップ' ? '04:00:00' : '01:01:00'} destination=vault.example request_id=DAILY-${role}-${day}` }),
  ({ role,host,day }) => ({ time: observedStep(role === 'バックアップ' ? '04:10:00' : '01:10:00',host,day,'token'), source: '認証', event: 'トークン更新を記録', detail: `method=certificate result=success workload=${role} interactive=false` })
];
const p02 = {
  id: 'p02', level: 'practice', title: 'アカウントの接続先が増えた週', subtitle: '認証の変化と承認範囲を比べる', minutes: '12–18', focus: '業務仮説との照合',
  brief: 'サービスアカウントの新しい利用先が、予定された移行の範囲を超えていないか検証します。認証方式・時間・作業範囲を照合してください。',
  context: 'svc-report は定例集計、svc-backup はバックアップ、svc-build はビルド専用です。新しい接続先を見つけても、アカウント名や認証成功だけで正当性を決めないようにします。', periods,
  hypotheses: [
    {
        "id": "migration-boundary",
        "label": "svc-report の新しい利用先が、予定された移行の端末・時間・認証方式を超えている。"
    },
    {
        "id": "credential-retries",
        "label": "svc-report の新しい利用先で、証明書更新に伴う認証の失敗と再試行が増えている。"
    },
    {
        "id": "interactive-switch",
        "label": "svc-report の新しい利用先で、定例ジョブの認証から利用者の対話型認証に変わっている。"
    }
], sources: sources(['認証', '業務', '収集']),
  guide: [
    { title: 'アカウントごとの対象を調べる', body: '認証を対象に、ユーザー別に集計します。svc-report で検索し、前週と対象週のホストを比較してください。', tab: 'aggregate' },
    { title: '新しい接続先を照合する', body: 'REPORT-SRV-02 にピボットして、認証方式・アカウント・実行時刻が申請書の範囲に入るか確認します。', tab: 'timeline' },
    { title: '仮説を保ち、結論を更新する', body: '調べた仮説は記録に残します。懸念の起点と、その懸念を説明する反証を選び、確認できた範囲の結論を提出してください。', tab: 'report' }
  ],
  hints: ['接続先の増加を示す認証と、実施予定の二つを別々に読みましょう。', 'user:svc-report で検索し、ホスト別の比較とREPORT-SRV-02へのピボットを使います。', '新しい利用先の認証と、申請された対象・時間・方式を照合します。予定があるだけで判断せず、対応するジョブの開始や終了も確認してください。'],
  logs: [
    ...routine('p02', identityProfiles, identityTemplates),
    log('p02-e01', 'current', '15', '02:10:00', '認証', 'REPORT-SRV-02', 'svc-report', '証明書認証を記録', 'method=certificate result=success interactive=false client=report-batch request_id=RUN-214 cert_id=CERT-REPORT-2'),
    log('p02-e02', 'current', '14', '16:00:00', '業務', 'REPORT-SRV-02', 'ops-lead', '移行作業申請を記録', 'change=MIG-214 status=approved target=REPORT-SRV-02 account=svc-report window_utc=2026-09-15T02:00/03:00 program=report-batch authentication=certificate certificate=CERT-REPORT-2 action=test-aggregate input=sample-ledger output=report-test.example expected_rows=200'),
    log('p02-e03', 'current', '15', '02:10:05', '業務', 'REPORT-SRV-02', 'svc-report', '集計ジョブを開始', 'job=report-batch run_id=RUN-214 change=MIG-214 input=sample-ledger output=report-test.example rows=200 mode=test'),
    log('p02-e04', 'current', '15', '02:20:00', '業務', 'REPORT-SRV-02', 'svc-report', '集計ジョブを終了', 'job=report-batch run_id=RUN-214 status=completed rows=200 subsequent_runs=0'),
    log('p02-e05', 'current', '16', '23:50:00', '収集', 'REPORT-SRV-02', 'collector', '教材の認証収集範囲を記録', '対象=REPORT-SRV-01,REPORT-SRV-02,BACKUP-SRV-01,BUILD-SRV-01。対象週の教材内認証イベントを収録。実環境全体の完全な監査や認証後の全操作を表すものではない。')
  ], findings: [
    {
        "id": "limit-run",
        "label": "承認と一致した実行条件を移行記録に残し、期間終了後や別方式の利用は新しい条件で確認する。"
    },
    {
        "id": "renew-cert",
        "label": "変化を証明書更新の再試行としてまとめ、認証失敗と更新後の最初の成功をそれぞれ調べる。"
    },
    {
        "id": "extend-window",
        "label": "移行前後の利用を期間別に記録し、同じアカウントの新規端末も今回の承認条件へ追加して確認する。"
    }
],
  rubric: { hypotheses: ['migration-boundary'], targets: ['REPORT-SRV-02'], verdict: 'benign', sources: ['認証', '業務'], scope: true, finding: 'limit-run',
    evidenceGroups: [group('新しい利用先の認証', 'support', 'p02-e01'), group('事前に承認された範囲', 'counter', 'p02-e02'), group('承認と一致する実行', 'counter', 'p02-e03', 'p02-e04')], operations: ['search', 'aggregate', 'compare', 'pivot'] },
  legacy: {
    "hypothesis": {
        "h1": "migration-boundary",
        "h2": "",
        "h3": ""
    },
    "finding": {
        "next": "limit-run",
        "stop": "",
        "all": ""
    },
    "targets": {
        "REPORT-01": "REPORT-SRV-01",
        "REPORT-02": "REPORT-SRV-02",
        "BACKUP-01": "BACKUP-SRV-01",
        "BUILD-01": "BUILD-SRV-01"
    }
},
  explanation: {
    summary: '今回の新しい利用先は、移行作業の承認と実行記録で説明できます。調査対象のRUN-214については正当な業務と判断します。',
    reasoning: ['REPORT-SRV-02 は前週の接続先にありません。この変化を確認してから業務資料へ進むため、最初から例外扱いしません。', 'アカウント、接続先、02:10:19 UTCという時刻、証明書ID、ジョブ名がMIG-214の承認範囲と一致します。', '認証とジョブは共通のRUN-214で結び付けられます。単に担当者が「予定どおり」と答えたことだけを根拠にしていません。', '「承認外の利用」という調査仮説を選んだまま、証拠を踏まえて結論を良性へ更新して構いません。'],
    next: '移行期間終了後の利用、別端末への認証、対話型ログインを別条件として追跡します。',
    sampleReport: '対象期間9月14〜16日、svc-report の認証を前週と比較した。REPORT-SRV-02 の9月15日02:10:19 UTCの利用は新規だが、MIG-214の対象端末、時間、アカウント、証明書、ジョブと一致し、RUN-214の実行記録でも確認できた。この実行は正当な業務と判断する。承認期間外や別の認証方式まで安全と扱わず、移行終了後の利用を別条件で確認する。'
  }
};

const toolProfiles = [
  { host: 'IT-ADM-01', user: 'ops-admin', role: '管理端末' },
  { host: 'SALES-WS-01', user: 'aoki', role: '営業端末' },
  { host: 'DESIGN-WS-01', user: 'kudo', role: '設計端末' }
];
const toolTemplates = [
  ({ user }) => ({ time: '08:30:00', source: '認証', event: '端末認証を記録', detail: `account=${user} method=certificate result=success` }),
  args => args.role === '管理端末' ? ({ time: '09:00:00', source: '端末', event: 'プロセスの開始を記録', detail: `path="C:/Program Files/AdminKit/adminctl.exe" signature=valid command=inventory target=server-fleet process_guid=ADMIN-${args.host}-${args.day} session_id=OPS-${args.host}-${args.day}`, extra: { process: 'adminctl.exe', parent: 'explorer.exe' } }) : officeTemplates[1](args),
  ({ role }) => ({ time: '09:10:00', source: '端末', event: 'プロセスの終了を記録', detail: role === '管理端末' ? 'command=inventory exit=0 target_count=12' : 'command=open-portal exit=0', extra: { process: role === '管理端末' ? 'adminctl.exe' : 'browser.exe', parent: 'explorer.exe' } })
];
const p03 = {
  id: 'p03', level: 'practice', title: '管理ツールの利用場所', subtitle: '珍しさを母集団と比べる', minutes: '12–18', focus: '裏付けのない仮説を残す',
  brief: '管理ツールの名前が検索結果に現れます。管理端末以外へ利用が広がっているか、同じ条件で前週と対象週を比較してください。',
  context: '対象はIT-ADM-01、SALES-WS-01、DESIGN-WS-01です。起動と終了は別イベントなので、ツールの利用回数を数える場合はイベント種別にも注意します。ここでは新しい利用端末の有無を検証します。', periods,
  hypotheses: [
    {
        "id": "parent-change",
        "label": "adminctl.exe の起動元が、管理シェルからブラウザーの子プロセスへ変わっている。"
    },
    {
        "id": "account-change",
        "label": "adminctl.exe の実行アカウントが、管理者から一般利用者へ切り替わっている。"
    },
    {
        "id": "host-expansion",
        "label": "adminctl.exe の実行場所が、管理端末から営業・設計の端末へ広がっている。"
    }
], sources: sources(['端末', '認証', '業務', '収集']),
  guide: [
    { title: '比較する単位を決める', body: 'adminctl.exe を検索し、ホストで集計してください。起動と終了の2行を2回の実行と数えないようにします。', tab: 'aggregate' },
    { title: '仮説を検証する', body: '前週と対象週のホストを比べ、資産の役割と収集対象も照合します。「支持されない」と「環境全体が安全」は別の判断です。', tab: 'compare' }
  ],
  hints: ['ツール名の珍しさではなく、仮説に含まれる「管理端末以外」を確認します。', 'process:adminctl.exe で検索し、ホストごとの結果を調べます。比較画面はソース=端末、項目=ホストでも確認できます。', '利用場所の差と、調査した母集団を照合します。該当しない端末も必要なプロセス記録の収集対象だったか確認し、結論をその範囲に限定してください。'],
  logs: [
    ...routine('p03', toolProfiles, toolTemplates),
    log('p03-e01', 'baseline', '08', '13:00:00', '端末', 'IT-ADM-01', 'ops-admin', 'プロセスの開始を記録', 'path=C:/Program Files/AdminKit/adminctl.exe signature=valid command=inventory target=server-fleet session=OPS-81', { process: 'adminctl.exe', parent: 'explorer.exe' }),
    log('p03-e02', 'current', '15', '13:00:00', '端末', 'IT-ADM-01', 'ops-admin', 'プロセスの開始を記録', 'path=C:/Program Files/AdminKit/adminctl.exe signature=valid command=inventory target=server-fleet session=OPS-95', { process: 'adminctl.exe', parent: 'explorer.exe' }),
    log('p03-e03', 'current', '14', '07:00:00', '業務', 'IT-ADM-01', 'asset-owner', '資産の役割を記録', 'IT-ADM-01=管理作業用。SALES-WS-01=営業、DESIGN-WS-01=設計。調査母集団はこの3台。台帳の管理者=asset-owner。'),
    log('p03-e04', 'current', '16', '23:50:00', '収集', 'IT-ADM-01', 'collector', '教材の収集範囲を記録', '9月7〜9日と14〜16日の3台について、教材で発生させたプロセス開始・終了を同じ条件で収録。対象期間中の欠落はない。ネットワーク上の実行やファイルレス操作を網羅するデータではない。')
  ], findings: [
    {
        "id": "parent-followup",
        "label": "今回の実行をブラウザー経由の候補としてまとめ、取得ファイルとプロセスの親を追跡する。"
    },
    {
        "id": "retain-scope",
        "label": "母集団・期間・検索条件と該当場所を記録し、管理端末外の実行を示す新しい記録で再開する。"
    },
    {
        "id": "account-followup",
        "label": "利用者ごとの実行を分け、一般利用者が管理ツールを起動したセッションを追加の調査起点にする。"
    }
],
  rubric: { hypotheses: ['host-expansion'], targets: ['IT-ADM-01'], verdict: 'unsubstantiated', sources: ['端末', '業務', '収集'], scope: true, finding: 'retain-scope',
    evidenceGroups: [group('前週の利用場所', 'counter', 'p03-e01'), group('対象週も同じ利用場所', 'counter', 'p03-e02'), group('母集団と端末の役割', 'context', 'p03-e03'), group('比較可能な収集範囲', 'context', 'p03-e04')], operations: ['search', 'aggregate', 'compare'] },
  legacy: {
    "hypothesis": {
        "h1": "host-expansion",
        "h2": "",
        "h3": ""
    },
    "finding": {
        "next": "retain-scope",
        "stop": "",
        "all": ""
    },
    "targets": {
        "MGMT-01": "IT-ADM-01",
        "SALES-01": "SALES-WS-01",
        "DESIGN-01": "DESIGN-WS-01"
    }
},
  explanation: {
    summary: '管理端末以外への広がりを示す証拠はありません。この仮説は今回の対象・期間・記録では裏付けられません。',
    reasoning: ['adminctl.exeの実行元は両週ともIT-ADM-01です。一般利用端末のブラウザーなども記録されており、母集団に一般端末が含まれていない検索との取り違えではありません。', '前週・対象週を同じ日数、同じ収集条件で比較できます。管理端末の役割資料は、利用場所の解釈を助けます。', 'この記録だけで全実行の正当性を証明してはいません。そのため個別作業の承認が揃った「正当な業務」とは区別して、検証した仮説の裏付けなしとします。', 'ヒットしたツール名を理由に侵害と断定することも、仮説が支持されないことから環境全体が安全と断定することも避けます。'],
    next: '仮説・検索条件・期間・対象を残し、別の不審な親子関係や認証後の操作など、新しい根拠がある仮説を優先します。',
    sampleReport: '9月14〜16日のadminctl.exe利用を9月7〜9日と比較した。対象3台の同条件のプロセス記録では、両週ともIT-ADM-01だけで利用され、一般端末への広がりは裏付けられなかった。IT-ADM-01は管理作業用だが、この情報だけで全操作の正当性を確定したわけではない。今回の探索条件と限界を保存し、別の行動仮説へ進む。'
  }
};

const taskProfiles = [
  { host: 'UPDATE-SRV-01', user: 'svc-update', role: '更新' },
  { host: 'BACKUP-SRV-01', user: 'svc-backup', role: 'バックアップ' },
  { host: 'MONITOR-SRV-01', user: 'svc-health', role: '状態確認' }
];
const taskTemplates = [
  ({ user,role,host,day }) => ({ time: scheduledRun(host,day).start, source: '端末', event: '登録済みタスクを開始', detail: `task=Daily-${role} account=${user} definition=C:/Program Files/Operations/job.exe trigger=daily scheduled_start_utc=04:00:00 request_id=DAILY-${role}-${day} process_guid=JOB-${role}-${day}`, extra: { process:'job.exe',parent:'taskeng.exe' } }),
  ({ role,host,day }) => ({ time: scheduledRun(host,day).end, source: '端末', event: 'タスクの終了を記録', detail: `task=Daily-${role} exit=0 elapsed_seconds=${scheduledRun(host,day).duration} process_guid=JOB-${role}-${day} request_id=DAILY-${role}-${day}`, extra:{process:'job.exe',parent:'taskeng.exe'} }),
  ({ role,host,day }) => ({ time: scheduledRun(host,day).receipt, source:'業務',event:'日次実行票を記録',detail:`job=Daily-${role} scheduled_start_utc=04:00:00 actual_start_utc=${scheduledRun(host,day).start} completion_utc=${scheduledRun(host,day).end} owner=operations approved_path=C:/Program Files/Operations/job.exe` })
];
const p04 = {
  id: 'p04', level: 'practice', title: '登録されたタスクのその後', subtitle: '定義と実際の起動をつなぐ', minutes: '15–20', focus: '実行の連鎖を確認',
  brief: 'タスク登録の記録から、繰り返し実行につながる変更を調べます。登録しただけのものと、実際に動いたものを区別してください。',
  context: '3台には毎日04:00 UTCを予定時刻とする運用タスクがあります。記録される実際の開始には数秒の遅れがあり、終了までの時間も実行ごとに異なります。対象週の登録・起動・通信を確認し、前週からの変化と業務上の範囲を自分で照合します。', periods,
  hypotheses: [
    {
        "id": "registration-only",
        "label": "登録されたタスクは実行条件に合わず、対象期間には実行されていない。"
    },
    {
        "id": "logon-execution",
        "label": "登録された別のタスク定義が、利用者のログオン後に繰り返し実行されている。"
    },
    {
        "id": "backup-retry",
        "label": "登録されたタスクの動きは、日次バックアップの失敗後の再実行で説明できる。"
    }
], sources: sources(['端末', '通信', '業務']),
  guide: [
    { title: '必要な証拠を組み立てる', body: '登録内容、実行記録、業務上の範囲を別々に確認する計画を立ててください。', tab: 'plan' },
    { title: '仮説と限界を提出する', body: '対象端末とタスク定義を絞り、登録から後続動作へピボットします。名前の印象ではなく、実行のつながりを根拠にします。', tab: 'report' }
  ],
  hints: ['既存タスクと新規タスクで、実行パスとトリガーがどう違うか調べます。', '端末ソースを比較して候補ホストを探し、UserSyncTask で検索します。同じプロセスと親を時系列で照合してください。', '定義を見つけたら、別の日にも同じ定義・実行先で起動した記録があるか探します。臨時の受領票確認と、利用者ログオンを契機にした起動を比べてください。'],
  logs: [
    ...routine('p04', taskProfiles, taskTemplates),
    log('p04-e01', 'current', '15', '08:40:00', '端末', 'BACKUP-SRV-01', 'operator-2', 'タスク定義を登録', 'task=UserSyncTask trigger=user-logon action=C:/Users/Public/Sync/user-sync.exe run_as=operator-2 definition_id=TASK-442', { process: 'taskconfig.exe', parent: 'cmd.exe' }),
    log('p04-e02', 'current', '15', '08:45:00', '端末', 'BACKUP-SRV-01', 'operator-2', 'タスクからプロセスを開始', 'task=UserSyncTask definition_id=TASK-442 path=C:/Users/Public/Sync/user-sync.exe trigger=user-logon process_guid=UP-151', { process: 'user-sync.exe', parent: 'taskeng.exe' }),
    log('p04-e03', 'current', '16', '08:31:00', '端末', 'BACKUP-SRV-01', 'operator-2', 'タスクからプロセスを開始', 'task=UserSyncTask definition_id=TASK-442 path=C:/Users/Public/Sync/user-sync.exe trigger=user-logon process_guid=UP-161', { process: 'user-sync.exe', parent: 'taskeng.exe' }),
    log('p04-e04', 'current', '16', '08:31:02', '通信', 'BACKUP-SRV-01', 'operator-2', 'HTTPS要求を記録', 'process_guid=UP-161 method=POST path=/session status=200', { destination: 'user-sync.example', process: 'user-sync.exe', bytes: 768 }),
    log('p04-e05', 'current', '14', '07:30:00', '業務', 'BACKUP-SRV-01', 'ops-lead', '対象週の運用定義を記録', 'plan=BACKUP-DAILY status=approved target=BACKUP-SRV-01 task=Daily-バックアップ trigger=daily start_utc=04:00 account=svc-backup program="C:/Program Files/Operations/job.exe" valid_from=2026-09-14 valid_to=2026-09-16 action=backup')
  ], findings: [
    {
        "id": "trace-registration",
        "label": "定義の登録と2回の起動をまとめ、登録元セッションと実行先ファイルの来歴を担当へ引き継ぐ。"
    },
    {
        "id": "wait-execution",
        "label": "登録後の実行は未確認としてまとめ、次回ログオン時のプロセス取得を担当へ引き継ぐ。"
    },
    {
        "id": "merge-backup",
        "label": "タスクを日次処理と受領確認に分け、新しい定義は受領確認の再実行票に対応させて引き継ぐ。"
    }
],
  rubric: { hypotheses: ['logon-execution'], targets: ['BACKUP-SRV-01'], verdict: 'supported', sources: ['端末', '業務'], scope: true, finding: 'trace-registration',
    evidenceGroups: [group('新しい実行定義', 'support', 'p04-e01'), group('登録後の起動', 'support', 'p04-e02'), group('翌日の再起動', 'support', 'p04-e03'), group('既存の運用範囲', 'context', 'p04-e05')], operations: ['search', 'compare', 'pivot'] },
  legacy: {
    "hypothesis": {
        "h1": "logon-execution",
        "h2": "",
        "h3": ""
    },
    "finding": {
        "next": "trace-registration",
        "stop": "",
        "all": ""
    },
    "targets": {
        "OPS-P4-01": "UPDATE-SRV-01",
        "OPS-P4-02": "BACKUP-SRV-01",
        "OPS-P4-03": "MONITOR-SRV-01"
    }
},
  explanation: {
    summary: 'TASK-442の登録から2回のログオン時起動まで確認でき、既存運用とは別の繰り返し実行という仮説が支持されます。',
    reasoning: ['UserSyncTaskという名前だけを根拠にしていません。定義ID、パス、トリガー、後続プロセスが一致します。', '9月15日の登録後に同日と翌日の実行があり、「登録のみで未実行」という代替説明は合いません。', '既存の承認は04:00のDaily-バックアップ、svc-backup、Program Files内のjob.exeです。今回のユーザーログオン起動とは異なります。', '通信ログは追加の調査先を示しますが、内容やファイルの目的はまだ確認していません。タスクの存在だけで作成者の意図までは確定しません。'],
    next: '登録元セッション、実行ファイルの取得経路、同じ定義・パスの他端末での有無を確認します。実環境なら対処権限と業務影響を確認して担当チームへ渡します。',
    sampleReport: '9月14〜16日の端末記録を比較し、BACKUP-SRV-01でTASK-442の登録と後続実行を確認した。UserSyncTaskは9月15日にログオン起動として登録され、15日と16日に同じパスのuser-sync.exeを起動している。既存の承認済み日次タスクとは実行条件が異なるため、別定義による繰り返し起動の仮説を支持する。登録セッションとファイルの来歴は未確認で、担当チームに証拠と追加確認を引き継ぐ。'
  }
};

const fileProfiles = [
  { host: 'LEDGER-FS-01', user: 'svc-ledger', role: '会計集計' },
  { host: 'DESIGN-FS-01', user: 'svc-design', role: '設計保管' },
  { host: 'ARCHIVE-FS-01', user: 'svc-archive', role: '文書保管' }
];
const fileTemplates = [
  ({ role,host,day }) => ({ time: observedStep('03:00:00',host,day,'file'), source: 'ファイル', event: '出力ファイルを作成', detail: `job=${role} class=internal output=daily-summary.dat file_count=1 bytes=1048576`, extra: { bytes: 1048576 } }),
  ({ role,host,day }) => ({ time: observedStep('03:02:00',host,day,'upload'), source: '通信', event: '保管先へ送信', detail: `job=${role} object=daily-summary.dat bytes_out=1048576 result=completed`, extra: { destination: 'vault.example', process: 'archive-agent.exe', bytes: 1048576 } }),
  ({ role,host,day }) => ({ time: observedStep('03:03:00',host,day,'receipt'), source: '業務', event: '定例保管の実行票を記録', detail: `job=${role} schedule=daily target=vault.example expected_class=internal expected_bytes=1048576` })
];
const p05 = {
  id: 'p05', level: 'practice', title: '外向きの送信量', subtitle: '量・対象ファイル・承認範囲を照合', minutes: '15–20', focus: '送信量だけで決めない',
  brief: '対象週に大きな送信があります。どのファイルを誰がどこへ送ったのかをつなぎ、申請された範囲と比べてください。',
  context: 'ファイルイベントと通信イベントには同じ処理のバイト数が別々に記録されます。送信量の集計では通信ソースに絞り、二重計上しないようにします。', periods,
  hypotheses: [
    {
        "id": "destination-change",
        "label": "大容量送信のジョブが、申請した転送先から別の保管サービスへ切り替わっている。"
    },
    {
        "id": "duplicate-transfer",
        "label": "大容量送信のジョブで、同じ出力ファイルを短時間に重複して転送している。"
    },
    {
        "id": "export-boundary",
        "label": "大容量送信のジョブに、申請した対象ファイルやデータ分類の範囲外が含まれる。"
    }
], sources: sources(['ファイル', '通信', '業務']),
  guide: [{ title: '調査の進め方を決める', body: '送信先と量を比較し、ファイル・ジョブ・申請の対応を確かめる計画を立ててください。主な根拠と反証を分けて提出します。', tab: 'plan' }],
  hints: ['前週との差だけでなく、今回の処理の単位をそろえて確認します。', '通信で宛先別に集計し、partner-drop.example から端末とジョブの記録へピボットしてください。', '送信と作成を処理単位で対応させ、対象物・分類・期限・受領先を申請と比べます。同じバイト数を別ソースで二重に数えないようにします。'],
  logs: [
    ...routine('p05', fileProfiles, fileTemplates),
    log('p05-e01', 'current', '15', '18:10:00', 'ファイル', 'LEDGER-FS-01', 'svc-ledger', 'エクスポートファイルを作成', 'job=EXPORT-52 artifact_id=ART-552 source=public-quarterly-aggregate.csv classification=外部提供可 records=250000 bytes=52428800 manifest=MAN-552', { bytes: 52428800 }),
    log('p05-e02', 'current', '15', '18:12:00', '通信', 'LEDGER-FS-01', 'svc-ledger', 'ファイル転送を記録', 'job=EXPORT-52 artifact_id=ART-552 manifest=MAN-552 method=PUT bytes_out=52428800 result=completed recipient_id=PARTNER-07', { destination: 'partner-drop.example', process: 'export-agent.exe', bytes: 52428800 }),
    log('p05-e03', 'current', '14', '11:00:00', '業務', 'LEDGER-FS-01', 'data-owner', '外部提供申請を記録', 'EX-315: 9月15日18:00〜19:00 UTC、svc-ledger、LEDGER-FS-01、job=EXPORT-52。対象=public-quarterly-aggregate.csv、classification=外部提供可、250000件、52428800 bytes。宛先=partner-drop.example / PARTNER-07。'),
    log('p05-e04', 'current', '15', '18:13:00', '業務', 'LEDGER-FS-01', 'svc-ledger', '転送実行票を記録', 'job=EXPORT-52 artifact_id=ART-552 manifest=MAN-552 requested_files=1 sent_files=1 receipt_id=RCPT-552 recipient_id=PARTNER-07 status=completed')
  ], findings: [
    {
        "id": "sum-events",
        "label": "作成と通信の量を一つの送信量へまとめ、申請量の倍になる処理について超過の原因を確認する。"
    },
    {
        "id": "new-recipient",
        "label": "今回と前週の送信を一覧にし、今回の宛先を未承認の受領先として取引先への再送要否を確認する。"
    },
    {
        "id": "scope-artifact",
        "label": "承認に一致した対象物をほかの送信と分け、期間・実行者・宛先を例外の適用条件として管理する。"
    }
],
  rubric: { hypotheses: ['export-boundary'], targets: ['LEDGER-FS-01'], verdict: 'benign', sources: ['通信', 'ファイル', '業務'], scope: true, finding: 'scope-artifact',
    evidenceGroups: [group('大容量の送信', 'support', 'p05-e02'), group('送信物と対象分類', 'counter', 'p05-e01'), group('一致する事前承認', 'counter', 'p05-e03'), group('同じ処理の実行票', 'context', 'p05-e04')], operations: ['search', 'aggregate', 'compare', 'pivot'] },
  legacy: {
    "hypothesis": {
        "h1": "export-boundary",
        "h2": "",
        "h3": ""
    },
    "finding": {
        "next": "scope-artifact",
        "stop": "",
        "all": ""
    },
    "targets": {
        "FILE-P5-01": "LEDGER-FS-01",
        "FILE-P5-02": "DESIGN-FS-01",
        "FILE-P5-03": "ARCHIVE-FS-01"
    }
},
  explanation: {
    summary: '増えた送信は、対象物・処理ID・宛先・時間が一致する承認済みの外部提供で説明できます。今回のART-552は正当な業務です。',
    reasoning: ['通信ソースだけを集計するとpartner-drop.exampleへの52428800 bytesが目立ちます。ファイル作成の同じバイト数を送信量へ加算しません。', 'ART-552、MAN-552、EXPORT-52がファイル作成・通信・実行票で一致し、別のファイルの許可を流用していません。', '申請は期間、実行元、アカウント、ファイル、分類、件数、宛先を限定しています。今回の観測値がその範囲に入ります。', '宛先を丸ごと許可する結論ではありません。個人別明細や別ジョブの送信には今回の承認を適用できません。'],
    next: '必要ならこの業務の具体的条件を例外として記録し、同じ宛先でも対象外のファイル・期間・アカウントは引き続き調べます。',
    sampleReport: '9月14〜16日の通信を前週と比較し、LEDGER-FS-01からpartner-drop.exampleへの52428800 bytesの送信を確認した。EXPORT-52/ART-552は外部提供可の集計ファイルで、EX-315の時間・アカウント・対象物・宛先に一致し、転送実行票とも対応する。この送信は正当な業務と判断する。承認範囲外のファイルや別宛先を同じ例外に含めない。'
  }
};

const gapProfiles = [
  { host: 'SALES-WS-01', user: 'aoki', role: '営業' },
  { host: 'FIN-WS-01', user: 'mori', role: '経理' },
  { host: 'DESIGN-WS-01', user: 'kudo', role: '設計' }
];
const gapTemplates = [
  officeTemplates[0],
  ({ host, day, hostIndex }) => ({ time: '09:05:00', source: '通信', event: 'TLS接続を記録', detail: `sensor=edge-flow flow_id=DOC-${host}-${day} src=192.0.2.${61 + hostIndex} dst=203.0.113.10 tls=present bytes_out=8192`, extra: { destination: 'docs.example', bytes: 8192 } }),
  ({ day, period }) => ({ time: '23:00:00', source: '収集', event: '認証・通信の受信状況を記録', detail: `date=2026-09-${day} channels=認証,通信 status=received period=${period} endpoint_process_channel=別資料を参照` })
];
const p06 = {
  id: 'p06', level: 'practice', title: '検索結果の外側', subtitle: 'ない記録から言える範囲を決める', minutes: '15–20', focus: '観測不足を説明する',
  brief: 'ある端末で新しい外部宛先への通信があります。端末内の実行を探しても記録が見つからない場合、どこまで判断できるかを整理してください。',
  context: '表示上の「通信」には境界センサーedge-flow、更新ソフトの自己記録update-client、再開後のendpoint-networkが含まれます。取得項目はsensorごとに異なり、ある経路の記録で別経路の欠落を補えるとは限りません。必要な記録の範囲も調べます。', periods,
  hypotheses: [
    {
        "id": "unknown-process",
        "label": "新しい外部通信は、その時間帯に端末で起動した未確認のプログラムに由来する。"
    },
    {
        "id": "portal-transition",
        "label": "新しい外部通信は、予定された資料ポータルの切替に伴うブラウザー利用に由来する。"
    },
    {
        "id": "update-fallback",
        "label": "新しい外部通信は、既存の更新ジョブが代替ミラーを選択した処理に由来する。"
    }
], sources: sources(['通信', '認証', '端末', '収集']), guide: [{ title: '判断できる範囲を組み立てる', body: '仮説を調べるために必要な記録、取得できた記録、欠けている記録を分けて調査してください。', tab: 'plan' }],
  hints: ['検索結果がないときは、検索条件に加えて、その記録を本当に収集していたかを確認します。', 'FIN-WS-01 の通信から端末へピボットし、端末ソースの前週比較と収集資料を読みます。', '対象通信の時刻に実行元を対応させる記録が届いていたかを確認します。復旧後の別時刻の起動を、欠落中の通信へさかのぼって使わないようにします。'],
  logs: [
    ...routine('p06', gapProfiles, gapTemplates),
    log('p06-e01', 'baseline', '08', '10:32:00', '端末', 'FIN-WS-01', 'mori', 'プロセスの開始を記録', 'path=C:/Program Files/Browser/browser.exe process_guid=P6-B01', { process: 'browser.exe', parent: 'explorer.exe' }),
    log('p06-e02', 'current', '15', '10:32:00', '通信', 'FIN-WS-01', 'mori', '外部HTTPSセッションを記録', 'sensor=edge-flow src=192.0.2.62 dst=203.0.113.62 bytes_out=3072 tls=present flow_id=N6-1032', { destination: 'relay-p6.example', bytes: 3072 }),
    log('p06-e03', 'current', '15', '10:00:00', '収集', 'FIN-WS-01', 'collector', 'プロセス収集の停止を記録', 'sensor=endpoint-process suspended_channels=endpoint-process,endpoint-network stop=2026-09-15T10:00:00Z resume=2026-09-15T12:00:00Z reason=agent-maintenance local_buffer=disabled replay=unavailable'),
    log('p06-e04', 'current', '15', '12:00:00', '収集', 'FIN-WS-01', 'collector', '境界通信センサーの取得項目を記録', 'sensor=edge-flow kept_fields=flow_id,timestamp,src,dst,destination,bytes,tls。10:32のflow_id=N6-1032はこのセンサーの記録。プロセスGUID・プロセス名・通信本文は取得していない。userは端末割当資料の補助情報。sensor=update-clientは更新ソフトの自己記録、sensor=endpoint-networkは端末収集再開後の別経路であり、N6-1032を補う記録ではない。'),
    log('p06-e05', 'current', '15', '12:05:00', '端末', 'FIN-WS-01', 'mori', '収集再開後のプロセスを記録', 'sensor=endpoint-process path=C:/Program Files/Browser/browser.exe process_guid=P6-C01 pid=7312 parent_pid=1800 session_id=LOGIN-FIN-WS-01-15 earliest_observation=12:05', { process: 'browser.exe', parent: 'explorer.exe' })
  ], findings: [
    {
        "id": "browser-backfill",
        "label": "10:32と12:05の記録を時間帯別に整理し、両方を復旧後のブラウザーによる通信として記録する。"
    },
    {
        "id": "seek-alternate",
        "label": "実行元が未確認という限界を残し、欠落時間の端末監査やアプリ履歴の利用可否を確認する。"
    },
    {
        "id": "update-backfill",
        "label": "10:32の通信を更新再試行の候補としてまとめ、12:00の更新ジョブと同じ実行元として照合する。"
    }
],
  rubric: { hypotheses: ['unknown-process'], targets: ['FIN-WS-01'], verdict: 'insufficient', sources: ['通信', '端末', '収集'], scope: true, finding: 'seek-alternate',
    evidenceGroups: [group('調べるきっかけとなる通信', 'support', 'p06-e02'), group('必要な時間帯の欠落', 'gap', 'p06-e03'), group('通信から復元できない項目', 'gap', 'p06-e04')], operations: ['search', 'compare', 'pivot'] },
  legacy: {
    "hypothesis": {
        "h1": "unknown-process",
        "h2": "",
        "h3": ""
    },
    "finding": {
        "gap": "seek-alternate",
        "stop": "",
        "all": ""
    },
    "targets": {
        "WS-P6-01": "SALES-WS-01",
        "WS-P6-02": "FIN-WS-01",
        "WS-P6-03": "DESIGN-WS-01"
    }
},
  explanation: {
    summary: '外部通信は確認できますが、実行元を特定するためのプロセス記録が欠けています。仮説の検証には観測不足です。',
    reasoning: ['10:32の通信は収集されているため、調査のきっかけ自体は存在します。', '同時刻は端末のプロセス収集停止中です。バッファや再送もなく、検索で0件でも起動がなかったことにはなりません。', '10:32のedge-flow記録にはプロセス名やGUID、本文がありません。別センサーの更新自己記録や12時以降のendpoint-networkに実行元があっても、この通信へは結び付けられません。表示された端末利用者も本人の操作を確定しません。', '12:05のbrowser.exeは収集再開後の別イベントです。時間や識別子がつながらないため10:32の通信へ推測で結合しません。'],
    next: '端末のローカル監査、ファイル取得履歴、アプリ側の記録など代替資料の可否を確認し、見つからなければ今回の限界として残します。',
    sampleReport: '9月14〜16日のFIN-WS-01を調査した。9月15日10:32にrelay-p6.exampleへの通信はあるが、10:00〜12:00のプロセス収集が停止し再送もない。該当するedge-flowセンサーもプロセス名・GUIDを保持しないため、実行元の仮説は観測不足で判断できない。12:05のブラウザー起動をさかのぼって結び付けず、端末側の代替記録の可否を確認する。'
  }
};

const fieldProfiles = [
  { host: 'WS-F1-01', user: 'aoki', role: '営業' },
  { host: 'WS-F1-02', user: 'mori', role: '経理' },
  { host: 'WS-F1-03', user: 'kudo', role: '設計' }
];
const f01 = {
  id: 'f01', level: 'field', title: '外部情報を環境の問いへ', subtitle: '固有名から行動のつながりへ広げる', minutes: '20–30', focus: '脅威情報からの仮説',
  brief: '架空の脅威情報には「文書閲覧アプリを親とするスクリプト実行の後、新しい外部宛先へ接続」という観測が載っています。この環境に同じ組み合わせがあるか、自分で計画して探してください。',
  context: '情報に載ったファイル名は参考で、同じ名前があれば攻撃、なければ安全とは扱えません。対象は営業・経理・設計の3台です。仮説に必要なソース、比較単位、ピボットの順序を自分で決めます。', periods,
  hypotheses: [
    {
        "id": "inventory-chain",
        "label": "管理エージェントの棚卸処理が、スクリプトを起動して新しい外部宛先へ接続している。"
    },
    {
        "id": "document-chain",
        "label": "文書閲覧アプリの子としてスクリプトが起動し、同じ実行で新しい外部宛先へ接続している。"
    },
    {
        "id": "browser-chain",
        "label": "ブラウザーの外部連携機能が、スクリプトを起動して新しい外部宛先へ接続している。"
    }
], sources: sources(['端末', '通信', '認証', '業務']),
  guide: [{ title: '着手前に計画する', body: '情報を検索可能な行動仮説へ置き換え、必要なソースと調査範囲を選んでください。候補を見つけたら、別ソースの裏付けと良性の代替説明を確認します。', tab: 'plan' }],
  hints: ['個別のファイル名より、親子関係と後続通信という組み合わせを検証します。', '端末ログのプロセスを集計し、powershell.exeの候補端末から親と通信へピボットします。前週と対象週も比べましょう。', '同じツール名の候補を親プロセスで比較し、該当する実行GUIDの通信を探します。定例や承認済みの臨時作業は、別の実行として説明できるか照合します。'],
  logs: [
    ...routine('f01', fieldProfiles, officeTemplates),
    log('f01-e01', 'baseline', '08', '04:00:00', '端末', 'WS-F1-01', 'svc-inventory', 'プロセスの開始を記録', 'path=C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe command=inventory.ps1 signature=valid process_guid=F1-B11 job=INV-DAILY', { process: 'powershell.exe', parent: 'inventory-agent.exe' }),
    log('f01-e02', 'current', '15', '04:00:00', '端末', 'WS-F1-01', 'svc-inventory', 'プロセスの開始を記録', 'path=C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe command=inventory.ps1 signature=valid process_guid=F1-C11 job=INV-DAILY', { process: 'powershell.exe', parent: 'inventory-agent.exe' }),
    log('f01-e03', 'current', '15', '11:20:00', '端末', 'WS-F1-02', 'mori', 'プロセスの開始を記録', 'path=C:/Program Files/DocView/docview.exe document=C:/Users/mori/Downloads/meeting-notes.docx process_guid=F1-P87 pid=5140 parent_pid=1800 session_id=LOGIN-WS-F1-02-15', { process: 'docview.exe', parent: 'explorer.exe' }),
    log('f01-e04', 'current', '15', '11:20:04', '端末', 'WS-F1-02', 'mori', '子プロセスの開始を記録', 'process_guid=F1-P88 parent_process_guid=F1-P87 pid=5196 parent_pid=5140 session_id=LOGIN-WS-F1-02-15 path=C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe command=run-local-script script=C:/Users/mori/AppData/Temp/session.ps1', { process: 'powershell.exe', parent: 'docview.exe' }),
    log('f01-e05', 'current', '15', '11:20:07', '通信', 'WS-F1-02', 'mori', 'HTTPS要求を記録', 'process_guid=F1-P88 pid=5196 session_id=LOGIN-WS-F1-02-15 method=POST path=/session status=200 request_id=F1-N01', { destination: 'cdn-session.example', process: 'powershell.exe', bytes: 1536 }),
    log('f01-e06', 'current', '14', '08:00:00', '業務', 'WS-F1-01', 'ops-lead', '定例棚卸の作業条件を記録', 'plan=INV-DAILY status=approved target=WS-F1-01 account=svc-inventory launcher=inventory-agent.exe program=powershell.exe script="C:/Program Files/Inventory/inventory.ps1" start_utc=04:00 action=inventory'),
    log('f01-e07', 'current', '14', '08:01:00', '業務', 'WS-F1-02', 'intel-team', '架空の脅威情報を記録', '行動観測=文書閲覧アプリ→スクリプト実行→同じプロセスによる新しい外部宛先への接続。レポートの例示名=invoice-reader.docx。情報源=架空の業界共有レポート。観測対象=別組織の環境。')
  ], findings: [
    {
        "id": "inventory-scope",
        "label": "文書アプリ経由の実行を定例棚卸の候補として記録し、同じツールの出力先と完了票を確認する。"
    },
    {
        "id": "expand-behavior",
        "label": "文書からの実行と対応通信をまとめ、文書・スクリプトの来歴と同じ行動の他端末を調べる。"
    },
    {
        "id": "name-match",
        "label": "文書の名前を残し、外部情報の例示名に一致するものを今回の起動元候補として優先する。"
    }
],
  rubric: { hypotheses: ['document-chain'], targets: ['WS-F1-02'], verdict: 'supported', sources: ['端末', '通信', '業務'], scope: true, finding: 'expand-behavior',
    evidenceGroups: [group('文書アプリからの起動', 'support', 'f01-e04'), group('同じ実行に続く通信', 'support', 'f01-e05'), group('対照となる定例実行', 'context', 'f01-e02'), group('定例業務の適用範囲', 'context', 'f01-e06')], operations: ['search', 'aggregate', 'compare', 'pivot'] },
  legacy: {
    "hypothesis": {
        "h1": "document-chain",
        "h2": "",
        "h3": ""
    },
    "finding": {
        "next": "expand-behavior",
        "stop": "",
        "all": ""
    },
    "targets": {}
},
  explanation: {
    summary: 'WS-F1-02には情報に示された行動の組み合わせがあり、仮説を支持します。WS-F1-01の定例処理は同じツール名でも別の説明ができます。',
    reasoning: ['名前が例示ファイル名と違っても、親子関係と通信の組み合わせを検索するため候補を見つけられます。', '端末と通信のF1-P88が一致し、単に同じ時刻に動いていた別プロセスの通信を結合したわけではありません。', 'WS-F1-01のpowershell.exeは前週にもあり、親・アカウント・時刻・スクリプトが定例棚卸と一致します。ツール名だけで対象を広げません。', '別端末の定例実行は、ツール名だけで候補をまとめないための比較文脈です。WS-F1-02の親子関係を否定する反証ではありません。', '類似挙動から攻撃者名、マルウェアの種類、被害全体までは断定できません。'],
    next: '文書・スクリプト・取得元を確認し、同じ親子関係と通信の相関を他端末・前後の期間へ展開します。',
    sampleReport: '9月14〜16日の3端末について、文書アプリからスクリプトが起動し新しい宛先へ通信する仮説を調査した。WS-F1-02ではdocview.exeを親とするF1-P88が起動し、同じGUIDでcdn-session.exampleへ通信しており、仮説を支持する。WS-F1-01の定例inventoryは親・時間・アカウントが異なり対象から分けた。攻撃者や通信目的は未確定で、文書とスクリプトの来歴および同じ行動の広がりを追加確認する。'
  }
};

const natProfiles = [
  { host: 'WS-F2-01', user: 'aoki', role: '営業' },
  { host: 'WS-F2-02', user: 'mori', role: '経理' },
  { host: 'WS-F2-03', user: 'kudo', role: '設計' }
];
const natTemplates = [
  ({ user }) => ({ time: '08:50:00', source: '認証', event: '端末への認証を記録', detail: `account=${user} method=device-certificate logon_type=interactive result=success` }),
  ({ host, user }) => ({ time: '09:00:00', source: '通信', event: 'プロキシ経由の要求を記録', detail: `edge_src=192.0.2.80 client_device=${host} assigned_user=${user} method=GET path=/team/handbook`, extra: { destination: 'docs.example', process: 'browser.exe', bytes: 12288 } }),
  ({ host }) => ({ time: '12:00:00', source: '通信', event: 'プロキシ経由の更新確認を記録', detail: `edge_src=192.0.2.80 client_device=${host} method=GET path=/catalog.json schedule=daily`, extra: { destination: 'updates.example', process: 'updater.exe', bytes: 4096 } })
];
const f02 = {
  id: 'f02', level: 'field', title: '同じ接続元に見える端末', subtitle: '共通する値と同一主体を区別する', minutes: '20–30', focus: '複数端末の相関を検証',
  brief: '複数端末の通信で、同じIPアドレスが繰り返し現れます。一つのアカウントが端末間を移動したという仮説を、環境の構成と認証の記録で検証してください。',
  context: 'IPアドレスはログ内のdetailにあります。通信をまとめる装置がある場合、外から見えるIPと端末を区別する必要があります。3台のログを広く調べ、対象を早く1台へ絞りすぎないようにします。', periods,
  hypotheses: [
    {
        "id": "account-movement",
        "label": "共通の接続元IPが見える3台には、同じアカウントが端末を移動した記録がある。"
    },
    {
        "id": "shared-workload",
        "label": "共通の接続元IPが見える3台には、同じサービスアカウントの定例ジョブがある。"
    },
    {
        "id": "session-retry",
        "label": "共通の接続元IPが見える3台には、同じ認証セッションの再試行を写した記録がある。"
    }
], sources: sources(['通信', '認証', '業務', '収集']),
  guide: [{ title: '相関の根拠を計画する', body: 'どの値なら端末・アカウント・セッションを結び付けられるか考え、必要な記録と調査範囲を選んでください。仮説を支持しない結果も、探索の成果として残します。', tab: 'plan' }],
  hints: ['同じIPがどの装置のどの側の値かを確認し、アカウントを別ソースで調べます。', '192.0.2.80で検索してホストやユーザーを集計します。各端末へピボットし、前週の通信と認証も比較します。', '構成資料で共通IPがどの装置の値かを確認し、端末ID・アカウント・セッションで認証を照合します。IP以外の値が同一主体という見方を支持するか検討します。'],
  logs: [
    ...routine('f02', natProfiles, natTemplates),
    log('f02-e01', 'current', '15', '10:00:00', '認証', 'WS-F2-01', 'aoki', 'セッション開始を記録', 'device_id=DEV-F201 account=aoki session_id=SESS-201 method=device-certificate source_device=WS-F2-01 logon_type=interactive result=success'),
    log('f02-e02', 'current', '15', '10:01:00', '認証', 'WS-F2-02', 'mori', 'セッション開始を記録', 'device_id=DEV-F202 account=mori session_id=SESS-202 method=device-certificate source_device=WS-F2-02 logon_type=interactive result=success'),
    log('f02-e03', 'current', '15', '10:02:00', '認証', 'WS-F2-03', 'kudo', 'セッション開始を記録', 'device_id=DEV-F203 account=kudo session_id=SESS-203 method=device-certificate source_device=WS-F2-03 logon_type=interactive result=success'),
    log('f02-e04', 'current', '14', '07:00:00', '業務', 'WS-F2-01', 'network-owner', '接続構成資料を記録', 'NET-22: WS-F2-01/02/03は共通プロキシPROXY-22を経由する。edge_src=192.0.2.80はPROXY-22の外向きIP。client_deviceは端末識別子。両比較期間とも同じ構成。利用者対応表=認証セッション台帳。'),
    log('f02-e05', 'current', '16', '23:50:00', '収集', 'WS-F2-01', 'collector', '認証収集範囲を記録', '対象=WS-F2-01/02/03、両比較期間の教材内ログオンとセッション開始を収録。欠落はない。認証を伴わない操作、別の端末や期間の行動を網羅するものではない。'),
    ...natProfiles.map((p, n) => log(`f02-e0${n + 6}`, 'current', '15', `10:0${n}:10`, '通信', p.host, p.user, 'プロキシ経由の要求を記録', `edge_src=192.0.2.80 client_device=${p.host} device_id=DEV-F20${n + 1} session_id=SESS-20${n + 1} method=GET path=/team/handbook`, { destination: 'docs.example', process: 'browser.exe', bytes: 12288 }))
  ], findings: [
    {
        "id": "collapse-session",
        "label": "時刻が近い認証を一つの再試行とし、最初の端末を起点として各端末のセッションを残す。"
    },
    {
        "id": "shared-account",
        "label": "通信を端末ごとに並べ、共通サービスアカウントが使った認証方式と資格情報の管理を確認する。"
    },
    {
        "id": "use-identifiers",
        "label": "共有IPと主体の識別を分け、アカウント・端末ID・セッションを基準に次の横断条件を作る。"
    }
],
  rubric: { hypotheses: ['account-movement'], targets: ['WS-F2-01', 'WS-F2-02', 'WS-F2-03'], verdict: 'unsubstantiated', sources: ['通信', '認証', '業務', '収集'], scope: true, finding: 'use-identifiers',
    evidenceGroups: [group('一台目の主体', 'counter', 'f02-e01'), group('別端末の異なる主体', 'counter', 'f02-e02', 'f02-e03'), group('共通IPの意味', 'counter', 'f02-e04'), group('認証比較の観測範囲', 'context', 'f02-e05')], operations: ['search', 'aggregate', 'compare', 'pivot'] },
  legacy: {
    "hypothesis": {
        "h1": "account-movement",
        "h2": "",
        "h3": ""
    },
    "finding": {
        "next": "use-identifiers",
        "stop": "",
        "all": ""
    },
    "targets": {}
},
  explanation: {
    summary: '共通IPはプロキシのアドレスで、同じアカウントの端末間移動を示す裏付けは今回の記録にはありません。',
    reasoning: ['192.0.2.80は3台の端末IPではなく、外向きプロキシの値です。前週にも同じ構成とパターンがあります。', '対象週の認証と通信をdevice_id/session_idでつなぐと、aoki、mori、kudoという別々のセッションです。IPだけで一つの主体へまとめると誤った相関になります。', '対象期間の教材内認証は取得できています。この仮説を支える同一アカウントの横断は確認できませんが、それは全ての操作の正当性を認定したこととは異なります。', '観測した各セッションを「正当な業務」と断定する承認・操作内容の資料はありません。ここでは具体的な端末間移動仮説の裏付けなしとします。', '認証を伴わない行動や範囲外の端末まで否定できません。対象3台を報告に残して探索範囲を明確にします。'],
    next: '共通IPを人物の識別子として使わず、アカウント、端末ID、セッションID、時間を組み合わせて別の仮説を検証します。',
    sampleReport: '9月14〜16日のWS-F2-01/02/03について、同一接続元IPを起点に端末間移動を調査した。192.0.2.80は両期間とも共通プロキシのIPで、認証・通信を端末IDとセッションで照合すると各端末は別アカウントだった。今回の認証範囲では同一アカウントによる移動は裏付けられない。全操作の正当性や範囲外の安全は判断せず、主体を識別できる値で次の仮説を検証する。'
  }
};

const cloudProfiles = [
  { host: 'CLOUD-F3-01', user: 'svc-export', role: '集計出力' },
  { host: 'CLOUD-F3-02', user: 'svc-report', role: '報告作成' },
  { host: 'CLOUD-F3-03', user: 'svc-archive', role: '保管' }
];
const cloudTemplates = [
  ({ user,role,host,day }) => ({ time: observedStep('06:00:00',host,day,'auth'), source: '認証', event: 'サービス認証を記録', detail: `account=${user} method=certificate resource=workspace.example result=success workload=${role}` }),
  ({ role,host,day }) => ({ time: observedStep('06:02:00',host,day,'api'), source: '通信', event: 'サービスへの接続を記録', detail: `job=${role} tls=present method=POST path=/api/job status=200`, extra: { destination: 'workspace.example', process: 'job-agent.exe', bytes: 2048 } }),
  ({ role,host,day }) => ({ time: observedStep('06:10:00',host,day,'monitor'), source: '業務', event: 'ジョブ監視の受信票を記録', detail: `job=${role} heartbeat=received scheduler_state=finished receipt_type=job-heartbeat` })
];
const f03 = {
  id: 'f03', level: 'field', title: '残された記録で調べる', subtitle: '範囲と不足を含めて報告する', minutes: '20–30', focus: '限られた証拠での判断',
  brief: '外部からの認証と大きな応答量が気になっています。データ取得の有無を調べますが、使えるログには保存期間と取得項目の制約があります。',
  context: 'アクセス成功、HTTPの応答量、ジョブの終了は、それぞれ違う事実です。対象オブジェクトや操作内容を確かめるのに何が必要かを計画し、取得できない場合も報告を完成させてください。', periods,
  hypotheses: [
    {
        "id": "scheduled-export",
        "label": "外部認証後の応答は、定例集計ジョブが遅れて実行された出力に由来する。"
    },
    {
        "id": "response-retry",
        "label": "外部認証後の応答は、同じ要求の再試行が重なり大きく見えている。"
    },
    {
        "id": "object-access",
        "label": "外部認証後の応答には、承認範囲外のデータを取得した結果が含まれる。"
    }
], sources: sources(['認証', '通信', '業務', '収集', 'ファイル']),
  guide: [{ title: '最初に調査計画を残す', body: '仮説を支持または否定するのに必要な記録を選び、取得可能な範囲を確認してください。証拠不足のときは不足の場所と次の確認を具体的に提出します。', tab: 'plan' }],
  hints: ['認証、通信、オブジェクト操作を混同せず、それぞれ何を確認できるか整理します。', 'svc-export から対象を絞り、認証と通信のsession_idを照合します。ファイルソースと収集条件も調べてください。', '認証と応答を対応させた後、取得対象を識別する資料がその日に保存されていたかを確認します。別日の同じ応答量を、欠落した対象物の代用にしないようにします。'],
  logs: [
    ...routine('f03', cloudProfiles, cloudTemplates),
    log('f03-e01', 'current', '15', '19:20:00', '認証', 'CLOUD-F3-01', 'svc-export', '外部IPからのサービス認証を記録', 'src=198.51.100.91 session_id=SF3-91 method=client-secret resource=workspace.example result=success expected_device_claim=absent'),
    log('f03-e02', 'current', '15', '19:22:00', '通信', 'CLOUD-F3-01', 'svc-export', 'API応答を記録', 'session_id=SF3-91 method=GET path=/api/v2/items status=200 response_bytes=20971520 request_id=RF3-22', { destination: 'workspace.example', bytes: 20971520 }),
    log('f03-e03', 'current', '16', '09:00:00', '収集', 'CLOUD-F3-01', 'collector', 'オブジェクト監査の保存範囲を記録', '対象週のオブジェクト監査は9月16日00:00 UTC以降のみ保存。9月14〜15日は保存契約外で復元不可。認証ログは9月14〜16日を保存。両ログの保存範囲は同一ではない。'),
    log('f03-e04', 'current', '16', '09:01:00', '収集', 'CLOUD-F3-01', 'collector', 'ネットワーク取得項目を記録', '保存項目=session_id,method,path,status,response_bytes。応答本文、オブジェクトID、ファイル名、データ分類は保存していない。response_bytesは応答全体のバイト数で、機密データ量を示す欄ではない。業務のジョブ監視票は状態通知で、オブジェクト単位の内容は保持しない。'),
    log('f03-e05', 'current', '14', '09:00:00', '業務', 'CLOUD-F3-01', 'data-owner', '定例出力の申請範囲を記録', 'plan=DAILY-EXPORT status=approved target=CLOUD-F3-01 account=svc-export window_utc=06:00/06:10 authentication=certificate data_class=aggregate action=read-and-export'),
    log('f03-e06', 'current', '16', '06:03:00', 'ファイル', 'CLOUD-F3-01', 'svc-export', '保存開始後のオブジェクト読取を記録', 'session_id=SF3-1606 object_id=OBJ-DAILY-16 classification=集計データ action=read result=success。この記録は9月16日の定例処理。'),
    log('f03-e07', 'baseline', '08', '06:03:00', 'ファイル', 'CLOUD-F3-01', 'svc-export', '比較用のオブジェクト読取を記録', 'session_id=SF3-0806 object_id=OBJ-DAILY-08 classification=集計データ action=read result=success。前週の個別保存標本。対象週の欠落を補う資料ではない。')
  ], findings: [
    {
        "id": "alternate-audit",
        "label": "必要な項目と保存範囲を記録し、取得内容は別監査やデータ所有者の処理記録で別途照合する。"
    },
    {
        "id": "daily-backfill",
        "label": "15日と16日の応答を分けて残し、同じバイト数の定例オブジェクトを両日の取得物として照合する。"
    },
    {
        "id": "byte-estimate",
        "label": "認証と応答をセッションでまとめ、応答量を機密データの取得量として影響範囲の見積もりに使う。"
    }
],
  rubric: { hypotheses: ['object-access'], targets: ['CLOUD-F3-01'], verdict: 'insufficient', sources: ['認証', '通信', 'ファイル', '収集'], scope: true, finding: 'alternate-audit',
    evidenceGroups: [group('気になる認証', 'support', 'f03-e01'), group('同じセッションの応答', 'support', 'f03-e02'), group('必要な日の監査不足', 'gap', 'f03-e03'), group('通信から取得内容を復元できない理由', 'gap', 'f03-e04')], operations: ['search', 'aggregate', 'compare', 'pivot'] },
  legacy: {
    "hypothesis": {
        "h1": "object-access",
        "h2": "",
        "h3": ""
    },
    "finding": {
        "gap": "alternate-audit",
        "stop": "",
        "all": ""
    },
    "targets": {}
},
  explanation: {
    summary: '通常とは異なる認証と同じセッションの大きな応答はありますが、取得対象や内容の記録が欠けています。承認外データ取得という仮説は観測不足です。',
    reasoning: ['外部IP、client-secret、19時台という認証は、06時台の証明書による定例処理とは異なり、調査のきっかけになります。', 'SF3-91により認証とAPI応答は対応します。しかしHTTP 200と20 MiBの応答は、対象オブジェクトやデータ分類を証明しません。', '9月15日のオブジェクト監査は保存されておらず、後日の正常な読取記録を同じセッションの証拠として使うことはできません。', '比較画面でオブジェクトログの件数差が見えても、収集条件が違うため行動の増減とそのまま解釈しません。', '観測不足は調査を放棄する意味ではありません。取得できた事実、残る懸念、不足と追加確認先を区別して残します。'],
    next: 'サービス側の別監査、データ所有者の処理記録、資格情報の利用履歴など代替資料を確認します。元の監査が復元不能な点は、追加調査で消えたように扱いません。',
    sampleReport: '9月14〜16日のCLOUD-F3-01を調査した。9月15日19:20:26 UTCにsvc-exportが外部IPからclient-secretで認証し、同じSF3-91で20 MiBのAPI応答があった。定例条件とは異なるが、同日のオブジェクト監査は保存対象外で、通信にも本文やオブジェクトIDがない。承認外データ取得の有無は観測不足で判断できない。別監査やデータ所有者の記録を確認し、復元できない範囲を明示して引き継ぐ。'
  }
};

// The practice course revisits one environment. Workstations retain their users;
// reporting, backup, build and file servers retain distinct service roles.
const environment = '共通の演習環境です。SALES-WS-01は営業のaoki、FIN-WS-01は経理のmori、DESIGN-WS-01は設計のkudoが使い、IT-ADM-01は管理専用です。用途別サーバーは端末とは別の資産です。';
for (const task of [p01, p02, p03, p04, p05, p06]) task.context = `${environment} ${task.context}`;
p02.context += ' BACKUP-SRV-01のsvc-backupは04:00のDaily-バックアップを実行し、タスクを調べる後の演習にも同じ役割で登場します。';
p04.context += ' BACKUP-SRV-01のsvc-backupと04:00のDaily-バックアップは、アカウントを調べた演習と同じ定例処理です。';
p06.context += ' 更新ジョブUPDATE-DAILYとupdates.exampleは、最初の通信演習と同じ毎日12:00の処理です。';

// Low-frequency benign activity has its own observable explanation, so rarity
// alone cannot identify the intended finding.
p01.logs.push(
  log('p01-e08', 'current', '15', '09:59:35', '端末', 'FIN-WS-01', 'mori', 'プロセスの開始を記録', 'path=C:/Users/mori/Downloads/viewer.exe process_guid=P1-P40 pid=6336 parent_pid=1800 session_id=LOGIN-FIN-WS-01-15', { process: 'viewer.exe', parent: 'explorer.exe' }),
  log('p01-r01', 'current', '15', '10:02:00', '通信', 'SALES-WS-01', 'svc-update', '更新パッケージの取得要求を記録', 'job=UPDATE-DAILY change=PATCH-919 method=GET path=/packages/client-9.zip status=503 process_guid=UPD-SALES-15 request_id=PATCH-919-A retry_after=60', { destination: 'mirror-updates.example', process: 'updater.exe', bytes: 512 }),
  log('p01-r02', 'current', '15', '10:03:00', '通信', 'SALES-WS-01', 'svc-update', '更新パッケージの取得要求を記録', 'job=UPDATE-DAILY change=PATCH-919 method=GET path=/packages/client-9.zip status=200 process_guid=UPD-SALES-15 request_id=PATCH-919-B previous_request=PATCH-919-A', { destination: 'mirror-updates.example', process: 'updater.exe', bytes: 180224 }),
  log('p01-r03', 'current', '14', '15:00:00', '業務', 'SALES-WS-01', 'it-ops', '更新配布の変更票を記録', 'change=PATCH-919 status=approved target=SALES-WS-01 account=svc-update program=updater.exe window_utc=2026-09-15T10:00/10:30 destination=mirror-updates.example action=package-download retry_on=503 retry_delay_seconds=60')
);
p01.explanation.reasoning.push('SALES-WS-01の新しい更新ミラーも珍しい通信ですが、503から60秒後の再試行、実行元、時間、変更票が一致します。新規宛先を一括して同じ結論にしません。');

p02.logs.push(
  log('p02-r01', 'current', '14', '03:55:00', '認証', 'BACKUP-SRV-01', 'svc-backup', '更新後の証明書認証を記録', 'method=certificate cert_id=CERT-BACKUP-3 result=success interactive=false session_id=BACKUP-1403 request_id=CERT-221-R'),
  log('p02-r02', 'current', '14', '02:00:00', '業務', 'BACKUP-SRV-01', 'ops-lead', '証明書の更新票を記録', 'CERT-221: svc-backupの証明書をCERT-BACKUP-2からCERT-BACKUP-3へ更新。対象端末=BACKUP-SRV-01、通常のDaily-バックアップは04:00のまま。担当=backup-team。')
);
p02.explanation.reasoning.push('同じ週にはsvc-backupの証明書更新もありますが、別アカウント・別端末・別申請です。その説明をsvc-reportの新しい利用先へ流用しません。');

p03.logs.push(
  log('p03-r01', 'current', '16', '18:45:00', '端末', 'IT-ADM-01', 'ops-admin', 'プロセスの開始を記録', 'path="C:/Program Files/AdminKit/adminctl.exe" signature=valid command=diagnose target=BACKUP-SRV-01 process_guid=ADM-DIAG-91 pid=6020 parent_pid=1880 session_id=OPS-EXTRA-91 request_id=DIAG-91', { process: 'adminctl.exe', parent: 'explorer.exe' }),
  log('p03-r02', 'current', '16', '18:00:00', '業務', 'IT-ADM-01', 'ops-lead', '臨時診断の実施票を記録', 'change=DIAG-91 status=approved source=IT-ADM-01 target=BACKUP-SRV-01 account=ops-admin window_utc=2026-09-16T18:30/19:00 launcher=management-shell program=adminctl.exe action=diagnose')
);
p03.explanation.reasoning.push('対象週にはDIAG-91の臨時診断が1件増えますが、実行場所はIT-ADM-01のままです。件数増加と利用端末の広がりを区別します。');

p04.logs.push(
  log('p04-r01', 'current', '15', '04:17:00', '端末', 'BACKUP-SRV-01', 'svc-backup', '確認処理の再実行を記録', 'task=BackupReceiptCheck definition_id=TASK-BACKUP-CHECK request_id=RETRY-91 command=verify-receipt mode=read-only process_guid=BACKUP-CHECK-1517 pid=3712 parent_pid=940 session_id=BATCH-BACKUP-15', { process: 'verify.exe', parent: 'taskeng.exe' }),
  log('p04-r02', 'current', '15', '04:12:00', '業務', 'BACKUP-SRV-01', 'ops-lead', '受領確認の再実行票を記録', 'change=RETRY-91 status=approved target=BACKUP-SRV-01 task=BackupReceiptCheck window_utc=2026-09-15T04:15/04:25 account=svc-backup program=verify.exe action=receipt-query reason=receipt-index-delay backup_completed_at=2026-09-15T04:05:00Z')
);
p04.explanation.reasoning.push('04:17のverify.exeはRETRY-91の受領確認です。タスク名、定義ID、トリガー、実行ファイルがTASK-442と異なり、同じバックアップ端末上の出来事という理由だけで結合しません。');

p05.logs.push(
  log('p05-r01', 'baseline', '08', '18:10:00', 'ファイル', 'LEDGER-FS-01', 'svc-ledger', '確認用ファイルを作成', 'job=EXPORT-48 artifact_id=ART-548 source=public-preview.csv classification=外部提供可 records=25000 bytes=5242880 manifest=MAN-548', { bytes: 5242880 }),
  log('p05-r02', 'baseline', '08', '18:12:00', '通信', 'LEDGER-FS-01', 'svc-ledger', '確認用ファイルを転送', 'job=EXPORT-48 artifact_id=ART-548 manifest=MAN-548 method=PUT bytes_out=5242880 result=completed recipient_id=PARTNER-07 request_id=EXPORT-48-PUT', { destination: 'partner-drop.example', process: 'export-agent.exe', bytes: 5242880 }),
  log('p05-r03', 'baseline', '07', '11:00:00', '業務', 'LEDGER-FS-01', 'data-owner', '確認用データの提供申請を記録', 'EX-308: 9月8日18:00〜19:00、LEDGER-FS-01、svc-ledger、EXPORT-48、public-preview.csv、外部提供可、25000件、5242880 bytes。宛先=partner-drop.example/PARTNER-07。')
);
p05.context += ' 主な調査対象は経理のEXPORT-52です。前週の同じ宛先への確認用データと、対象週の本番データでは申請と対象物が異なります。';
p05.explanation.reasoning.push('前週の同じ宛先への5 MiB送信はEX-308の確認用データです。対象週の50 MiBと量が違っても、各申請と対象物を照合して判断します。');

for (const period of ['baseline', 'current']) {
  for (const day of dates[period]) {
    for (const [index, profile] of officeProfiles().entries()) {
      const row = officeTemplates[3]({ ...profile, period, day });
      p06.logs.push(log(`p06-u-${period === 'baseline' ? 'b' : 'c'}-${day}-${index + 1}`, period, day, row.time, row.source, profile.host, row.user, row.event, row.detail, row.extra));
    }
  }
}
p06.logs.push(
  log('p06-r01', 'current', '15', '12:07:00', '通信', 'FIN-WS-01', 'mori', '資料ポータルへの要求を記録', 'sensor=endpoint-network method=GET path=/finance/handbook status=200 process_guid=P6-C01 request_id=PORTAL-15-1207 session_id=LOGIN-FIN-WS-01-15', { destination: 'portal-v2.example', process: 'browser.exe', bytes: 16384 }),
  log('p06-r02', 'current', '14', '16:00:00', '業務', 'FIN-WS-01', 'portal-owner', '資料ポータルの切替予定を記録', 'change=PORTAL-15 status=approved audience=finance valid_from=2026-09-15T12:00:00Z destination=portal-v2.example program=browser.exe action=read-team-documents')
);
p06.sources.push(...sources(['業務']));
p06.explanation.reasoning.push('収集再開後の12:07のポータル通信はP6-C01と対応し、切替資料とも一致します。しかし別宛先・別時間の10:32の通信へ、その実行元をさかのぼって割り当てることはできません。');

f02.logs.push(
  log('f02-r01', 'current', '16', '16:20:00', '認証', 'WS-F2-03', 'ops-admin', '保守セッション開始を記録', 'device_id=DEV-F203 account=ops-admin session_id=MAINT-203 method=certificate source_device=JUMP-F2-01 logon_type=remote result=success request_id=MAINT-22'),
  log('f02-r02', 'current', '16', '15:00:00', '業務', 'WS-F2-03', 'ops-lead', '保守作業の許可を記録', 'MAINT-22: 9月16日16:00〜16:30、JUMP-F2-01からWS-F2-03へops-adminで接続し表示設定を確認。作業内容=表示設定の確認。')
);
f02.explanation.reasoning.push('16日には別の保守セッションもありますが、対象1台・別アカウント・別時間として記録され、許可票と一致します。9月15日の3台を同一主体へまとめる根拠にはなりません。');

f03.logs.push(
  log('f03-r01', 'current', '16', '06:03:02', '通信', 'CLOUD-F3-01', 'svc-export', '定例出力の応答を記録', 'session_id=SF3-1606 method=GET path=/api/v2/items status=200 response_bytes=20971520 request_id=RF3-1606', { destination: 'workspace.example', process: 'job-agent.exe', bytes: 20971520 }),
  log('f03-r02', 'current', '16', '06:10:00', '業務', 'CLOUD-F3-01', 'data-owner', '定例出力の照合票を記録', 'session_id=SF3-1606 request_id=RF3-1606 object_id=OBJ-DAILY-16 classification=集計データ。06時台の定例出力で応答量20971520 bytesを受領。')
);
f03.explanation.reasoning.push('16日の同じ20 MiB応答には、監査と照合票が対応します。量だけでは対象物を識別できず、この別セッションの説明を15日へ移すこともできません。');

p04.guideMode = p05.guideMode = p06.guideMode = 'checklist';
p04.guide = [
  { title: '登録条件を確認した', body: '定義ID、実行ファイル、トリガー、実行アカウントを控える。', tab: 'logs' },
  { title: '実行の有無を照合した', body: '定義に対応する実行を探し、日をまたぐ起動や別のタスクを区別する。', tab: 'timeline' },
  { title: '運用の範囲を比べた', body: '定例処理と臨時作業の資料を読み、各実行に適用できる説明を分ける。', tab: 'compare' },
  { title: '結論と未確認事項を残した', body: '確認済みの連鎖と、作成者・ファイルの来歴など未確認の点を分けて報告する。', tab: 'report' }
];
p05.guide = [
  { title: '集計の単位をそろえた', body: '通信量とファイルサイズを二重計上せず、処理単位と期間をそろえる。', tab: 'aggregate' },
  { title: '送信物を対応付けた', body: 'ジョブ、アーティファクト、マニフェスト、受領先を照合する。', tab: 'timeline' },
  { title: '各申請の範囲を確かめた', body: '前週と対象週の申請を区別し、対象物・期間・量・宛先を比べる。', tab: 'compare' },
  { title: '適用できる結論を限定した', body: '確認した送信の結論と、同じ宛先でも別途確認が必要な範囲を残す。', tab: 'report' }
];
p06.guide = [
  { title: '取得できた事実を整理した', body: '通信に記録された値と、別資料から補われた値を区別する。', tab: 'logs' },
  { title: '必要な記録の範囲を確認した', body: '各ソースの収集時間・取得項目・再送の可否を確認する。', tab: 'compare' },
  { title: '代替説明を照合した', body: '更新やポータル切替の記録を調べ、時刻・宛先・実行IDが対応するか確かめる。', tab: 'timeline' },
  { title: '不足と次の確認を報告した', body: '確認できない対応関係と、代わりに探す記録を具体的に残す。', tab: 'report' }
];

f01.hypothesisPrompt = '文書を起点とした行動を、どの対象・期間・ログ・識別子で検証するか、自分の言葉で書いてください。どんな記録なら別の説明になるかも含めます。';
f01.modelHypothesis = '対象3台の9月14〜16日について、文書アプリを親とするスクリプト実行と、その実行GUIDに対応する新しい外部通信があるかを調べる。前週および管理エージェントの定例実行と比較し、親・アカウント・業務条件が異なる候補を分ける。';
f02.hypothesisPrompt = '共通IPから一つの主体の移動を検証するために、何を同一性の根拠として使うか書いてください。反対の結果と、調査範囲外になる行動も考えます。';
f02.modelHypothesis = '対象3台の9月14〜16日について、同じアカウントが端末を移動した認証の連鎖があるかを調べる。共通IPだけで結合せず、端末ID・セッション・アカウント・発生時刻を通信と照合する。異なるセッションや共有プロキシで説明できる場合は分け、範囲外の操作まで否定しない。';
f03.hypothesisPrompt = '外部認証後のデータ取得を確かめるために、必要な証拠と取得できない場合の判断を書いてください。応答量だけから何を言えるかも分けます。';
f03.modelHypothesis = '9月14〜16日のsvc-exportの外部認証に続き、承認範囲外のオブジェクトが取得されたかを調べる。同じセッションの認証、通信、オブジェクト監査、承認資料を結ぶ。監査の保存期間や本文の欠落で対象物を特定できなければ、取得量や分類を推定せず不足と追加確認先を残す。';

// A second rare script launch has a concrete business explanation. The tool name
// and rarity are insufficient; the parent and approved work identify its role.
f01.logs.push(
  log('f01-r01','current','16','14:23:18','端末','WS-F1-03','kudo','プロセスの開始を記録','path="C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe" script="C:/Design/ExportPalette.ps1" signature=valid process_guid=7f1a9c62-8d40-4b15-b8e3-5ec072a13f60 parent_process_guid=4a732e18-19fc-45da-8912-b4e2ac9d603b pid=6840 parent_pid=6796 session_id=LOGIN-WS-F1-03-16',{process:'powershell.exe',parent:'excel.exe'}),
  log('f01-r02','current','16','13:12:43','業務','WS-F1-03','design-owner','帳票出力の承認票','change=DESIGN-223 status=approved target=WS-F1-03 account=kudo window_utc=2026-09-16T14:00/15:00 launcher=excel.exe program=powershell.exe script="C:/Design/ExportPalette.ps1" action=palette-export output=design-share.example')
);
f01.explanation.reasoning.push('設計端末の珍しいPowerShell起動は、Excelの帳票出力とDESIGN-223の条件で説明できます。道具名や頻度ではなく、親・スクリプト・利用者・時間を照合します。');
p01.rubric.evidenceGroups.push(group('良性の説明と比較した更新の実績','context','p01-r01','p01-r02'),group('更新ミラーの具体的な承認条件','context','p01-r03'));
p04.rubric.evidenceGroups.push(group('良性の説明と比較した臨時確認の実績','context','p04-r01'),group('臨時確認に適用する業務条件','context','p04-r02'));
f01.rubric.evidenceGroups.find(g=>g.anyOf.includes('f01-e02')).label='良性の説明と比較した定例実行';
f01.rubric.evidenceGroups.push(group('珍しい実行を説明する臨時作業の実績','context','f01-r01'),group('臨時帳票出力の適用条件','context','f01-r02'));
p01.guide[2].body += ' 比較例：source:通信 after:2026-09-14 before:2026-09-16 process:updater.exe OR source:通信 after:2026-09-14 before:2026-09-16 process:sync-agent.exe。ORの左右に共通の対象期間を指定すると、候補と比較対象を一緒に読めます。';
p01.explanation.sampleQuery='source:通信 after:2026-09-14 before:2026-09-16 process:updater.exe OR source:通信 after:2026-09-14 before:2026-09-16 process:sync-agent.exe';
p04.guide[1].body += ' 例：source:端末 after:2026-09-15 before:2026-09-16 process:user-sync.exe OR source:端末 after:2026-09-15 before:2026-09-16 process:verify.exe。検索結果で定義と実行先を照合する。';
p04.explanation.sampleQuery='source:端末 after:2026-09-15 before:2026-09-16 process:user-sync.exe OR source:端末 after:2026-09-15 before:2026-09-16 process:verify.exe';

// Extra evidence is authored, rather than accepting every row with an arbitrary
// role. Ordinary examples are allowed only where they establish the comparison
// or explain a plausible alternative candidate for this hunt.
function addExtras(task, selections) {
  const required = new Set(task.rubric.evidenceGroups.flatMap(item => item.anyOf));
  const entries = new Map();
  for (const { select, roles, reason } of selections) {
    for (const item of task.logs.filter(select)) {
      if (!required.has(item.id)) entries.set(item.id, { id: item.id, roles, reason });
    }
  }
  task.rubric.evidenceExtras = [...entries.values()];
}
const ids = (...values) => row => values.includes(row.id);
const extra = (select, roles, reason) => ({ select, roles, reason });
addExtras(p01, [
  extra(ids('p01-e03', 'p01-e04', 'p01-e05'), ['support'], '58〜63秒の間隔を確かめる中間の通信で、同じ実行GUIDに対応する。'),
  extra(ids('p01-e08'), ['context', 'support'], '同期プログラムの親の起動を確認できる。親の存在だけで通信の目的は決まらない。'),
  extra(ids('p01-r01', 'p01-r02', 'p01-r03'), ['context'], '別端末の更新ミラーと再試行を説明し、新しい宛先を一括で扱わないための比較材料。'),
  extra(row => row.id.startsWith('p01-n-') && row.destination === 'updates.example', ['context'], '両期間の既存UPDATE-DAILYの時刻と実行元を示す比較標本。')
]);
addExtras(p02, [
  extra(ids('p02-e05'), ['context'], '認証について確認できた期間と対象、操作内容までは含まない限界を示す。'),
  extra(row => row.id.startsWith('p02-n-') && row.user === 'svc-report' && row.event === '証明書認証を記録', ['context'], '同じsvc-reportの従来の端末・01:00の時間帯・証明書方式を各日の開始認証で比べる標本。'),
  extra(ids('p02-r01', 'p02-r02'), ['context'], '同週の証明書更新は別アカウントの作業であると区別するための対照資料。')
]);
addExtras(p03, [
  extra(ids('p03-r01', 'p03-r02'), ['context', 'counter'], '臨時診断で件数は増えるが実行場所は管理端末のままで、一般端末への広がりを示さない。'),
  extra(row => row.id.startsWith('p03-n-') && row.event === 'プロセスの開始を記録' && ['2026-09-08', '2026-09-15'].some(day => row.at.startsWith(day)), ['context'], '比較日の管理端末と一般端末について、収集された起動の種類と利用場所を比べる代表標本。')
]);
addExtras(p04, [
  extra(ids('p04-e04'), ['support', 'context'], '翌日の実行GUIDに続く通信を示す。内容や取得経路を確定するものではない。'),
  extra(ids('p04-r01', 'p04-r02'), ['context'], '同じバックアップ端末の別の確認処理を識別し、TASK-442と取り違えないための資料。'),
  extra(row => row.id.startsWith('p04-n-') && row.host === 'BACKUP-SRV-01', ['context'], '従来のDaily-バックアップの時刻・実行元・アカウントを示す比較標本。')
]);
addExtras(p05, [
  extra(ids('p05-r01', 'p05-r02', 'p05-r03'), ['context'], '前週の同じ宛先への確認用データを説明し、対象週の別申請と区別するための資料。'),
  extra(row => row.id.startsWith('p05-n-') && row.host === 'LEDGER-FS-01', ['context'], '経理ファイルサーバーの定例保管の量と宛先を示す比較標本。')
]);
addExtras(p06, [
  extra(ids('p06-e01', 'p06-e05'), ['context'], '欠落時間の前後・別期間には端末記録があると分かるが、10:32の実行元へは結合できない。'),
  extra(ids('p06-r01', 'p06-r02'), ['context'], '観測できる別時間・別宛先のポータル切替を説明し、10:32の通信とは分ける材料。'),
  extra(row => row.id.startsWith('p06-u-') && row.host === 'FIN-WS-01', ['context'], '既知のUPDATE-DAILYが12:00に別宛先へ通信することを示す比較標本。'),
  extra(row => row.id.startsWith('p06-n-') && row.source === '収集' && row.host === 'FIN-WS-01' && row.at.startsWith('2026-09-15'), ['context'], '欠落が生じた当日も認証・境界通信は受信していたことを示す、経路別の確認資料。')
]);
addExtras(f01, [
  extra(ids('f01-e03'), ['support', 'context'], 'F1-P87という親プロセスの起動と対象文書を示し、F1-P88の親GUIDと対応する。'),
  extra(ids('f01-e01'), ['context'], '前週にもある管理エージェントの棚卸実行を示す対照標本。'),
  extra(ids('f01-e07'), ['context'], '外部情報が何を観測したかを示す仮説の出典で、この環境の実行証拠とは区別する。'),
  extra(row => row.id.startsWith('f01-n-') && row.host === 'WS-F1-02' && row.source === '認証' && row.session === 'LOGIN-WS-F1-02-15', ['context'], 'F1-P87とF1-P88が属するログオンセッションの認証を示す。別時間のブラウザー起動とは結合しない。')
]);
addExtras(f02, [
  extra(ids('f02-e06', 'f02-e07', 'f02-e08'), ['context', 'counter'], '端末IDとセッションが各認証へ別々に対応し、共有IPだけで同一主体にまとめない根拠となる。'),
  extra(ids('f02-r01', 'f02-r02'), ['context'], '別日の単一端末への保守接続を説明し、対象の3台横断と区別するための資料。'),
  extra(row => row.id.startsWith('f02-n-') && row.source === '通信' && row.period === 'baseline', ['context'], '共有プロキシの値が前週にも現れる比較標本。')
]);
addExtras(f03, [
  extra(ids('f03-e05'), ['context'], '定例処理の承認条件と調査対象の時間・認証方式を比べる資料。'),
  extra(ids('f03-e06', 'f03-e07'), ['context'], '保存されている別日のオブジェクト標本で、欠落した対象セッションを復元する根拠ではない。'),
  extra(ids('f03-r01', 'f03-r02'), ['context'], '同じ応答量でも対象物はセッションごとに監査で確認する必要があることを示す比較資料。'),
  extra(row => row.id.startsWith('f03-n-') && row.host === 'CLOUD-F3-01' && row.source === '認証', ['context'], 'svc-exportが両期間の各日06:00に証明書で認証する通常パターンを示す標本。')
]);

p04.logs.find(row=>row.id==='p04-r02').detail=p04.logs.find(row=>row.id==='p04-r02').detail.replace('backup_completed_at=2026-09-15T04:05:00Z',`backup_completed_at=2026-09-15T${scheduledRun('BACKUP-SRV-01','15').end}Z`);
p01.alternativeExplanations = [
  {id:'update-date-boundary',label:'更新票の許可日と今回の通信の日付が異なり、変更作業の翌日に新しい同期先への通信が発生しているため、更新の説明を適用できない。'},
  {id:'update-scope-mismatch',label:'ミラー変更は営業端末のupdater.exeが対象であり、経理端末のsync-agent.exeと別の宛先へ適用できない。'},
  {id:'update-retry-count',label:'申請が許可した回数と実績の回数が一致せず、ミラー通信の再試行が上限を超えたことが、通常更新という説明から外れる理由になる。'}
];
p01.rubric.alternative='update-scope-mismatch';
p01.explanation.reasoning.push('良性の説明としてPATCH-919のミラー変更と再試行を検討した。実績はSALES-WS-01/updater.exe/mirror-updates.exampleで条件に一致するが、FIN-WS-01/sync-agent.exe/sync-node.exampleには端末・実行元・宛先が一致しない。');
p04.alternativeExplanations = [
  {id:'receipt-account-only',label:'受領確認はoperator-2で起動しているためsvc-backup向けの申請と一致せず、そのアカウントの違いが今回の追加起動を説明できない理由である。'},
  {id:'receipt-old-definition',label:'受領確認票の実行先と翌日の起動先が異なる。同じ定義IDでも旧版を使って起動しているため、同じ受領確認の再実行では説明できない。'},
  {id:'task-definition-mismatch',label:'承認済みの受領確認はsvc-backupによるverify.exeであり、利用者ログオン時にuser-sync.exeを起動する別定義の活動には一致しない。'}
];
p04.rubric.alternative='task-definition-mismatch';
p04.explanation.reasoning.push('良性のRETRY-91はBackupReceiptCheck/verify.exe/svc-backupという受領確認の実績に対応する。TASK-442はUserSyncTask/user-sync.exe/operator-2と利用者ログオンという別の条件を持つため、その票を適用できない。');
f01.alternativeExplanations = [
  {id:'parent-workflow-mismatch',label:'定例はinventory-agent.exe、臨時帳票はexcel.exeが親で、docview.exeからの実行に同じ作業条件は合わない。'},
  {id:'script-name-only',label:'定例手順が指定した文書はinvoice-reader.docxだが、今回の文書は別名である。この名前の不一致が、定例棚卸を適用できない理由になる。'},
  {id:'export-time-only',label:'DESIGN-223が許可した時間と今回の実行時刻が異なる。端末と親の条件は満たすものの、時間だけが臨時帳票の説明を適用できない理由になる。'}
];
f01.rubric.alternative='parent-workflow-mismatch';
f01.explanation.reasoning.push('良性の定例棚卸と臨時帳票もPowerShellを使うが、親・端末・アカウント・スクリプトが各申請に対応する。今回のdocview.exeを親とする実行にはその組み合わせが合わず、同じツール名だけでは承認を流用できない。');
const tasks=[p01,p02,p03,p04,p05,p06,f01,f02,f03];
for(const task of tasks)task.context += ' 本文・業務資料・模範解答の日付と時刻はUTCです。時刻の一致は同じ時間基準で比較し、現地の勤務時間帯は別資料で確認します。';
module.exports=tasks;
