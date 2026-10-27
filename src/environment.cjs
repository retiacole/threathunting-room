'use strict';

// Authoring-time deterministic fixtures. Their clock values are local JST;
// the temporary Z suffix is converted once to native UTC by the catalog's
// shiftAonagiRecord boundary. Dates and IDs use the local business calendar.
// No external services or runtime fetches.
const { createHash } = require('node:crypto');
const digest = text => createHash('sha256').update(text).digest('hex');
const guid = text => {
  const value = digest(text);
  return `{${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}}`;
};
const periods = {
  baseline: { from: '2026-09-07', to: '2026-09-09', timezone: 'Asia/Tokyo' },
  current: { from: '2026-09-14', to: '2026-09-16', timezone: 'Asia/Tokyo' }
};
const definitions = [
  ['SALES-WS-01', 'Windows 11', '営業端末', 'aoki', '中'],
  ['SALES-WS-02', 'Windows 11', '営業端末', 'nakamura', '中'],
  ['SALES-WS-03', 'Windows 11', '営業端末', 'ono', '中'],
  ['FIN-WS-01', 'Windows 11', '経理端末', 'mori', '高'],
  ['FIN-WS-02', 'Windows 11', '経理端末', 'ikeda', '高'],
  ['FIN-WS-03', 'Windows 11', '経理端末', 'abe', '高'],
  ['DESIGN-WS-01', 'Windows 11', '設計端末', 'kudo', '高'],
  ['DESIGN-WS-02', 'Windows 11', '設計端末', 'nishi', '高'],
  ['DESIGN-WS-03', 'Windows 11', '設計端末', 'suga', '高'],
  ['DEV-WS-01', 'Ubuntu 24.04', 'Linux開発端末', 'yui', '中'],
  ['DEV-WS-02', 'Ubuntu 24.04', 'Linux開発端末', 'rei', '中'],
  ['DEV-WS-03', 'Windows 11', 'Windows開発端末', 'rin', '中'],
  ['IT-ADM-01', 'Windows 11', '管理専用端末', 'ops-admin', '高'],
  ['REMOTE-WS-01', 'Windows 11', '社外貸出端末', 'haya', '中'],
  ['KIOSK-WS-01', 'Windows 11', '受付端末', 'reception', '低'],
  ['IDP-SRV-01', 'Windows Server 2022', '認証サーバー', 'svc-idp', '高'],
  ['FILE-SRV-01', 'Windows Server 2022', 'ファイルサーバー', 'svc-file', '高'],
  ['BUILD-SRV-01', 'Ubuntu 24.04', '継続ビルドサーバー', 'svc-build', '高'],
  ['WEB-SRV-01', 'Ubuntu 24.04', '社外Webサーバー', 'svc-web', '高'],
  ['BACKUP-SRV-01', 'Ubuntu 24.04', 'バックアップサーバー', 'svc-backup', '高']
];
const assets = definitions.map(([host, os, role, owner, criticality]) => ({
  id: `asset-${host.toLowerCase()}`, host, device_id: `dev-${host.toLowerCase()}`,
  os, role, owner, criticality,
  category: host.includes('-SRV-') ? 'server' : 'workstation'
}));
const assetMap = new Map(assets.map(asset => [asset.host, asset]));
const sources = [
  { name: '認証', description: 'Windows Security、IdP、Linux auth.logの合成記録。認証を記録したセンサーと対象資産を区別する。' },
  { name: '端末', description: 'win-edrのプロセス開始と、明示したLinux auditd・cron/key監査。Linux認証だけからProcessGuidを補わない。' },
  { name: '通信', description: '境界フロー、プロキシ、端末接続、ジョブの自己記録。sensorごとに取得項目と観測位置が異なる。' },
  { name: 'ファイル', description: 'ファイル作成・隔離・オブジェクト操作など、各センサーが実際に取得した操作。未収集の内容は推定しない。' },
  { name: '業務', description: '資産台帳と承認された作業の対象・期間・方法。実際のイベントとの照合に用いる。' },
  { name: '収集', description: 'センサー、対象資産、期間、保持項目、欠落と復元可否を示す資料。' }
];
function keyValues(text) {
  const values = {};
  const pattern = /([A-Za-z_][A-Za-z0-9_-]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
  let match;
  while ((match = pattern.exec(text || ''))) values[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  return values;
}
function winPath(value) { return value ? String(value).replaceAll('/', '\\') : '-'; }
function quoted(value) { return `"${String(value ?? '-').replaceAll('"', '\\"')}"`; }
function schema(fields) { return fields.map(([key, value]) => `${key}=${/[\s\\"]/.test(String(value ?? '-')) ? quoted(value) : value ?? '-'}`).join(' '); }
// One rendering contract per sensor. Only native fields already present on the
// record or in its original key/value payload are promoted to indexed fields.
// This is also exported for the catalog's independently authored ops records.
function normalizeLog(input) {
  const row = { ...input };
  const values = keyValues(row.detail);
  const value = (...keys) => keys.map(key => values[key.toLowerCase()]).find(item => item !== undefined && item !== '-');
  const sensor = row.sensor || row.provenance?.sensor || value('sensor');
  if (!sensor) return row;
  row.sensor = sensor;
  row.provenance = { ...(typeof row.provenance === 'object' ? row.provenance : {}), kind: 'synthetic', sensor, collectionId: `collection-${row.host.toLowerCase()}` };
  const setObserved = (field, ...keys) => { if (row[field] === undefined) { const observed = value(...keys); if (observed !== undefined) row[field] = observed; } };
  if (sensor === 'idp-auth') {
    setObserved('session', 'session', 'session_id');
    setObserved('request_id', 'request_id');
    row.detail = schema([
      ['event_time', row.at], ['event_id', value('event_id')], ['account', row.user || value('account')],
      ['method', value('method')], ['src', value('src', 'source_ip')], ['result', value('result')],
      ['session', row.session], ['request_id', row.request_id], ['application', value('application')],
      ['resource', value('resource')], ['device_claim', value('device_claim')], ['logon_type', value('logon_type')]
    ]);
    row.raw = row.raw || input.detail;
  } else if (sensor === 'windows-security') {
    setObserved('session', 'TargetLogonId', 'logon_id', 'session', 'session_id');
    row.logon_type = row.logon_type ?? value('LogonType', 'logon_type');
    row.src = row.src ?? value('IpAddress', 'src', 'source_ip');
    row.workstation = row.workstation ?? value('WorkstationName', 'SourceWorkstation', 'source_device', 'workstation');
    row.detail = schema([
      ['EventID', value('EventID', 'event_id')], ['UtcTime', row.at], ['Computer', row.host],
      ['TargetUserName', row.user], ['TargetDomainName', value('TargetDomainName')],
      ['LogonType', row.logon_type], ['WorkstationName', row.workstation], ['IpAddress', row.src],
      ['TargetLogonId', row.session], ['AuthenticationPackageName', value('AuthenticationPackageName', 'method') || '-']
    ]);
  } else if (sensor === 'win-edr') {
    setObserved('process_guid', 'ProcessGuid', 'process_guid');
    setObserved('parent_process_guid', 'ParentProcessGuid', 'parent_process_guid');
    setObserved('pid', 'ProcessId', 'pid'); setObserved('parent_pid', 'ParentProcessId', 'parent_pid', 'ppid');
    setObserved('session', 'LogonId', 'session', 'session_id');
    setObserved('hash', 'SHA256', 'sha256', 'hash');
    row.image = row.image || value('Image', 'image', 'path') || row.process;
    row.parent_image = row.parent_image || value('ParentImage', 'parent_image', 'parent_path') || row.parent;
    if (!row.process && row.image) row.process = row.image.split(/[\\/]/).pop();
    if (!row.parent && row.parent_image) row.parent = row.parent_image.split(/[\\/]/).pop();
    row.detail = schema([
      ['UtcTime', row.at], ['Computer', row.host], ['Image', winPath(row.image || row.process)],
      ['ParentImage', winPath(row.parent_image || row.parent)], ['ProcessGuid', row.process_guid],
      ['ParentProcessGuid', row.parent_process_guid], ['ProcessId', row.pid], ['ParentProcessId', row.parent_pid],
      ['User', row.user], ['LogonId', row.session], ['Hashes', row.hash ? `SHA256=${row.hash}` : value('Hashes')],
      ['CommandLine', value('CommandLine', 'command', 'command_line')], ['ScriptPath', winPath(value('ScriptPath', 'Script', 'script'))],
      ['DocumentPath', winPath(value('DocumentPath', 'document'))], ['SignatureStatus', value('SignatureStatus', 'signature')],
      ['Publisher', value('Publisher', 'publisher')], ['Operator', value('Operator', 'operator')], ['Change', value('change')]
    ]);
  } else if (sensor === 'endpoint-network') {
    setObserved('process_guid', 'ProcessGuid', 'process_guid'); setObserved('pid', 'ProcessId', 'pid');
    setObserved('session', 'LogonId', 'session', 'session_id'); setObserved('request_id', 'RequestId', 'request_id');
    row.destination = row.destination || value('DestinationHostname', 'destination', 'dst_host', 'domain');
    row.detail = schema([
      ['UtcTime', row.at], ['Computer', row.host], ['DestinationHostname', row.destination],
      ['DestinationPort', value('DestinationPort', 'dst_port', 'port')], ['Protocol', value('Protocol', 'protocol')],
      ['ProcessGuid', row.process_guid], ['ProcessId', row.pid], ['Image', winPath(value('Image', 'image') || row.process)],
      ['User', row.user || '-'], ['LogonId', row.session], ['BytesSent', value('BytesSent', 'bytes_out')], ['BytesTotal', value('BytesTotal', 'bytes') ?? row.bytes], ['RequestId', row.request_id], ['Operator', value('Operator', 'operator')],
      ['Method', value('method')], ['Path', value('path')], ['Status', value('status')], ['Action', value('action')], ['Result', value('result')], ['Change', value('change')]
    ]);
  } else if (sensor === 'edge-flow') {
    const observedFlowId = value('flow_id');
    row.flow_id = row.flow_id || (observedFlowId ? `flow-${digest(String(observedFlowId)).slice(0, 16)}` : undefined);
    row.src = row.src || value('src', 'src_ip', 'source_ip'); row.dst = row.dst || value('dst', 'dst_ip');
    row.destination = row.destination || value('destination', 'sni', 'dst_host');
    row.detail = schema([
      ['event_time', row.at], ['flow_id', row.flow_id], ['src', row.src], ['dst', row.dst],
      ['destination', row.destination], ['src_port', value('src_port')], ['dst_port', value('dst_port')],
      ['protocol', value('protocol', 'transport')], ['tls', value('tls')], ['bytes_out', value('bytes_out')],
      ['bytes_in', value('bytes_in')], ['bytes_total', value('bytes_total', 'bytes') ?? row.bytes],
      ['action', value('action')], ['rule', value('rule')]
    ]);
  } else if (sensor === 'linux-auth') {
    setObserved('pid', 'pid'); row.process = row.process || value('program', 'service') || row.raw?.match(/\b(sshd|sudo)\[/)?.[1];
    if (row.pid === undefined) row.pid = row.raw?.match(/\b(?:sshd|sudo)\[(\d+)\]/)?.[1];
    const rawSsh = row.raw?.match(/\b(Accepted|Failed) (publickey|password) for (?:invalid user )?(\S+) from (\S+) port (\d+)/);
    const action = value('action') || (rawSsh ? (rawSsh[1] === 'Failed' ? 'failed' : 'accepted') : undefined);
    const method = value('method') || rawSsh?.[2];
    const src = row.src || value('src', 'source_ip', 'src_ip') || rawSsh?.[4];
    const port = value('port', 'src_port') || rawSsh?.[5];
    const nativeResult = value('result');
    const result = nativeResult === 'accepted' ? 'success' : nativeResult === 'failed' ? 'failure' : nativeResult || (action === 'accepted' ? 'success' : action === 'failed' ? 'failure' : undefined);
    const fingerprint = value('fingerprint') || row.raw?.match(/\b(SHA256:[A-Za-z0-9+/=]+)/)?.[1];
    const keyType = value('key_type') || row.raw?.match(/ssh2:\s+(\S+)\s+SHA256:/)?.[1];
    row.detail = schema([['program', row.process], ['pid', row.pid], ['action', action], ['user', row.user], ['src', src], ['port', port], ['method', method], ['result', result], ['protocol', value('protocol') || (row.raw?.includes(' ssh2') ? 'ssh2' : undefined)], ['key_type', keyType], ['fingerprint', fingerprint], ['command', value('command', 'COMMAND')], ['run_as', value('run_as', 'runas')], ['tty', value('tty')], ['cwd', value('cwd', 'pwd')]]);
    if (row.process === 'sshd' && row.pid !== undefined && src && port && method && ['accepted', 'failed'].includes(action)) {
      const d = new Date(row.at);
      row.raw = `Sep ${String(d.getUTCDate()).padStart(2, ' ')} ${row.at.slice(11, 19)} ${row.host} sshd[${row.pid}]: ${action === 'failed' ? 'Failed' : 'Accepted'} ${method} for ${row.user} from ${src}${port ? ` port ${port}` : ''} ssh2${fingerprint ? `: ${keyType || '-'} ${fingerprint}` : ''}`;
    }
  } else if (sensor === 'windows-file-audit') {
    row.detail = schema([
      ['EventID', value('EventID', 'event_id')], ['UtcTime', row.at], ['Computer', row.host],
      ['SubjectUserName', row.user], ['ShareName', winPath(value('ShareName', 'share'))],
      ['RelativeTargetName', winPath(value('RelativeTargetName', 'file', 'path'))],
      ['AccessMask', value('AccessMask', 'access_mask')], ['IpAddress', value('SourceAddress', 'IpAddress', 'src')]
    ]);
  } else if (sensor === 'linux-audit') {
    // auditd uses fractional epoch seconds. These fixtures retain millisecond
    // precision uniformly, including when the observed fraction is zero.
    row.at = new Date(row.at).toISOString();
    const seconds = (Date.parse(row.at) / 1000).toFixed(3);
    const alignEpoch = text => text?.replace(/audit\(\d+\.\d+:/g, `audit(${seconds}:`);
    row.detail = alignEpoch(row.detail);
    row.raw = alignEpoch(row.raw);
    const native = { ...keyValues(row.raw), ...keyValues(row.detail) };
    const auditValue = key => native[key] === '-' ? undefined : native[key];
    row.detail = schema([
      ['type', auditValue('type')], ['msg', auditValue('msg')?.replace(/:$/, '')],
      ['argc', auditValue('argc')], ['a0', auditValue('a0')], ['a1', auditValue('a1')],
      ['pid', row.pid ?? auditValue('pid')], ['ppid', row.parent_pid ?? auditValue('ppid')],
      ['uid', auditValue('uid')], ['exe', auditValue('exe')], ['parent_exe', auditValue('parent_exe')],
      ['comm', auditValue('comm')], ['syscall', auditValue('syscall')], ['success', auditValue('success')]
    ]);
  }
  if (!['業務', '収集'].includes(row.source) && !['linux-auth', 'linux-audit', 'idp-auth'].includes(sensor)) row.raw = row.detail;
  return row;
}
const logs = [];
function add(id, day, time, source, host, user, event, detail, extra = {}, sensor = '') {
  const asset = assetMap.get(host);
  if (!asset) throw new Error(`Unknown authored asset: ${host}`);
  const format = source === '認証' && sensor === 'linux-auth' ? 'auth.log' : source === '業務' || source === '収集' ? 'training-record' : 'synthetic-key-value';
  const row = {
    id, at: `2026-09-${day}T${time}Z`, period: Number(day) < 10 ? 'baseline' : 'current',
    source, host, device_id: asset.device_id, user, event, detail,
    sensor: sensor || (source === '業務' ? 'business-register' : 'collection-register'),
    provenance: { kind: 'synthetic', sensor: sensor || (source === '業務' ? 'business-register' : 'collection-register'), format, collectionId: `collection-${host.toLowerCase()}`, deviceIdBasis: 'asset-register normalization; native identifiers remain separate' },
    ...extra
  };
  logs.push(row);
  return row;
}
function doc(id, source, host, event, detail, day = '14', time = '07:00:00') {
  return add(id, day, time, source, host, source === '収集' ? 'collection-owner' : 'operations-owner', event, detail);
}
function timeAt(hour, minute, second) { return [hour, minute, second].map(n => String(n).padStart(2, '0')).join(':'); }
function jitter(seed, min = 0, max = 40) { return min + parseInt(digest(seed).slice(0, 6), 16) % (max - min + 1); }
function minutesAt(total, seconds = 0) { return timeAt(Math.floor(total / 60), total % 60, seconds); }
const linux = asset => asset.os.startsWith('Ubuntu');
const endpoint = asset => !linux(asset) && !['REMOTE-WS-01', 'KIOSK-WS-01'].includes(asset.host);

doc('inventory-aonagi-20260914', '業務', 'IT-ADM-01', '資産台帳のスナップショット',
  `register=AON-20260914 effective=2026-09-14T00:00:00Z workstations=15 servers=5 assets=${assets.map(a => a.host).join(',')} ownership=managed status=active`);
for (const asset of assets) {
  let scope;
  if (asset.host === 'REMOTE-WS-01') scope = 'sensors=idp-auth endpoint_last_seen=2026-09-04T17:20:00Z endpoint_buffer=unavailable network_route=outside-corporate-proxy';
  else if (asset.host === 'KIOSK-WS-01') scope = 'sensors=edge-flow retained=flow_id,src,dst,destination,bytes,tls endpoint_agent=not-installed account_attribution=asset-register';
  else if (asset.host === 'BUILD-SRV-01') scope = 'sensors=linux-auth,linux-audit,job-network,key-monitor retained_process=pid,ppid,exe,uid,audit_serial retained_guid=none';
  else if (linux(asset)) scope = 'sensors=linux-auth,edge-flow,cron-monitor,key-monitor retained_auth=program,pid,user,src,method,result retained_process_start=none retained_guid=none';
  else {
    const supplementary = asset.category === 'workstation' ? ',update-client' : '';
    const extraSensors = asset.host === 'FIN-WS-03' ? ',edge-flow' : asset.host === 'FILE-SRV-01' ? ',windows-file-audit,quarantine-store,share-identity,share-gateway' : asset.host === 'DESIGN-WS-01' ? ',quarantine-store' : '';
    scope = `sensors=windows-security,win-edr,endpoint-network${supplementary}${extraSensors} retained_process=ProcessGuid,ProcessId,ParentProcessGuid,ParentProcessId,Image,ParentImage,User`;
  }
  const gap = asset.host === 'FIN-WS-03' ? ' gap_sensor=win-edr,endpoint-network gap_from=2026-09-15T10:00:00Z gap_to=2026-09-15T12:00:00Z gap_buffer=unavailable' : '';
  doc(`collection-${asset.host.toLowerCase()}`, '収集', asset.host, '資産別の取得範囲',
    `device_id=${asset.device_id} baseline=2026-09-07/2026-09-09 current=2026-09-14/2026-09-16 ${scope}${gap} dataset=synthetic-samples`);
}
doc('collection-endpoint-windows', '収集', 'IT-ADM-01', 'Windows端末センサーの項目',
  'sensor=win-edr event=process_start fields=UtcTime,Image,ParentImage,ProcessGuid,ParentProcessGuid,ProcessId,ParentProcessId,User,Hashes retention_windows=2026-09-07/2026-09-09,2026-09-14/2026-09-16 exceptions=collection-remote-ws-01,collection-kiosk-ws-01,collection-fin-ws-03');
doc('collection-linux-auth', '収集', 'WEB-SRV-01', 'Linux記録の取得範囲',
  'sensor=linux-auth path=/var/log/auth.log fields=timestamp,host,program,pid,message process_guid=not-produced command_completion=not-recorded auditd_process_start=BUILD-SRV-01 cron_change_sensor=cron-monitor key_change_sensor=key-monitor source_format=auth.log');
doc('collection-remote-gap', '収集', 'REMOTE-WS-01', '社外端末の接続状況',
  'sensor=win-edr last_received=2026-09-04T17:20:00Z expected_reconnect=2026-09-18T09:00:00Z local_buffer=unavailable available_alternative=idp-auth asset_state=active-loan');
doc('collection-kiosk-network', '収集', 'KIOSK-WS-01', '受付端末の境界通信項目',
  'sensor=edge-flow fields=flow_id,event_time,src,dst,destination,bytes,tls endpoint_process=not-collected user_mapping=asset-register network_control_events=firewall-decision');
doc('collection-finance-gap', '収集', 'FIN-WS-03', '端末センサーの保守時間',
  'sensors=win-edr,endpoint-network stop=2026-09-15T10:00:00Z resume=2026-09-15T12:00:00Z local_buffer=unavailable replay=unavailable available_during_gap=windows-security,edge-flow change=AGENT-316');
doc('collection-edge-flow', '収集', 'IDP-SRV-01', '境界フローセンサーの項目',
  'sensor=edge-flow fields=flow_id,event_time,src,dst,destination,bytes,tls process_id=not-collected process_guid=not-collected account=asset-register-enrichment payload=not-retained');
doc('collection-share-gateway', '収集', 'FILE-SRV-01', '公開共有ゲートウェイの取得項目',
  'sensor=share-gateway fields=request_id,session,path,status,response_bytes retained_object_id=false retained_body=false object_audit_enabled_from=2026-09-17T00:00:00Z endpoint_file_events_sensor=win-edr separate_from=gateway-object-access');
doc('business-update-daily', '業務', 'IT-ADM-01', '端末更新の運用条件',
  'job=UPDATE-DAILY scope=managed-windows-workstations account=SYSTEM process=updater.exe parent=services.exe schedule_window=12:00Z/12:24Z distribution=per-device-offset destination=updates.example allowed_action=catalog-read package_action=approved-change-window');
doc('business-backup-daily', '業務', 'BACKUP-SRV-01', 'バックアップの運用条件',
  'job=BACKUP-DAILY host=BACKUP-SRV-01 account=svc-backup program=/usr/local/bin/backup-agent schedule=04:00Z destination=vault.example action=incremental-backup receipt_check=04:10Z source=FILE-SRV-01');
doc('business-build-daily', '業務', 'BUILD-SRV-01', '定例ビルドの運用条件',
  'job=BUILD-DAILY host=BUILD-SRV-01 account=svc-build program=/usr/bin/python3 parent=/usr/sbin/cron schedule=02:00Z action=build-and-test package_registry=packages.example artifact_destination=artifacts.example');
doc('business-inventory-daily', '業務', 'IT-ADM-01', '管理端末の棚卸条件',
  'job=INVENTORY-DAILY host=IT-ADM-01 account=ops-admin process=adminctl.exe parent=explorer.exe schedule=09:00Z action=inventory target_group=managed-servers');
doc('business-finance-export', '業務', 'FIN-WS-02', '四半期帳票の実行許可',
  'change=FIN-417 approved_at=2026-09-14T15:00:00Z window=2026-09-15T14:00:00Z/2026-09-15T14:30:00Z host=FIN-WS-02 account=ikeda parent=excel.exe child=powershell.exe script=C:/Finance/QuarterlyExport.ps1 publisher=Aonagi-Finance input=erp.example output=FILE-SRV-01/finance/quarterly.csv action=aggregate-export', '14', '15:00:00');
doc('business-helpdesk-maint', '業務', 'FILE-SRV-01', '共有サービスの保守許可',
  'change=OPS-418 approved_at=2026-09-14T16:00:00Z window=2026-09-15T19:20:00Z/2026-09-15T20:00:00Z source=IT-ADM-01 target=FILE-SRV-01 account=ops-admin method=RDP action=share-health-check ticket_owner=storage-team', '14', '16:00:00');
doc('business-quarantine-retention', '業務', 'FILE-SRV-01', '隔離標本の保持条件',
  'job=QUARANTINE-SYNC retained_locations=FILE-SRV-01/D:/Quarantine,DESIGN-WS-01/C:/ProgramData/Sensor/Quarantine action=retain-encrypted-sample expiration=2026-09-30 hash_kind=original-content-hash executor=sensor-service');

for (const day of ['07', '08', '09', '14', '15', '16']) {
  for (const [index, asset] of assets.entries()) {
    const slug = asset.host.toLowerCase();
    const stamp = `09${day}`;
    const second = jitter(`${slug}-${day}-auth`, 2, 48);
    const isServer = asset.category === 'server';
    const authMinute = isServer ? 102 + jitter(`${slug}-${day}-authminute`, -17, 17) : 530 + jitter(`${slug}-${day}-authminute`, -20, asset.host === 'IT-ADM-01' ? 7 : 20);
    const authTime = minutesAt(authMinute, second);
    const session = `S-${slug}-${stamp}`;
    if (asset.host !== 'KIOSK-WS-01') {
      if (linux(asset)) {
        const pid = 1400 + index * 11 + Number(day);
        const raw = `Sep ${String(Number(day)).padStart(2, ' ')} ${authTime} ${asset.host} sshd[${pid}]: Accepted publickey for ${asset.owner} from 192.0.2.${21 + index} port ${42000 + Number(day) * 13 + index} ssh2`;
        add(`normal-auth-${slug}-${stamp}`, day, authTime, '認証', asset.host, asset.owner, 'SSH認証を記録',
          `program=sshd pid=${pid} action=accepted method=publickey account=${asset.owner} src=192.0.2.${21 + index} result=success`,
          { raw, pid, process: 'sshd' }, 'linux-auth');
      } else {
        const sensor = asset.host === 'REMOTE-WS-01' ? 'idp-auth' : 'windows-security';
        add(`normal-auth-${slug}-${stamp}`, day, authTime, '認証', asset.host, asset.owner, '認証成功を記録',
          `event_id=${sensor === 'idp-auth' ? 'sign_in' : '4624'} account=${asset.owner} logon_type=${isServer ? '5' : '2'} method=${sensor === 'idp-auth' ? 'certificate' : 'Negotiate'} src=192.0.2.${21 + index} result=success session=${session}`,
          { session }, sensor);
      }
    }
    if (endpoint(asset)) {
      const process = asset.host === 'IT-ADM-01' ? 'adminctl.exe' : isServer ? 'service-health.exe' : 'browser.exe';
      const parent = isServer ? 'services.exe' : 'explorer.exe';
      const pg = guid(`normal-${slug}-${stamp}-${process}`);
      const ppg = guid(`shell-${slug}-${stamp}-${parent}`);
      const start = asset.host === 'IT-ADM-01' ? '09:00:00' : minutesAt(authMinute + jitter(`${slug}-${day}-startgap`, 2, 13), jitter(`${slug}-${day}-start`, 3, 54));
      add(`normal-process-${slug}-${stamp}`, day, start, '端末', asset.host, asset.owner, 'プロセス開始を記録',
        `UtcTime=2026-09-${day}T${start}Z Image="C:/Program Files/Aonagi/${process}" ParentImage="C:/Windows/${parent}" ProcessGuid=${pg} ParentProcessGuid=${ppg} ProcessId=${4200 + index * 8} ParentProcessId=${1800 + index * 3} User=${asset.owner}`,
        { process, parent, process_guid: pg, parent_process_guid: ppg, pid: 4200 + index * 8, parent_pid: 1800 + index * 3, session, hash: digest(`normal-program:${process}`) }, 'win-edr');
      const netTime = new Date(`2026-09-${day}T${start}Z`); netTime.setUTCSeconds(netTime.getUTCSeconds() + 3 + index % 5);
      add(`normal-net-${slug}-${stamp}`, day, netTime.toISOString().slice(11, 19), '通信', asset.host, asset.owner, '端末からの接続を記録',
        `DestinationHostname=${isServer ? 'monitor.example' : 'docs.example'} DestinationPort=443 ProcessGuid=${pg} ProcessId=${4200 + index * 8} Image="C:/Program Files/Aonagi/${process}" BytesSent=${8192 + index * 1024}`,
        { destination: isServer ? 'monitor.example' : 'docs.example', process, process_guid: pg, pid: 4200 + index * 8, bytes: 8192 + index * 1024, session }, 'endpoint-network');
      if (!isServer) {
        add(`normal-update-${slug}-${stamp}`, day, minutesAt(720 + jitter(`${slug}-update-offset`, 0, 20) + jitter(`${slug}-${day}-update-delay`, 0, 3), jitter(`${slug}-${day}-update-second`, 0, 58)), '通信', asset.host, 'SYSTEM', '更新カタログの要求を記録',
          `job=UPDATE-DAILY method=GET path=/catalog.json status=200 request_id=UPDATE-${slug}-${stamp} account=SYSTEM`,
          { destination: 'updates.example', process: 'updater.exe', bytes: 4096, request_id: `UPDATE-${slug}-${stamp}` }, 'update-client');
      }
    } else if (asset.host === 'BUILD-SRV-01') {
      const epoch = Math.floor(Date.parse(`2026-09-${day}T02:00:00Z`) / 1000);
      const audit = `audit(${epoch}.123:91${day})`;
      add(`normal-process-${slug}-${stamp}`, day, '02:00:00', '端末', asset.host, asset.owner, 'auditdの実行記録',
        `type=EXECVE msg=${audit} argc=2 a0=/usr/bin/python3 a1=/srv/build/build.py pid=2310 ppid=810 uid=1102 exe=/usr/bin/python3 parent_exe=/usr/sbin/cron`,
        { raw: `type=SYSCALL msg=${audit} pid=2310 ppid=810 uid=1102 exe="/usr/bin/python3"\ntype=EXECVE msg=${audit} argc=2 a0="/usr/bin/python3" a1="/srv/build/build.py"`, process: 'python3', parent: 'cron', pid: 2310, parent_pid: 810 }, 'linux-audit');
      add(`normal-net-${slug}-${stamp}`, day, timeAt(2, 0, jitter(`build-fetch-${day}`, 12, 39)), '通信', asset.host, asset.owner, 'パッケージ取得を記録',
        `job=BUILD-DAILY request_id=BUILD-${stamp}-PKG method=GET repository=packages.example status=200 artifact=dependencies.lock`,
        { destination: 'packages.example', process: 'python3', bytes: 4194304, request_id: `BUILD-${stamp}-PKG` }, 'job-network');
    } else if (asset.host !== 'REMOTE-WS-01') {
      const dest = asset.host === 'BACKUP-SRV-01' ? 'vault.example' : asset.host === 'KIOSK-WS-01' ? 'reception.example' : 'packages.example';
      const netTime = asset.host === 'BACKUP-SRV-01' ? timeAt(4, 1, jitter(`backup-transfer-${day}`, 4, 46)) : timeAt(9, 12 + index % 4, jitter(`edge-${slug}-${day}`, 2, 50));
      add(`normal-net-${slug}-${stamp}`, day, netTime, '通信', asset.host, '', '境界のTLSフローを記録',
        `flow_id=FLOW-${slug}-${stamp} src=192.0.2.${21 + index} dst=203.0.113.${30 + index} sni=${dest} tls=true bytes_out=${asset.host === 'BACKUP-SRV-01' ? 8388608 : 32768}`,
        { destination: dest, bytes: asset.host === 'BACKUP-SRV-01' ? 8388608 : 32768 }, 'edge-flow');
    }
    if (asset.host === 'BACKUP-SRV-01') {
      add(`normal-backup-${stamp}`, day, '04:00:00', '業務', asset.host, 'svc-backup', '日次バックアップの開始票',
        `job=BACKUP-DAILY run_id=BACKUP-${stamp} source=FILE-SRV-01 schedule=04:00Z mode=incremental destination=vault.example`, {}, 'job-scheduler');
      add(`normal-backup-receipt-${stamp}`, day, '04:10:00', '業務', asset.host, 'svc-backup', '保管先の受領票',
        `job=BACKUP-DAILY run_id=BACKUP-${stamp} receipt=RCPT-${stamp} bytes=8388608 state=received`, {}, 'job-scheduler');
    }
    if (asset.host === 'FILE-SRV-01') {
      add(`normal-file-${slug}-${stamp}`, day, timeAt(10, 4, jitter(`file-${day}`, 3, 48)), 'ファイル', asset.host, 'mori', '共有ファイルの読取を記録',
        `EventID=5145 ShareName=finance RelativeTargetName=daily-ledger.csv SubjectUserName=mori AccessMask=0x1 SourceAddress=192.0.2.24`, {}, 'windows-file-audit');
    }
  }
}

// Ordinary workload samples vary by asset and day. Each process/network pair
// describes one observed launch; no execution telemetry is fabricated for the
// assets whose collection profile contains only authentication or edge flows.
const desktopApps = [
  ['outlook.exe', 'explorer.exe', 'mail.example', 'C:/Program Files/Microsoft Office/root/Office16/outlook.exe'],
  ['ms-teams.exe', 'explorer.exe', 'meeting.example', 'C:/Program Files/WindowsApps/MSTeams/ms-teams.exe'],
  ['browser.exe', 'explorer.exe', 'crm.example', 'C:/Program Files/Aonagi/browser.exe'],
  ['excel.exe', 'explorer.exe', 'erp.example', 'C:/Program Files/Microsoft Office/root/Office16/excel.exe'],
  ['docview.exe', 'explorer.exe', 'docs.example', 'C:/Program Files/DocView/docview.exe'],
  ['onedrive.exe', 'explorer.exe', 'files.example', 'C:/Program Files/Microsoft OneDrive/onedrive.exe'],
  ['browser.exe', 'explorer.exe', 'helpdesk.example', 'C:/Program Files/Aonagi/browser.exe'],
  ['designer.exe', 'explorer.exe', 'design-catalog.example', 'C:/Program Files/Aonagi/designer.exe']
];
for (const day of ['07', '08', '09', '14', '15', '16']) {
  for (const [index, asset] of assets.entries()) {
    const slug = asset.host.toLowerCase();
    const stamp = `09${day}`;
    if (endpoint(asset)) {
      const launches = jitter(`${slug}-${day}-launch-count`, 2, 6);
      for (let ordinal = 0; ordinal < launches; ordinal++) {
        const server = asset.category === 'server';
        const selected = desktopApps[(jitter(`${slug}-${day}-app`, 0, 6) + ordinal * 3) % desktopApps.length];
        const [process, parent, destination, image] = server
          ? [['service-health.exe', 'services.exe', 'monitor.example', 'C:/Program Files/Aonagi/service-health.exe'], ['backup-client.exe', 'services.exe', 'vault.example', 'C:/Program Files/Aonagi/backup-client.exe'], ['svchost.exe', 'services.exe', 'updates.example', 'C:/Windows/System32/svchost.exe']][ordinal % 3]
          : selected;
        let minute = server ? 210 + ordinal * 145 + jitter(`${slug}-${day}-${ordinal}-minute`, 0, 95) : 565 + ordinal * 63 + jitter(`${slug}-${day}-${ordinal}-minute`, 0, 42);
        if (asset.host === 'FIN-WS-03' && day === '15' && minute >= 600 && minute < 720) minute += 122;
        const second = jitter(`${slug}-${day}-${ordinal}-second`, 0, 54);
        const at = minutesAt(minute, second);
        const session = `S-${slug}-${stamp}`;
        const pg = guid(`${slug}-${day}-app-${ordinal}`);
        const ppg = guid(`shell-${slug}-${stamp}-${parent}`);
        const pid = 5000 + ordinal * 212 + index * 8 + Number(day);
        const bytes = jitter(`${slug}-${day}-${ordinal}-bytes`, 512, 262144);
        add(`normal-app-${slug}-${stamp}-${ordinal}`, day, at, '端末', asset.host, asset.owner, 'プロセス開始を記録',
          `Image="${image}" ParentImage="C:/Windows/${parent}" ProcessGuid=${pg} ParentProcessGuid=${ppg} ProcessId=${pid} ParentProcessId=${1800 + index * 3} User=${asset.owner} SignatureStatus=Valid Publisher=${server ? 'Aonagi-Operations' : 'Approved-Application'}`,
          { process, parent, process_guid: pg, parent_process_guid: ppg, pid, parent_pid: 1800 + index * 3, session, hash: digest(`normal-program:${process}`) }, 'win-edr');
        add(`normal-app-net-${slug}-${stamp}-${ordinal}`, day, minutesAt(minute, second + 4), '通信', asset.host, asset.owner, '端末からの接続を記録',
          `DestinationHostname=${destination} DestinationPort=443 Protocol=tcp ProcessGuid=${pg} ProcessId=${pid} Image="${image}" BytesSent=${bytes}`,
          { process, destination, process_guid: pg, pid, session, bytes }, 'endpoint-network');
      }
      const unlocks = jitter(`${slug}-${day}-unlock-count`, 0, 2);
      for (let ordinal = 0; ordinal < unlocks; ordinal++) {
        add(`normal-unlock-${slug}-${stamp}-${ordinal}`, day, minutesAt(760 + ordinal * 98 + jitter(`${slug}-${day}-${ordinal}-unlock`, 0, 37), jitter(`${slug}-${day}-${ordinal}-unlock-second`, 0, 58)), '認証', asset.host, asset.owner, '認証成功を記録',
          `EventID=4624 LogonType=7 TargetLogonId=${`S-${slug}-${stamp}`} WorkstationName=${asset.host} IpAddress=127.0.0.1 AuthenticationPackageName=Negotiate`,
          { session: `S-${slug}-${stamp}` }, 'windows-security');
      }
    } else if (asset.host === 'REMOTE-WS-01') {
      for (let ordinal = 0, count = jitter(`${slug}-${day}-sessions`, 4, 11); ordinal < count; ordinal++) {
        const session = `IDP-${stamp}-${ordinal}-${digest(slug).slice(0, 5)}`;
        add(`normal-cloud-auth-${slug}-${stamp}-${ordinal}`, day, minutesAt(570 + ordinal * 29 + jitter(`${day}-${ordinal}-cloud-minute`, 0, 18), jitter(`${day}-${ordinal}-cloud-second`, 0, 58)), '認証', asset.host, asset.owner, 'サービスへの認証を記録',
          `event_id=sign_in account=${asset.owner} method=certificate src=198.51.100.44 result=success session=${session} application=${['mail', 'files', 'meeting', 'crm'][ordinal % 4]}`,
          { session }, 'idp-auth');
      }
    } else if (asset.host === 'BUILD-SRV-01') {
      for (let ordinal = 0, count = jitter(`${slug}-${day}-steps`, 2, 5); ordinal < count; ordinal++) {
        const minute = 121 + ordinal * 4 + jitter(`${day}-${ordinal}-build-minute`, 0, 2);
        const at = minutesAt(minute, jitter(`${day}-${ordinal}-build-second`, 1, 53));
        const epoch = Math.floor(Date.parse(`2026-09-${day}T${at}Z`) / 1000);
        const pid = 2490 + ordinal * 19 + Number(day);
        const process = ['git', 'python3', 'pytest', 'tar', 'curl'][ordinal];
        const destination = ordinal === 0 ? 'git.example' : ordinal === 3 ? 'artifacts.example' : 'packages.example';
        const audit = `audit(${epoch}.000:12${day}${ordinal})`;
        const detail = `type=EXECVE msg=${audit} argc=2 a0=/usr/bin/${process} a1=/srv/build/${['checkout', 'resolve.py', 'tests', 'dist', 'manifest'][ordinal]} pid=${pid} ppid=2310 uid=1102 exe=/usr/bin/${process} parent_exe=/usr/bin/python3`;
        add(`normal-build-step-${stamp}-${ordinal}`, day, at, '端末', asset.host, asset.owner, 'auditdの実行記録', detail,
          { raw: `type=SYSCALL msg=${audit} pid=${pid} ppid=2310 uid=1102 exe="/usr/bin/${process}"\n${detail}`, process, parent: 'python3', pid, parent_pid: 2310 }, 'linux-audit');
        add(`normal-build-fetch-${stamp}-${ordinal}`, day, minutesAt(minute, Number(at.slice(6)) + 5), '通信', asset.host, asset.owner, 'ビルド処理の要求を記録',
          `job=BUILD-DAILY request_id=BUILD-${stamp}-STEP${ordinal} method=GET repository=${destination} status=200 artifact=${['source.tar', 'metadata.json', 'test-data.tar', 'manifest.json', 'checksums.txt'][ordinal]}`,
          { destination, process, bytes: jitter(`${day}-${ordinal}-build-bytes`, 8192, 8388608), request_id: `BUILD-${stamp}-STEP${ordinal}` }, 'job-network');
      }
    } else {
      const destinations = asset.host === 'KIOSK-WS-01' ? ['reception.example', 'clock.example', 'visitor-badge.example']
        : asset.host === 'BACKUP-SRV-01' ? ['vault.example', 'monitor.example', 'clock.example']
        : asset.host === 'WEB-SRV-01' ? ['monitor.example', 'certificates.example', 'packages.example']
        : ['packages.example', 'git.example', 'docs.example', 'artifacts.example'];
      for (let ordinal = 0, count = jitter(`${slug}-${day}-flows`, 5, 12); ordinal < count; ordinal++) {
        const destination = destinations[(ordinal + index) % destinations.length];
        const minute = asset.host === 'BACKUP-SRV-01' ? 241 + ordinal * 6 + jitter(`${slug}-${day}-${ordinal}-flow-minute`, 0, 5)
          : 545 + ordinal * 33 + jitter(`${slug}-${day}-${ordinal}-flow-minute`, 0, 29);
        const bytes = jitter(`${slug}-${day}-${ordinal}-flow-bytes`, 1024, 524288);
        add(`normal-edge-${slug}-${stamp}-${ordinal}`, day, minutesAt(minute, jitter(`${slug}-${day}-${ordinal}-flow-second`, 0, 58)), '通信', asset.host, '', '境界のTLSフローを記録',
          `flow_id=EDGE-${stamp}-${index}-${ordinal} src=192.0.2.${21 + index} dst=203.0.113.${80 + ordinal} sni=${destination} src_port=${jitter(`${slug}-${day}-${ordinal}-ephemeral-port`, 49152, 65535)} dst_port=443 protocol=tcp tls=true bytes_out=${bytes}`,
          { destination, bytes }, 'edge-flow');
      }
    }
  }
}
doc('business-office-applications', '業務', 'IT-ADM-01', '日常アプリケーションの利用範囲',
  'policy=WORK-APP-04 scope=managed-user-workstations accounts=assigned-users applications=mail,meeting,crm,spreadsheets,document-viewer,file-sync,design-catalog destinations=mail.example,meeting.example,crm.example,erp.example,docs.example,files.example,helpdesk.example,design-catalog.example allowed_action=interactive-business-use');
doc('business-baseline-rdp', '業務', 'IT-ADM-01', '定例の対話保守の実施条件',
  'change=OPS-401 dates=2026-09-07,2026-09-08,2026-09-09 window=18:00Z/19:00Z account=ops-admin source=IT-ADM-01 targets=FILE-SRV-01,IDP-SRV-01 method=RDP allowed_action=service-health-and-log-review');
for (const [day, host, minute] of [['07', 'FILE-SRV-01', 1088], ['08', 'IDP-SRV-01', 1102], ['09', 'FILE-SRV-01', 1096]]) {
  add(`normal-rdp-${host.toLowerCase()}-09${day}`, day, minutesAt(minute, jitter(`rdp-${day}`, 1, 51)), '認証', host, 'ops-admin', 'リモートログオンを記録',
    `EventID=4624 TargetUserName=ops-admin LogonType=10 WorkstationName=IT-ADM-01 IpAddress=192.0.2.33 TargetLogonId=0x${digest(`rdp-${day}`).slice(0, 8)} AuthenticationPackageName=Negotiate`, {}, 'windows-security');
}
doc('business-storage-observer', '業務', 'FILE-SRV-01', 'ストレージ担当者の確認作業',
  'change=OPS-420 date=2026-09-15 window=19:00Z/20:00Z account=storage-reader source=IT-ADM-01 target=FILE-SRV-01 method=RDP allowed_action=read-status-dashboard');
add('normal-rdp-storage-0915', '15', '19:35:27', '認証', 'FILE-SRV-01', 'storage-reader', 'リモートログオンを記録',
  'EventID=4624 TargetUserName=storage-reader LogonType=10 WorkstationName=IT-ADM-01 IpAddress=192.0.2.33 TargetLogonId=0x81ad29 AuthenticationPackageName=Negotiate', {}, 'windows-security');
add('normal-console-admin-0915', '15', '16:48:52', '認証', 'FILE-SRV-01', 'ops-admin', '認証成功を記録',
  'EventID=4624 TargetUserName=ops-admin LogonType=2 WorkstationName=FILE-SRV-01 IpAddress=127.0.0.1 TargetLogonId=0x71ef23 AuthenticationPackageName=Negotiate', {}, 'windows-security');
doc('business-docview-preview', '業務', 'DESIGN-WS-02', '文書プレビューの試験条件',
  'change=DES-311 date=2026-09-15 window=10:00Z/11:00Z host=DESIGN-WS-02 account=nishi parent=docview.exe child=preview-renderer.exe path="C:/Program Files/DocView/preview-renderer.exe" allowed_action=render-local-document');
add('normal-rare-docview-preview', '15', '10:24:35', '端末', 'DESIGN-WS-02', 'nishi', 'プロセス開始を記録',
  `Image="C:/Program Files/DocView/preview-renderer.exe" ParentImage="C:/Program Files/DocView/docview.exe" ProcessGuid=${guid('preview-renderer-0915')} ParentProcessGuid=${guid('preview-docview-0915')} ProcessId=8124 ParentProcessId=8020 SignatureStatus=Valid Publisher=DocView`,
  { process: 'preview-renderer.exe', parent: 'docview.exe', process_guid: guid('preview-renderer-0915'), parent_process_guid: guid('preview-docview-0915'), pid: 8124, parent_pid: 8020, session: 'S-design-ws-02-0915' }, 'win-edr');
doc('business-partner-portal-test', '業務', 'DESIGN-WS-03', '取引先ポータルの動作確認',
  'change=DES-318 date=2026-09-15 window=13:00Z/13:30Z host=DESIGN-WS-03 account=suga application=browser.exe destination=session-api.example allowed_action=interactive-portal-login');
add('normal-rare-session-portal', '15', '13:12:41', '通信', 'DESIGN-WS-03', 'suga', '端末からの接続を記録',
  `DestinationHostname=session-api.example DestinationPort=443 ProcessGuid=${guid('portal-browser-0915')} ProcessId=9140 Image="C:/Program Files/Aonagi/browser.exe" BytesSent=2840`,
  { process: 'browser.exe', process_guid: guid('portal-browser-0915'), pid: 9140, session: 'S-design-ws-03-0915', destination: 'session-api.example', bytes: 2840 }, 'endpoint-network');

// Rare but explicitly authorized parent/child example used by baseline work.
const reportParent = guid('quarter-report-parent');
const reportChild = guid('quarter-report-child');
add('event-win-20260915-140501', '15', '14:05:01', '端末', 'FIN-WS-02', 'ikeda', 'プロセス開始を記録',
  `Image="C:/Program Files/Microsoft Office/root/Office16/excel.exe" ParentImage=C:/Windows/explorer.exe ProcessGuid=${reportParent} ProcessId=5540 User=ikeda document=C:/Finance/QuarterlyReport.xlsm`,
  { process: 'excel.exe', parent: 'explorer.exe', process_guid: reportParent, pid: 5540, session: 'S-fin-ws-02-0915' }, 'win-edr');
add('event-win-20260915-140506', '15', '14:05:06', '端末', 'FIN-WS-02', 'ikeda', 'プロセス開始を記録',
  `Image=C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ParentImage="C:/Program Files/Microsoft Office/root/Office16/excel.exe" ProcessGuid=${reportChild} ParentProcessGuid=${reportParent} ProcessId=5588 ParentProcessId=5540 User=ikeda Script=C:/Finance/QuarterlyExport.ps1 SignatureStatus=Valid Publisher=Aonagi-Finance`,
  { process: 'powershell.exe', parent: 'excel.exe', process_guid: reportChild, parent_process_guid: reportParent, pid: 5588, parent_pid: 5540, session: 'S-fin-ws-02-0915', hash: digest('finance-export-script-v7') }, 'win-edr');
add('event-file-20260915-140520', '15', '14:05:20', 'ファイル', 'FILE-SRV-01', 'ikeda', '共有ファイルの作成を記録',
  'EventID=5145 ShareName=finance RelativeTargetName=quarterly.csv SubjectUserName=ikeda SourceAddress=192.0.2.25 AccessMask=0x2 job=FIN-417', {}, 'windows-file-audit');
add('event-net-20260915-020133', '15', '02:01:33', '通信', 'BUILD-SRV-01', 'svc-build', 'パッケージ取得を記録',
  'job=BUILD-DAILY request_id=BUILD-0915-PKG2 method=GET repository=repo-next.example status=200 artifact=plugin-index.json',
  { destination: 'repo-next.example', process: 'python3', bytes: 98304, request_id: 'BUILD-0915-PKG2' }, 'job-network');

// C1: external intelligence -> behavioral correlation, including a benign
// same-tool contrast above. Structured identities come from the endpoint sensor.
doc('intelligence-note-20260914', '業務', 'IT-ADM-01', '外部観測情報の登録票',
  'reference=TI-092 source=synthetic-report observed_parent=docview.exe observed_child=powershell.exe followup=new-https-destination observed_filename=invoice-note.docx confidence=reported scope=other-organization');
const documentParent = guid('document-session-parent');
const documentChild = guid('document-session-child');
add('event-win-20260915-112001', '15', '11:20:01', '端末', 'SALES-WS-03', 'ono', 'プロセス開始を記録',
  `Image="C:/Program Files/DocView/docview.exe" ParentImage=C:/Windows/explorer.exe ProcessGuid=${documentParent} ProcessId=6240 User=ono document=C:/Users/ono/Downloads/meeting-notes.docx`,
  { process: 'docview.exe', parent: 'explorer.exe', process_guid: documentParent, pid: 6240, session: 'S-sales-ws-03-0915' }, 'win-edr');
add('event-win-20260915-112005', '15', '11:20:05', '端末', 'SALES-WS-03', 'ono', 'プロセス開始を記録',
  `Image=C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ParentImage="C:/Program Files/DocView/docview.exe" ProcessGuid=${documentChild} ParentProcessGuid=${documentParent} ProcessId=6304 ParentProcessId=6240 User=ono Script=C:/Users/ono/AppData/Temp/session.ps1`,
  { process: 'powershell.exe', parent: 'docview.exe', process_guid: documentChild, parent_process_guid: documentParent, pid: 6304, parent_pid: 6240, session: 'S-sales-ws-03-0915', hash: digest('document-session-script') }, 'win-edr');
add('event-net-20260915-112009', '15', '11:20:09', '通信', 'SALES-WS-03', 'ono', '端末からの接続を記録',
  `DestinationHostname=session-api.example DestinationPort=443 ProcessGuid=${documentChild} ProcessId=6304 Image="C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe" BytesSent=1536`,
  { destination: 'session-api.example', process: 'powershell.exe', process_guid: documentChild, pid: 6304, session: 'S-sales-ws-03-0915', bytes: 1536 }, 'endpoint-network');

// C2: a normal-workload deviation whose positive authorization can be checked.
add('event-auth-20260915-193011', '15', '19:30:11', '認証', 'FILE-SRV-01', 'ops-admin', 'リモートログオンを記録',
  'EventID=4624 SubjectUserName=ops-admin LogonType=10 logon_type=10 SourceWorkstation=IT-ADM-01 AuthenticationPackageName=Negotiate TargetLogonId=0x7a91 result=success',
  { session: '0x7a91' }, 'windows-security');
add('event-business-20260915-194500', '15', '19:45:00', '業務', 'FILE-SRV-01', 'ops-admin', '保守作業の完了票',
  'change=OPS-418 started=2026-09-15T19:30:00Z ended=2026-09-15T19:44:00Z account=ops-admin method=RDP source=IT-ADM-01 target=FILE-SRV-01 action=share-health-check result=completed recipient=storage-team',
  {}, 'job-scheduler');

// C3: a known hash in retained objects is not equivalent to observed execution.
const quarantineHash = digest('quarantine-sample-q17');
add('event-file-20260915-071211', '15', '07:12:11', 'ファイル', 'FILE-SRV-01', 'sensor-service', '隔離標本の同期を記録',
  `action=quarantine_sync storage=D:/Quarantine/Q17.enc original_sha256=${quarantineHash} container=encrypted job=QUARANTINE-SYNC`,
  { hash: quarantineHash }, 'quarantine-store');
add('event-file-20260915-071217', '15', '07:12:17', 'ファイル', 'DESIGN-WS-01', 'sensor-service', '隔離標本の同期を記録',
  `action=quarantine_sync storage=C:/ProgramData/Sensor/Quarantine/Q17.enc original_sha256=${quarantineHash} container=encrypted job=QUARANTINE-SYNC`,
  { hash: quarantineHash }, 'quarantine-store');
doc('collection-quarantine-hash', '収集', 'FILE-SRV-01', '隔離と実行の識別項目',
  'sensor=quarantine-store hash_field=original_sha256 object=encrypted-container execution_field=not-present process_start_sensor=win-edr process_hash_field=Hashes assets=FILE-SRV-01,DESIGN-WS-01 period=2026-09-14/2026-09-16 process_collection_gap=none');

// C4: business request, but the gateway does not retain object identity/content.
doc('business-share-request', '業務', 'FILE-SRV-01', '共有範囲の確認依頼',
  'request=SHARE-423 requester=data-owner target=FILE-SRV-01 requested_window=2026-09-15T16:15:00Z/2026-09-15T16:30:00Z client_network=198.51.100.71 question=export-object-access approved_share=partner-quarterly allowed_recipient=PARTNER-07 allowed_objects=public-summary.csv effective=2026-09-14/2026-09-16');
add('event-auth-20260915-162002', '15', '16:20:02', '認証', 'FILE-SRV-01', 'partner-07', '共有サービスの認証を記録',
  'sensor=share-identity session=SHARE-911 account=partner-07 method=link-token result=success source_ip=198.51.100.71',
  { session: 'SHARE-911' }, 'share-identity');
add('event-net-20260915-162007', '15', '16:20:07', '通信', 'FILE-SRV-01', 'partner-07', '共有ゲートウェイの応答を記録',
  'session=SHARE-911 request_id=SHARE-REQ-911 method=GET path=/download status=200 response_bytes=1048576',
  { session: 'SHARE-911', request_id: 'SHARE-REQ-911', destination: 'share-gateway.example', bytes: 1048576 }, 'share-gateway');

// C5: coverage-driven hunt; the fallback flow has no invented process identity.
add('event-net-20260915-103159', '15', '10:31:59', '通信', 'FIN-WS-03', '', '境界のTCPフローを記録',
  'flow_id=FLOW-FIN-315 src=192.0.2.26 dst=203.0.113.96 destination=relay-room.example src_port=54891 dst_port=80 protocol=tcp tls=false bytes_out=482 bytes_in=316',
  { destination: 'relay-room.example', bytes: 798 }, 'edge-flow');
add('event-net-20260915-103203', '15', '10:32:03', '通信', 'FIN-WS-03', '', '境界のTLSフローを記録',
  'flow_id=FLOW-FIN-316 src=192.0.2.26 dst=203.0.113.96 sni=relay-room.example src_port=54894 dst_port=443 protocol=tcp tls=true bytes_out=3072',
  { destination: 'relay-room.example', bytes: 3072 }, 'edge-flow');

doc('business-linux-maintenance', '業務', 'WEB-SRV-01', 'Webサーバーの定例接続条件',
  'job=WEB-HEALTH host=WEB-SRV-01 account=svc-web method=publickey source_ip=192.0.2.39 window=01:20Z/02:05Z allowed_command=/usr/local/bin/health-check policy=command-restricted-key');
doc('business-critical-files', '業務', 'FILE-SRV-01', '重要資産のデータ管理条件',
  'asset=FILE-SRV-01 owner=data-owner criticality=high datasets=finance-ledger,design-documents,public-summary.csv sensitivity=internal-and-restricted external_share_scope=public-summary.csv recipient=PARTNER-07 business_impact=financial-reporting-and-design-work');
doc('business-detection-process-egress', '業務', 'IT-ADM-01', '既存の検知条件の登録票',
  'rule=DET-PROC-17 version=3 inputs=win-edr,endpoint-network join=device_id+ProcessGuid within_seconds=120 condition=script-interpreter-to-new-destination required_fields=Image,ProcessGuid,DestinationHostname health_alert=separate-pipeline');
doc('collection-rule-dependencies', '収集', 'IT-ADM-01', '検知の入力経路',
  'rule=DET-PROC-17 scope=managed-windows inputs=win-edr,endpoint-network join_key=device_id+ProcessGuid fallback=edge-flow fallback_has_ProcessGuid=false evaluation=requires-both-inputs health_source=collection-register');
doc('reference-attack-rdp', '業務', 'IT-ADM-01', '参照する攻撃手法の資料',
  'reference=MITRE-ATTACK-T1021.001 name=Remote-Desktop-Protocol source=https://attack.mitre.org/techniques/T1021/001/ accessed=2026-10-27 content=有効なアカウントを使ったRDP接続が攻撃者のアクセス拡大に使われることがある scope=technique-description');

module.exports = { id: 'aonagi', name: '青凪商事・共通演習環境', periods, assets, sources, logs: logs.map(normalizeLog), normalizeLog };
