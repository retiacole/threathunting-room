'use strict';

// Fictional, deliberately small teaching samples. No external input or runtime dependency.
const periods = {
  baseline: { from: '2026-09-07', to: '2026-09-09' },
  current: { from: '2026-09-14', to: '2026-09-16' },
};

function jitter(seed, span) { let n=2166136261; for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)%span; }
function log(id, day, time, period, source, host, user, event, detail, extra = {}) {
  let at = `2026-09-${String(day).padStart(2, '0')}T${time}Z`;
  const unscheduled = /^i01-c|^i03-c|^i04-[bc]-|^i05-[bc]\d-/.test(id) || /^i02-[bc]\d-(user|net)$/.test(id) || /^i06-[bc]\d-(day-auth|web1|web2|ws-auth)$/.test(id);
  // One deterministic offset for a host/day preserves related event ordering.
  if(unscheduled)at=new Date(Date.parse(at)+(jitter(`${host}-${day}`,1801)-900)*1000).toISOString().replace('.000Z','Z');
  const scheduledStart = /^i06-[bc]\d-(day-task|ops7)$/.test(id);
  const inventoryStep = /^i06-early-(auth|process|net)-/.test(id);
  if(scheduledStart || inventoryStep || id==='i06-backup-check') {
    const delay=2+jitter(`${id}-${day}-dispatch`,49);
    if(scheduledStart)detail += ' scheduled_start_utc=10:00:00';
    at=new Date(Date.parse(at)+delay*1000).toISOString().replace('.000Z','Z');
  }
  return { id, at, period, source, host, user, event, detail:detail.trim(), ...extra };
}

const sourceDescriptions = {
  '収集': '期間、取得項目、保存対象を示す架空の収集台帳です。イベント本文とは別に確認します。',
  '通信': '端末からの通信先、時刻、プロセスなどを記録した合成ログです。通信内容の全文はありません。',
  '認証': '利用者、端末、サインインの時刻と結果を記録した合成ログです。本人が操作したことまで保証する記録ではありません。',
  '端末': 'プロセス名、親プロセス、処理の概要を記録した合成ログです。端末内のすべての操作を含みません。',
  '業務': '作業予定や対象端末などの架空の管理記録です。実行ログと照合して利用します。',
  'ファイル': 'ファイルの取得などを記録した合成ログです。取得された内容が安全かどうかは、この記録だけでは分かりません。',
};
const sources = (...names) => names.map(name => ({ name, description: sourceDescriptions[name] }));

const i01Logs = [];
for (let day = 14; day <= 16; day++) {
  const n = day - 14;
  [
    ['WS-11', 'aoki', 'portal.example', '/home'],
    ['WS-12', 'kato', 'updates.example', '/catalog.json'],
    ['WS-13', 'sato', 'docs.example', '/team/guide'],
    ['WS-14', 'mori', 'helpdesk-updates.example', '/support/catalog.json'],
    ['WS-15', 'noda', 'mail.example', '/inbox'],
    ['WS-12', 'kato', 'helpdesk.example', '/search?q=helpdesk-updates.example'],
  ].forEach(([host, user, destination, path], j) => {
    const id = `i01-c${String(n * 6 + j + 1).padStart(2, '0')}`;
    i01Logs.push(log(id, day, `09:${String(j * 5).padStart(2, '0')}:00`, 'current', '通信', host, user, 'HTTPS要求', `method=GET scheme=https path=${path} status=200`, { destination, process: 'browser.exe', bytes: 1400 + j * 120, request_id: `REQ-${id}` }));
  });
}
i01Logs.push(log('i01-name-candidate', 15, '09:28:00', 'current', '通信', 'WS-16', 'abe', 'HTTPS要求', 'method=GET scheme=https path=/assets/logo.svg status=200', { destination: 'helpdesk-updates.example.cdn.example', process: 'browser.exe', bytes: 740, request_id: 'REQ-I01-CDN' }));

const i02Logs = [];
for (const [period, start] of [['baseline', 7], ['current', 14]]) {
  for (let d = 0; d < 3; d++) {
    const day = start + d;
    const p = period === 'baseline' ? 'b' : 'c';
    i02Logs.push(
      log(`i02-${p}${d}-job`, day, '00:10:00', period, '認証', 'JOB-01', 'svc-report', 'サービス認証成功', 'logon_type=service method=certificate result=success client=report-batch', { session: `REPORT-${day}-001`, request_id: `AUTH-REPORT-${day}` }),
      log(`i02-${p}${d}-user`, day, '09:05:00', period, '認証', 'WS-21', 'aoki', '対話認証成功', 'logon_type=interactive method=device-certificate result=success', { session: `AOKI-${day}-001` }),
      log(`i02-${p}${d}-net`, day, '09:08:00', period, '通信', 'WS-21', 'aoki', 'HTTPS要求', 'method=GET path=/home status=200', { destination: 'portal.example', process: 'browser.exe', bytes: 2200, session: `AOKI-${day}-001`, request_id: `WEB-I02-${day}` }),
      log(`i02-${p}${d}-plan`, day, '00:00:00', period, '業務', 'JOB-01', 'svc-report', 'ジョブ予定票', `job=report-batch owner=reporting-team date=2026-09-${String(day).padStart(2, '0')} start_utc=00:10 target=JOB-01 account=svc-report auth_method=certificate schedule=daily status=enabled`),
    );
  }
}

const i03Logs = [];
const i03Hosts = [
  ...Array(9).fill('WS-22'),
  ...Array(6).fill('WS-23'),
  ...Array(3).fill('WS-21'),
  ...Array(3).fill('WS-24'),
  ...Array(3).fill('WS-25'),
];
i03Hosts.forEach((host, j) => {
  const day = 14 + (j % 3);
  const id = `i03-c${String(j + 1).padStart(2, '0')}`;
  const user = { 'WS-21': 'aoki', 'WS-22': 'kato', 'WS-23': 'sato', 'WS-24': 'mori', 'WS-25': 'noda' }[host];
  let time = '10:15:00', detail = 'method=GET path=/catalog.json status=200 attempt=1', destination = 'client-updates.example', process = 'client-updater.exe', bytes = 1500;
  let request_id = `REQ-I03-${host}-${day}`;
  if (host === 'WS-22') {
    const attempt = Math.floor(j / 3) + 1;
    time = `10:0${attempt - 1}:00`;
    detail = `method=GET path=/catalog.json status=${attempt < 3 ? 503 : 200} attempt=${attempt} retry_reason=${attempt === 1 ? 'none' : 'prior_http_503'} job_id=UPDATE-${day}`;
    bytes = attempt < 3 ? 180 : 1500;
    request_id = `REQ-I03-RETRY-${day}-${attempt}`;
  } else if (host === 'WS-23') {
    const sequence = Math.floor((j - 9) / 3) + 1;
    time = `10:${sequence === 1 ? '05' : '10'}:00`;
    detail = `method=POST path=/session status=200 sequence=${sequence}`;
    destination = 'session-sync.example'; process = 'session-helper.exe'; bytes = 2800;
  } else if (host === 'WS-25' && day === 15) {
    detail = 'method=GET path=/bundles/root-ca.pem status=200 action=certificate-refresh';
    destination = 'certs.example'; bytes = 940;
  }
  i03Logs.push(log(id, day, time, 'current', '通信', host, user, 'HTTPS要求', detail, { destination, process, bytes, request_id }));
});

const i04Logs = [];
for (const [period, start] of [['baseline', 7], ['current', 14]]) {
  const p = period === 'baseline' ? 'b' : 'c';
  for (let d = 0; d < 3; d++) {
    for (const host of ['WS-31', 'WS-32', 'WS-33', 'WS-34']) {
      const count = period === 'current' && host === 'WS-32' ? 3 : 1;
      for (let j = 0; j < count; j++) {
        const id = `i04-${p}-${host}-${d}-${j}`;
        i04Logs.push(log(id, start + d, `11:${String(j * 10).padStart(2, '0')}:00`, period, 'ファイル', host, { 'WS-31': 'aoki', 'WS-32': 'kato', 'WS-33': 'sato', 'WS-34': 'mori' }[host], '資料取得', `action=read object=/shared/report-${d + 1}-${j + 1}.csv result=success bytes=8000`, { destination: 'files.example', process: 'report-client.exe', bytes: 8000, request_id: `FILE-${id}` }));
      }
    }
  }
}

const i05Logs = [];
for (let d = 0; d < 3; d++) {
  for (const [period, start] of [['baseline', 7], ['current', 14]]) {
    const day = start + d;
    const p = period === 'baseline' ? 'b' : 'c';
    i05Logs.push(
      log(`i05-${p}${d}-auth`, day, '08:30:00', period, '認証', 'WS-41', 'aoki', '対話認証成功', 'logon_type=interactive method=device-certificate result=success', { session: `AOKI-I05-${day}` }),
      log(`i05-${p}${d}-web`, day, '08:35:00', period, '通信', 'WS-41', 'aoki', 'HTTPS要求', 'method=GET path=/home status=200', { destination: 'portal.example', process: 'browser.exe', bytes: 3400, session: `AOKI-I05-${day}`, process_guid: `I05-W41-BROWSER-${day}`, request_id: `WEB-I05-W41-${day}` }),
      log(`i05-${p}${d}-proc`, day, '09:00:00', period, '端末', 'WS-43', 'sato', 'プロセス開始', 'image="C:/Program Files/AdminConsole/admin-console.exe" signature=valid', { process: 'admin-console.exe', parent: 'explorer.exe', pid: '6200', session: `SATO-I05-${day}`, process_guid: `I05-W43-ADMIN-${day}`, parent_process_guid: `I05-W43-EXPLORER-${day}` }),
      log(`i05-${p}${d}-update`, day, '09:10:00', period, '通信', 'WS-43', 'sato', 'HTTPS要求', 'method=GET path=/catalog.json status=200', { destination: 'console-updates.example', process: 'admin-console.exe', bytes: 1800, pid: '6200', session: `SATO-I05-${day}`, process_guid: `I05-W43-ADMIN-${day}`, request_id: `WEB-I05-W43-${day}` }),
    );
  }
}
i05Logs.push(
  log('i05-mori-auth', 15, '09:02:00', 'current', '認証', 'WS-42', 'mori', '対話認証成功', 'logon_type=interactive method=password result=success', { session: '0x248', request_id: 'AUTH-I05-MORI-15' }),
  log('i05-mori-doc', 15, '09:03:00', 'current', '端末', 'WS-42', 'mori', 'プロセス開始', 'image="C:/Program Files/Writer/writer.exe" document="C:/Users/mori/Downloads/notes.docx"', { process: 'writer.exe', parent: 'explorer.exe', pid: '4400', session: '0x248', process_guid: 'I05-W42-DOC-15', parent_process_guid: 'I05-W42-EXPLORER-15' }),
  log('i05-mori-shell', 15, '09:04:00', 'current', '端末', 'WS-42', 'mori', 'プロセス開始', 'image="C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe" parent_pid=4400 script_path="C:/Users/mori/AppData/Temp/document-task.ps1"', { process: 'powershell.exe', parent: 'writer.exe', pid: '4410', session: '0x248', process_guid: 'I05-W42-PS-15', parent_process_guid: 'I05-W42-DOC-15' }),
  log('i05-mori-net', 15, '09:05:00', 'current', '通信', 'WS-42', 'mori', 'HTTPS要求', 'method=POST path=/session status=200', { destination: 'sync-docs.example', process: 'powershell.exe', bytes: 6200, pid: '4410', session: '0x248', process_guid: 'I05-W42-PS-15', request_id: 'WEB-I05-MORI-15' }),
  log('i05-mori-other', 16, '13:30:00', 'current', '認証', 'WS-44', 'mori', '対話認証成功', 'logon_type=interactive method=device-certificate result=success', { session: '0x711', request_id: 'AUTH-I05-MORI-W44-16' }),
  log('i05-mori-other-net', 16, '13:32:00', 'current', '通信', 'WS-44', 'mori', 'HTTPS要求', 'method=GET path=/home status=200', { destination: 'portal.example', process: 'browser.exe', bytes: 3100, pid: '4410', session: '0x711', process_guid: 'I05-W44-BROWSER-16', request_id: 'WEB-I05-MORI-W44-16' }),
  log('i05-reuse-auth', 16, '14:00:00', 'current', '認証', 'WS-42', 'mori', '対話認証成功', 'logon_type=interactive method=device-certificate result=success', { session: '0x850', request_id: 'AUTH-I05-MORI-W42-16' }),
  log('i05-reuse-process', 16, '14:01:00', 'current', '端末', 'WS-42', 'mori', 'プロセス開始', 'image="C:/Program Files/Browser/browser.exe" command=open-portal', { process: 'browser.exe', parent: 'explorer.exe', pid: '4410', session: '0x850', process_guid: 'I05-W42-BROWSER-16', parent_process_guid: 'I05-W42-EXPLORER-16' }),
  log('i05-reuse-net', 16, '14:02:00', 'current', '通信', 'WS-42', 'mori', 'HTTPS要求', 'method=GET path=/home status=200', { destination: 'portal.example', process: 'browser.exe', bytes: 3100, pid: '4410', session: '0x850', process_guid: 'I05-W42-BROWSER-16', request_id: 'WEB-I05-MORI-W42-16' }),
);

const demoHash = '4a6f2c9d8e1b7a305c96e02f114857cab879dc03a461f7e5d25ab9086e3c1042';
const backupHash = '92b6c814c6571a3f90796bce012b5fd89d1d8f34c921da476c527bdcc8150f2a';
const i06Logs = [];
for (const [period, start] of [['baseline', 7], ['current', 14]]) {
  const p = period === 'baseline' ? 'b' : 'c';
  for (let d = 0; d < 3; d++) {
    const day = start + d;
    i06Logs.push(
      log(`i06-${p}${d}-day-auth`, day, '09:00:00', period, '認証', 'OPS-06', 'goto', '対話認証成功', 'logon_type=interactive method=device-certificate result=success', { session: `OPS6-GOTO-${day}` }),
      log(`i06-${p}${d}-day-task`, day, '10:00:00', period, '端末', 'OPS-06', 'svc-report', 'プロセス開始', 'script="C:/Program Files/Operations/daily-report.ps1" job=daily-report trigger=daily', { process: 'powershell.exe', parent: 'taskeng.exe', pid: '8100', session: `OPS6-REPORT-${day}`, process_guid: `I06-REPORT-${day}`, parent_process_guid: `I06-TASK-REPORT-${day}` }),
      log(`i06-${p}${d}-ops7`, day, '10:00:00', period, '端末', 'OPS-07', 'svc-backup', 'プロセス開始', 'image="C:/Program Files/Backup/backup-status.exe" job=daily-backup-status trigger=daily', { process: 'backup-status.exe', parent: 'services.exe', pid: '9000', session: `OPS7-BACKUP-${day}`, process_guid: `I06-BACKUP-${day}` }),
      log(`i06-${p}${d}-web1`, day, '09:10:00', period, '通信', 'WS-61', 'aoki', 'HTTPS要求', 'method=GET path=/home status=200', { destination: 'portal.example', process: 'browser.exe', bytes: 3200, request_id: `I06-W61-${day}` }),
      log(`i06-${p}${d}-web2`, day, '09:15:00', period, '通信', 'WS-62', 'sato', 'HTTPS要求', 'method=GET path=/team/guide status=200', { destination: 'docs.example', process: 'browser.exe', bytes: 5100, request_id: `I06-W62-${day}` }),
      log(`i06-${p}${d}-ws-auth`, day, '09:20:00', period, '認証', 'WS-63', 'mori', '対話認証成功', 'logon_type=interactive method=device-certificate result=success', { session: `I06-MORI-${day}` }),
    );
    if (period === 'current') {
      i06Logs.push(
        log(`i06-early-auth-${d}`, day, '06:30:00', period, '認証', 'OPS-06', 'svc-inventory', 'サービス認証成功', 'logon_type=service method=certificate result=success client=inventory-task', { session: `OPS6-INV-${day}`, request_id: `AUTH-I06-INV-${day}` }),
        log(`i06-early-process-${d}`, day, '06:31:00', period, '端末', 'OPS-06', 'svc-inventory', 'プロセス開始', `script="C:/Program Files/Operations/inventory.ps1" sha256=${demoHash} job_id=INV-${day}`, { process: 'powershell.exe', parent: 'taskeng.exe', pid: '8000', session: `OPS6-INV-${day}`, process_guid: `I06-INV-${day}`, parent_process_guid: `I06-TASK-INV-${day}` }),
        log(`i06-early-net-${d}`, day, '06:32:00', period, '通信', 'OPS-06', 'svc-inventory', 'HTTPS要求', `method=POST path=/inventory status=200 job_id=INV-${day} `, { destination: 'inventory.example', process: 'powershell.exe', bytes: 16000, pid: '8000', session: `OPS6-INV-${day}`, process_guid: `I06-INV-${day}`, request_id: `WEB-I06-INV-${day}` }),
      );
    }
  }
}
i06Logs.push(
  log('i06-approved-plan', 14, '06:00:00', 'current', '業務', 'OPS-06', 'svc-inventory', '作業承認票', `change_id=INV-0914 status=approved approver=ops-manager target=OPS-06 account=svc-inventory valid_from=2026-09-14 valid_to=2026-09-16 daily_window_utc=06:30/06:40 script="C:/Program Files/Operations/inventory.ps1" sha256=${demoHash} destination=inventory.example`),
  log('i06-backup-plan', 15, '10:50:00', 'current', '業務', 'OPS-07', 'svc-backup', '作業承認票', `change_id=BK-151 status=approved approver=backup-manager target=OPS-07 account=svc-backup window_utc=2026-09-15T11:00:00Z/2026-09-15T11:05:00Z script="C:/Program Files/Backup/backup-check.ps1" sha256=${backupHash} parent=backup-agent.exe`),
  log('i06-backup-check', 15, '11:01:00', 'current', '端末', 'OPS-07', 'svc-backup', 'プロセス開始', `script="C:/Program Files/Backup/backup-check.ps1" sha256=${backupHash} job_id=BK-151`, { process: 'powershell.exe', parent: 'backup-agent.exe', pid: '9010', session: 'OPS7-CHECK-15', process_guid: 'I06-BACKUP-CHECK-15', parent_process_guid: 'I06-BACKUP-AGENT-15' }),
);

i03Logs.push(log('i03-collection',14,'08:07:12','current','収集','WS-21','collector','通信の取得項目','sensor=proxy dataset=i03 retained=timestamp,host,user,process,destination,request_id,method,path,status,bytes retained_payload=false'));
i05Logs.push(log('i05-collection',14,'07:42:19','current','収集','WS-42','collector','相関用記録の取得項目','sensors=endpoint-process,endpoint-network fields=timestamp,host,user,session,pid,process_guid,parent_process_guid,request_id script_content=not_retained network_payload=not_retained'));
i06Logs.push(log('i06-collection',14,'05:47:23','current','収集','OPS-06','collector','棚卸し通信の取得項目','sensor=endpoint-network targets=OPS-06,OPS-07 retained=timestamp,host,process_guid,session,request_id,destination,path,status,bytes network_payload=not_retained receiver_job_status=not_collected'));

const extras = (ids, roles, reason) => ids.map(id => ({ id, roles, reason }));

const tasks = [
  {
    id: 'i01', level: 'intro', title: '通信先を手がかりに探す', subtitle: '検索結果の1行を読み、観測した事実を残す', minutes: '5–8', focus: 'ログ検索',
    brief: '引継メモに「helpdeskを含む通信を確認」とあります。まず候補を探し、正式な調査対象helpdesk-updates.exampleと通信先の値が一致する端末を確かめてください。',
    context: '期間は9月14日〜16日UTCです。検索語は通信先以外の項目や、似た名前にも含まれることがあります。ヒットした行をそのまま答えにせず、通信先の値を読む練習です。通信先の安全性を判定する課題ではありません。',
    periods, hypotheses: [], sources: sources('通信'), logs: i01Logs,
    guide: [
      { title: '候補を広く探す', body: '現在期間でhelpdeskを検索します。これは全体から語句を探す検索なので、通信先だけでなくURLのパスに含まれる語句もヒットします。', tab: 'logs' },
      { title: '値を確かめて絞る', body: '各行の通信先を読み、正式な名前helpdesk-updates.exampleと比べます。destination:helpdesk-updates.exampleは通信先に検索範囲を絞れますが部分一致です。後ろに別の名前が続く候補も区別してください。', tab: 'logs' },
      { title: '一致した行を根拠にする', body: '通信先の値が正式な名前と一致する行を1件、役割「支持」で追加します。ここで支持するのは「指定された通信先への記録がある」という事実です。', tab: 'logs' },
      { title: '見つけた端末を選ぶ', body: '報告欄で調査対象の端末を選び、答え合わせします。この課題では仮説・結論・総合報告は採点しません。', tab: 'report' },
    ],
    hints: ['ヒットした理由が通信先なのか、パスに含まれた文字なのかを確認します。', 'destination:helpdesk-updates.exampleでは4件が候補になります。末尾が.cdn.exampleの1件は正式な通信先とは別です。', '候補の通信先を先頭から末尾まで読み、依頼の値と一致する行を選びます。その行の端末と、何を支持する記録かを報告欄へ移します。'],
    findings: [],
    rubric: { targets: ['WS-14'], evidenceGroups: [{ label: '指定された通信先の記録', anyOf: ['i01-c04', 'i01-c10', 'i01-c16'], role: 'support' }], evidenceExtras: extras(['i01-c06', 'i01-c12', 'i01-c18', 'i01-name-candidate'], ['context'], '検索候補と通信先の値を比較し、対象から除いた記録。'), operations: ['search'] },
    explanation: {
      summary: 'WS-14から指定された通信先への通信が3件記録されています。',
      reasoning: ['helpdeskだけの検索では、helpdesk.exampleへの要求パスに含まれた文字も見つかります。通信先そのものが一致しているとは限りません。', 'destination:で検索対象の項目を限定しても部分一致です。helpdesk-updates.example.cdn.exampleという長い値は、正式な名前と異なります。', 'WS-14の3件は通信先の値が一致しています。これだけで侵害、送信内容、安全性を確定したわけではありません。'],
      next: '次は、何を確かめたいのかを仮説にし、必要なログを選びます。',
      sampleReport: '対象期間2026-09-14〜2026-09-16 UTCの合成通信ログで、WS-14からhelpdesk-updates.exampleへの通信を3件確認した。この記録だけでは通信の正当性は判断していない。',
    },
  },
  {
    id: 'i02', level: 'intro', title: '問いに合うログを選ぶ', subtitle: '確かめたい仮説と、必要なデータを結び付ける', minutes: '5–10', focus: '仮説とデータ',
    brief: 'svc-reportの夜間利用を点検します。予定された報告処理との関係を調べるための仮説と、照合に必要な2種類のデータを選んでください。',
    context: '夜間の認証には定期処理という説明も考えられます。認証ログだけでは「予定された作業か」は分かりません。ここでは結論を急がず、調査の問いとデータを対応させます。',
    periods,
    hypotheses: [
      { id: 'report-regeneration', label: '夜間認証の発生は、報告ファイルを再生成する処理に伴うものか' },
      { id: 'schedule-match', label: '夜間認証の端末と時刻は、予定された報告処理に一致しているか' },
      { id: 'interactive-work', label: '夜間認証の発生は、担当者が手動で行う対話型の作業によるものか' },
    ],
    legacy: { hypothesis: { h1: 'schedule-match', h2: '', h3: '' } },
    sources: sources('認証', '業務', '通信'), logs: i02Logs,
    guide: [
      { title: '問いを一つにする', body: '仮説の候補から、svc-reportの夜間利用と予定された処理との関係を確かめるものを選びます。', tab: 'plan' },
      { title: '事実と予定を別々に見る', body: '実際に誰が、どの端末で、いつ認証したかは認証ログで確認します。予定された端末や時刻は業務記録で確認します。', tab: 'logs' },
      { title: '調査の起点を保存する', body: '現在期間のsvc-reportの認証を一つ根拠に追加し、役割は「背景」にします。これは調査対象の利用を示す起点です。正当性の結論ではありません。', tab: 'logs' },
      { title: '必要なデータを記録する', body: '報告欄のデータ種別で認証と業務を選びます。この課題は仮説・必要なデータ・起点の根拠を採点します。', tab: 'report' },
    ],
    hints: ['いずれも夜間認証に関係する問いですが、今回は予定の端末・時刻との照合が目的です。', '認証の事実には認証ログ、予定との照合には業務の記録が必要です。ファイル再生成を調べるには別の記録が必要になります。', '問いの「予定との一致」を確かめるため、観測した事実と予定をそれぞれ示す資料を探します。最初の認証は、結論の証拠ではなく調査を始める起点です。'],
    findings: [],
    rubric: { hypotheses: ['schedule-match'], sources: ['認証', '業務'], evidenceGroups: [{ label: '調査の起点となる認証', anyOf: ['i02-c0-job', 'i02-c1-job', 'i02-c2-job'], role: 'context' }], evidenceExtras: [
      ...extras(['i02-c0-plan', 'i02-c1-plan', 'i02-c2-plan'], ['context', 'support'], '対象週の端末・アカウント・時刻を照合できる予定票。'),
      ...extras(['i02-b0-job', 'i02-b1-job', 'i02-b2-job', 'i02-b0-plan', 'i02-b1-plan', 'i02-b2-plan'], ['context'], '夜間の定期処理が比較期間にも記録されていることを示す背景。'),
    ] },
    explanation: {
      summary: '認証の事実と業務予定を照合できる仮説・データを選びます。',
      reasoning: ['svc-reportのJOB-01での00:10 UTCの認証は、夜間利用を調べる起点になります。', '業務記録には対象端末・アカウント・予定時刻があります。予定だけで実行を証明したり、認証だけで作業を承認済みと判断したりしません。', 'ファイル再生成や担当者の手動処理も調査の問いにはなりますが、今回の依頼は定期予定との照合です。問いに応じて必要なデータが変わります。'],
      next: '必要なデータが決まったら、件数を集計して調べる対象を絞ります。',
      sampleReport: 'svc-reportの夜間認証が予定された報告処理と一致するかを調べる。認証ログで端末・時刻を確認し、業務記録の予定と照合する。起点としてJOB-01の00:10 UTCの認証を保存した。',
    },
  },
  {
    id: 'i03', level: 'intro', title: '件数の順位から一歩進む', subtitle: '多い理由を確認し、次の候補を選ぶ', minutes: '8–12', focus: '集計',
    brief: '現在期間の通信を端末別に集計してください。上位の記録を読み、既知の更新処理で件数を説明できるものを分けたうえで、次に実行元を詳しく確認する端末を選びます。',
    context: '全24件を1行1件として数えます。既知の更新処理はclient-updater.exeからclient-updates.exampleへの問い合わせです。certs.exampleからの証明書更新もその処理に含まれます。ほかのプログラムの役割はこの業務メモには記載されていません。',
    periods, hypotheses: [], sources: sources('通信','収集'), logs: i03Logs,
    legacy: { targets: { 'WS-22': '' } },
    guide: [
      { title: '端末ごとに数える', body: 'ログ検索の条件を解除し、種類を通信にして現在期間の全通信を表示します。集計タブで項目を「端末」にして実行し、上位の端末を確認します。', tab: 'aggregate' },
      { title: '最多の理由を読む', body: '最多の端末をクリックして記録へ進みます。status=503はサーバーが一時的に処理できなかった応答、attemptは試行回数です。同じjob_idで再試行後に200となった記録を「反証」として残します。件数だけで調査先を決める考えへの反証です。', tab: 'logs' },
      { title: '次の候補を確かめる', body: '条件を解除してもう一度集計し、次に件数の多い端末を調べます。実行プロセスと通信先が既知の更新処理に合うか確認し、追加確認したい行を「支持」で保存します。', tab: 'aggregate' },
      { title: '追加確認する端末を選ぶ', body: '報告欄では、更新再試行で説明できた最多端末ではなく、次に実行元を詳しく確認する端末を選びます。攻撃を確定する判定はまだ行いません。', tab: 'report' },
    ],
    hints: ['件数は9・6・3・3・3です。多さと、処理が説明できるかを別々に考えます。', '上位の各端末を開き、同じジョブの再試行で件数を説明できるか確認します。次の候補は、プロセスと宛先を既知の処理と比べます。', '最多の理由を説明する一連の応答と、次の候補の実行元を比べます。件数だけの判断を見直す根拠と、追加調査に進む根拠をそれぞれ選びます。'],
    findings: [],
    rubric: {
      targets: ['WS-23'],
      evidenceGroups: [
        { label: '最多の件数を説明する更新再試行', anyOf: ['i03-c07', 'i03-c08', 'i03-c09'], role: 'counter' },
        { label: '次に実行元を確認する通信', anyOf: ['i03-c10', 'i03-c11', 'i03-c12', 'i03-c13', 'i03-c14', 'i03-c15'], role: 'support' },
      ],
      evidenceExtras: [
        ...extras(['i03-collection'], ['context'], '通信の件数・結果・実行元と、保存しない本文の範囲。'),
        ...extras(['i03-c01', 'i03-c02', 'i03-c03', 'i03-c04', 'i03-c05', 'i03-c06'], ['context'], '同じ更新ジョブのHTTP503と再試行の経過を示す背景。'),
        ...extras(['i03-c16', 'i03-c17', 'i03-c18', 'i03-c19', 'i03-c20', 'i03-c21', 'i03-c22', 'i03-c23', 'i03-c24'], ['context'], '既知の更新処理や証明書更新との比較材料。'),
      ],
      operations: ['aggregate'],
    },
    explanation: {
      summary: '最多のWS-22は更新の再試行で件数を説明できます。次候補のWS-23は別の実行元で、追加確認する対象です。',
      reasoning: ['WS-22は9件、WS-23は6件、残り3端末は各3件です。WS-22では各日のUPDATEジョブがHTTP503を2回受け、3回目に200を得ています。', 'WS-22の多さは既知の更新処理の再試行によるものです。この説明があることと、端末全体が安全であることは同じではありません。', 'WS-23のsession-helper.exeからsession-sync.exampleへの通信は、提示された既知の更新条件とは異なります。プログラムの用途・配布経路を確認する理由になりますが、悪意を証明していません。', '1件だけ現れるcerts.exampleへの通信も既知の証明書更新です。少ないことや珍しいことだけでも危険とは判断しません。', '基準期間のログは収録していないため、普段より増えたという判断はできません。'],
      next: '次は同じ長さの基準期間を用意し、件数の変化を比べます。',
      sampleReport: '現在期間の通信24件を集計した。WS-22が9件で最多だが、既知の更新ジョブの503応答後の再試行で説明できる。次のWS-23は6件で、既知の更新とは別のsession-helper.exeが使われているため実行元を追加確認する。悪意や普段との差は未判断。',
    },
  },
  {
    id: 'i04', level: 'intro', title: '前の期間と比べる', subtitle: '同じ長さの期間で変化を確かめる', minutes: '8–12', focus: '比較',
    brief: '基準期間と現在期間の資料取得ログを端末別に比較し、記録件数が増えた端末を探してください。両方の期間から1件ずつ根拠を残します。',
    context: '両期間は月曜〜水曜の3日間です。教材では同じ範囲を収録した合成サンプルとして比較します。現実の調査では休日、業務量、収集条件の違いも確認します。',
    periods, hypotheses: [], sources: sources('ファイル'), logs: i04Logs,
    guide: [
      { title: '比較条件をそろえる', body: '基準は9月7日〜9日、現在は9月14日〜16日です。両方とも3日間で、資料取得の記録を数えます。', tab: 'compare' },
      { title: '差を確認する', body: '比較項目を端末、データ種別をファイルにして比較を実行します。現在の件数だけでなく、基準の件数と差も読みます。', tab: 'compare' },
      { title: '両期間の根拠を残す', body: '増えた端末の基準期間の行を「背景」、現在期間の行を「支持」で保存します。ログ表示の期間を切り替えて確認できます。', tab: 'logs' },
      { title: '変化と判断を分ける', body: '報告欄で増えた端末を選びます。作業量の増加か不正利用かの結論は、この課題では求めません。', tab: 'report' },
    ],
    hints: ['差が0でない端末を探します。今回、減った端末はありません。', '比較表の差分が大きい候補へ進み、取得対象と記録の種類が両期間で同じかを確認します。', '差が大きい候補について、同じ種類の取得を両期間から一つずつ選びます。前週を比較の背景、今回の変化を調査の起点として使います。'],
    findings: [],
    rubric: { targets: ['WS-32'], evidenceGroups: [
      { label: '基準期間の資料取得', anyOf: [0, 1, 2].map(d => `i04-b-WS-32-${d}-0`), role: 'context' },
      { label: '現在期間の資料取得', anyOf: [0, 1, 2].flatMap(d => [0, 1, 2].map(j => `i04-c-WS-32-${d}-${j}`)), role: 'support' },
    ], evidenceExtras: extras(i04Logs.filter(l => l.host !== 'WS-32').map(l => l.id), ['context'], '比較した他端末の取得記録。母集団と期間の対応を示す材料。'), operations: ['compare'] },
    explanation: {
      summary: 'WS-32の資料取得は3件から9件に増え、差は6件です。',
      reasoning: ['WS-31・WS-33・WS-34は各期間3件です。WS-32だけが増加しています。', '3倍という値は、この教材の3件と9件の比です。これだけで異常や大量持ち出しと判断しません。', '保存した個別ログは両期間の記録を示します。総件数は比較結果で確かめる必要があります。'],
      next: '変化が見つかった対象を軸に、別の種類のログへ調査を広げます。',
      sampleReport: '同じ長さの2期間で資料取得を比較した。WS-32は基準3件、現在9件で6件増加した。業務量や取得内容を収録していないため、増加理由は未判断。',
    },
  },
  {
    id: 'i05', level: 'intro', title: '同じ端末を別のログで追う', subtitle: '認証から端末操作、通信へ調査をつなぐ', minutes: '10–15', focus: '横断追跡',
    brief: '9月15日09:02 UTCのmoriのサインインを起点に、その端末の後続記録を追ってください。起点の認証、後続のプロセス開始、それに対応する通信を根拠に残します。',
    context: '同じユーザー名やPIDが、別の日・別の端末にも現れます。PIDは再利用される番号です。端末・時刻・セッションと、実行ごとに付けられたProcessGuidを組み合わせて、別の操作を混ぜないようにします。',
    periods, hypotheses: [], sources: sources('認証', '端末', '通信', '収集'), logs: i05Logs,
    guide: [
      { title: '起点の認証を探す', body: '現在期間でuser:moriを検索し、9月15日09:02 UTCの認証を確認します。翌日の別端末の利用と区別します。', tab: 'logs' },
      { title: '端末を軸に広げる', body: '起点で見つけた端末から関連ログへ移動します。データ種別の絞り込みを解除すると、その端末の認証・端末・通信を一緒に確認できます。', tab: 'logs' },
      { title: '順番と識別子を読む', body: '時系列で認証、文書アプリ、子プロセス、通信を読みます。子プロセスのParentProcessGuidが文書アプリのProcessGuidに一致し、その子プロセスのProcessGuidが通信にもあることを確認します。翌日のPIDだけが一致する記録とは別です。', tab: 'timeline' },
      { title: '根拠を3件残す', body: '起点の認証を「背景」、09:04 UTCのプロセス開始と対応する09:05 UTCの通信を「支持」で保存します。報告欄では追跡した端末を選びます。', tab: 'report' },
    ],
    hints: ['9月15日の起点はWS-42・セッション0x248です。翌日のWS-44や、WS-42のセッション0x850とは別です。', '9月15日の子プロセスと通信はProcessGuid=I05-W42-PS-15で一致します。翌日のPID 4410には別のProcessGuidが付いています。', '認証の端末・セッションから実行へ、実行GUIDから通信へと二段階で照合します。同じ利用者やPIDでも、別日時の記録を連結していないか確認します。'],
    findings: [],
    rubric: { targets: ['WS-42'], evidenceGroups: [
      { label: '追跡の起点となる認証', anyOf: ['i05-mori-auth'], role: 'context' },
      { label: '認証と通信をつなぐプロセス開始', anyOf: ['i05-mori-shell'], role: 'support' },
      { label: '同じ端末・プロセスの後続通信', anyOf: ['i05-mori-net'], role: 'support' },
    ], evidenceExtras: [
      ...extras(['i05-collection'], ['context'], '実行と通信を相関できる項目、保存しない本文の範囲。'),
      ...extras(['i05-mori-doc'], ['support', 'context'], 'ParentProcessGuidから親として照合できる文書アプリの開始。'),
      ...extras(['i05-mori-other', 'i05-mori-other-net', 'i05-reuse-auth', 'i05-reuse-process', 'i05-reuse-net'], ['context', 'counter'], '同じユーザー名やPIDでも、別端末・別セッション・別ProcessGuidになる比較材料。'),
    ], operations: ['pivot'] },
    explanation: {
      summary: 'WS-42の認証後の操作と通信を、同じ端末と識別子で追跡できます。',
      reasoning: ['9月15日の認証・文書アプリ・子プロセスはWS-42のセッション0x248です。文書アプリのProcessGuid=I05-W42-DOC-15が子プロセスのParentProcessGuidに一致します。', '子プロセスと09:05 UTCの通信はProcessGuid=I05-W42-PS-15で一致します。PID 4410や時刻の近さだけを根拠に結び付けていません。', '9月16日のWS-42ではPID 4410がbrowser.exeに再利用されています。セッション0x850とProcessGuid=I05-W42-BROWSER-16は前日と異なり、前日の通信の続きではありません。', '文書アプリからのスクリプト実行は追加確認の理由になりますが、スクリプト本文や通信内容は未収録です。この課題では攻撃を確定しません。'],
      next: '最後に、観測した内容と業務記録を照合し、範囲と限界を含めた報告を作ります。',
      sampleReport: '9月15日09:02 UTC、WS-42のセッション0x248を起点に追跡した。文書アプリの子プロセスと09:05の通信はProcessGuid=I05-W42-PS-15で一致する。翌日のPID 4410は別セッション・別ProcessGuidのブラウザー実行として除いた。スクリプト本文と送信内容は未確認。',
    },
  },
  {
    id: 'i06', level: 'intro', title: '根拠をそろえて報告する', subtitle: '変化、業務予定、観測の限界を一つにまとめる', minutes: '15–20', focus: '報告',
    brief: 'OPS-06の早朝の管理スクリプト利用を調べます。前の期間との差を確認し、作業予定・実行内容・通信先を照合して、対象期間の判断を報告してください。',
    context: '管理スクリプトには正当な用途もあります。今回の問いは、早朝の実行が予定外の管理操作に当たるかです。仮説を選び、仮説に合わない証拠も残してください。',
    periods,
    hypotheses: [
      { id: 'daily-time-shift', label: 'OPS-06の日中の報告処理が、早朝へ時刻変更されているか' },
      { id: 'inventory-spread', label: '早朝の棚卸し処理が、OPS-07を含む複数端末へ追加されているか' },
      { id: 'unplanned-admin', label: 'OPS-06の早朝の追加実行が、承認範囲外の管理操作に当たるか' },
    ],
    legacy: {
      hypothesis: { h1: 'unplanned-admin', h2: '', h3: '' },
      finding: { 'limit-scope': 'scoped-recheck', 'limit-safe': '', 'limit-all': '' },
    },
    sources: sources('端末', '認証', '通信', '業務', '収集'), logs: i06Logs,
    guide: [
      { title: '仮説と期間を定める', body: '早朝の管理操作についての仮説を選びます。現在期間は9月14日〜16日、比較基準は9月7日〜9日、どちらもUTCです。', tab: 'plan' },
      { title: '現在の件数を集計する', body: 'まず「ログ検索」でログの種類を「端末」、期間を「今回の調査期間」にします。次に「集計」タブで項目を「端末」にして実行します。現在期間のOPS-06のプロセス開始は6件です。', tab: 'logs' },
      { title: '前の期間と比較する', body: '比較でもデータ種別を端末、比較項目を端末にして実行します。OPS-06のプロセス開始が基準3件から現在6件に増えています。', tab: 'compare' },
      { title: '対象端末を横断して読む', body: 'host:OPS-06で検索し、端末を軸に関連ログへ移動します。業務の申請と、06:30〜06:40 UTCの承認窓にある認証・実行・通信を照合します。', tab: 'logs' },
      { title: '反証も根拠にする', body: '承認済み申請を「背景」で保存します。申請と一致するスクリプト実行と通信を「反証」で保存します。反証は「予定外の操作」という仮説を弱める記録です。', tab: 'logs' },
      { title: '範囲と限界を添える', body: '対象端末、結論、使ったデータ、現在期間の日付、適切な限界を選びます。自由記述には観測事実と判断を短くまとめます。文章の内容そのものは自動採点しません。', tab: 'report' },
    ],
    hints: ['PowerShellという名前だけで結論せず、早朝の追加実行が承認範囲に含まれるか、端末・アカウント・時刻・スクリプト・通信先を比べます。', 'INV-0914は毎日06:30〜06:40 UTCの棚卸しを承認しています。OPS-07の11時台のPowerShellは別のバックアップ確認で、同じ棚卸しの広がりではありません。', '追加実行の端末・時間・スクリプト・宛先を承認票の条件に一つずつ対応させます。その一致が仮説を強めるか弱めるかと、まだ確認できない処理結果を区別します。'],
    findings: [
      { id: 'payload-first', label: '送信本文がない点を残し、申請の端末・時間との照合より本文の復元を先に進める' },
      { id: 'scoped-recheck', label: '一致した端末・期間・スクリプト・宛先を一つの作業としてまとめ、次回も同じ条件で照合する' },
      { id: 'hash-only-exception', label: '同じハッシュの実行を通常例として残し、実行者や時刻の違いは別途まとめて点検する' },
    ],
    rubric: {
      hypotheses: ['unplanned-admin'], targets: ['OPS-06'], verdict: 'benign', sources: ['業務', '端末', '通信'], scope: true, finding: 'scoped-recheck',
      evidenceGroups: [
        { label: '承認された作業の条件', anyOf: ['i06-approved-plan'], role: 'context' },
        { label: '申請と一致する実行内容', anyOf: ['i06-early-process-0', 'i06-early-process-1', 'i06-early-process-2'], role: 'counter' },
        { label: '申請と一致する送信先', anyOf: ['i06-early-net-0', 'i06-early-net-1', 'i06-early-net-2'], role: 'counter' },
      ],
      evidenceExtras: [
        ...extras(['i06-collection'], ['context'], '通信先との一致を確認できる一方、受信処理の完了は取得しない収集範囲。'),
        ...extras(['i06-early-auth-0', 'i06-early-auth-1', 'i06-early-auth-2'], ['context', 'counter'], '申請された実行者・時刻・サービス認証と一致し、実行のセッションを照合できる。'),
        ...extras(i06Logs.filter(l => l.host === 'OPS-06' && l.id.includes('-day-task')).map(l => l.id), ['context'], '日中の報告処理が両期間にあり、早朝の追加処理とは別だと分かる。'),
        ...extras(['i06-backup-plan', 'i06-backup-check'], ['context', 'counter'], '別端末の珍しいPowerShell実行を、別の承認済みバックアップ作業として区別する材料。'),
      ],
      operations: ['search', 'aggregate', 'compare', 'pivot'],
    },
    explanation: {
      summary: '収録された早朝の利用は承認済みの棚卸し作業と一致し、この対象期間では正当な利用として説明できます。',
      reasoning: ['OPS-06の端末ログは基準期間3件、現在期間6件です。日中のdaily-report.ps1はそのまま続き、各日06:31台 UTCのinventory.ps1が追加されています。', 'INV-0914と対象端末・アカウント・時刻・スクリプト名・ハッシュ・通信先が一致します。実行と通信は同じセッション・ProcessGuidでも照合できます。', 'OPS-07にも対象週だけのPowerShell実行がありますが、BK-151で承認された11時台のbackup-check.ps1です。珍しい実行を一律に同じ事案へまとめません。', '申請と一致する実行・通信は「承認範囲外の管理操作」という仮説への反証です。この説明ができたことと、すべての処理の安全性を認定することは別です。', '判断は期間と収録範囲に限ります。将来の例外化ではハッシュ一項目だけでなく、端末・アカウント・時間・送信先を含む承認条件を保ちます。受信側の処理結果や送信本文は未確認です。'],
      next: '演習では、正当な説明が付く場合、追加調査が必要な場合、ログ不足で判断できない場合を区別して進めます。',
      sampleReport: '2026-09-14〜2026-09-16 UTCのOPS-06を調査した。端末のプロセス開始は基準3件から現在6件に増えた。増加分は申請INV-0914の端末・実行者・時刻・スクリプトハッシュ・送信先と一致するため、収録範囲では承認された棚卸し作業として説明できる。判断は対象期間と収録ログに限り、作業条件の変更時は再確認する。',
    },
  },
];

const traceLesson=tasks.find(t=>t.id==='i05');
traceLesson.guide.splice(2,0,{title:'二つの種類を同じ日に並べる',body:'ORは左右どちらかに合う記録を探します。例：host:WS-42 after:2026-09-15 before:2026-09-15 source:端末 OR host:WS-42 after:2026-09-15 before:2026-09-15 source:通信。日付は両端を含むUTCで、ORの左右に対象と日付を繰り返します。時刻だけで結合せず、GUIDも照合します。',tab:'logs'});
traceLesson.explanation.sampleQuery='host:WS-42 after:2026-09-15 before:2026-09-15 source:端末 OR host:WS-42 after:2026-09-15 before:2026-09-15 source:通信';
for(const task of tasks)task.context += ' 本文・資料・模範解答の日付と時刻はUTCです。早朝・夜間という表現もUTC上の時間帯を指し、現地の勤務時間帯を表すものではありません。';
module.exports=tasks;
