'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const environment = require('../src/environment.cjs');
const operations = require('../src/content-operations.cjs');
const {shiftAonagiRecord} = require('../src/timezone-data.cjs');
const rows = new Map(operations.logs.map(row => {
  const converted = shiftAonagiRecord(environment.normalizeLog(row));
  return [converted.id, converted];
}));
const row = id => {
  const found = rows.get(`ops-${id}`);
  assert.ok(found, id);
  return found;
};
const value = (record, key) => {
  const match = record.detail.match(new RegExp(`(?:^|\\s)${key}=([^\\s]+)`));
  assert.ok(match, `${record.id}: ${key}`);
  return match[1];
};
const jst = at => new Date(Date.parse(at) + 9 * 3600000).toISOString();

test('operations keep JST business dates while native instants move once to UTC', () => {
  for (const source of operations.logs) {
    const converted = rows.get(source.id);
    assert.equal(Date.parse(converted.at), Date.parse(source.at) - 9 * 3600000, source.id);
    assert.equal(jst(converted.at).slice(0, 19), source.at.slice(0, 19), source.id);
    assert.equal(converted.period, source.period, source.id);
    assert.equal(converted.provenance.timestampTimezone, 'UTC');
    assert.deepEqual(shiftAonagiRecord(converted), converted, `second conversion: ${source.id}`);
  }
  assert.equal(row('l01-cron-before').at, '2026-09-07T16:35:00Z');
  assert.equal(jst(row('l01-cron-before').at).slice(0, 10), '2026-09-08');
  assert.equal(value(row('e01-coverage'), 'from'), '2026-09-07');
  assert.equal(value(row('e01-coverage'), 'to'), '2026-09-16');
});

test('approved operations still fall within their converted business windows', () => {
  const cases = [
    ['d01-other-plan', ['d01-other']],
    ['d02-plan', ['d02-DESIGN-exec', 'd02-DESIGN-net', 'd02-SALES-exec', 'd02-SALES-net']],
    ['l01-oneoff-plan', ['l01-oneoff-auth']],
    ['l02-plan', ['l02-key-now', 'l02-auth', 'l02-dispatch']],
    ['l03-ticket', ['l03-archive', 'l03-send']],
  ];
  for (const [permit, events] of cases) {
    const [start, end] = value(row(permit), 'window_utc').split('/').map(Date.parse);
    assert.ok(Number.isFinite(start) && Number.isFinite(end), permit);
    for (const event of events) {
      assert.ok(start <= Date.parse(row(event).at) && Date.parse(row(event).at) <= end, event);
    }
  }
  assert.equal(value(row('l02-plan'), 'window_utc'), '2026-09-14T21:00Z/2026-09-14T21:20Z');
  assert.equal(jst(row('l02-auth').at).slice(0, 19), '2026-09-15T06:09:31');
  assert.equal(value(row('l01-maintenance'), 'login_window_utc'), '16:20Z/17:05Z');
  assert.equal(value(row('l01-maintenance'), 'cron_timezone'), 'Asia/Tokyo');
  const usualWebAuth = environment.logs.filter(item => item.id.startsWith('normal-auth-web-srv-01-'));
  assert.equal(usualWebAuth.length, 6);
  for (const item of usualWebAuth) {
    const time = jst(shiftAonagiRecord(item).at).slice(11, 16);
    assert.ok(time >= '01:20' && time <= '02:05', item.id);
  }
});

test('Linux syslog and auditd retain their native correlation and converted instant', () => {
  for (const record of rows.values()) {
    if (!record.raw) continue;
    const syslog = record.raw.match(/^Sep\s+(\d+) (\d{2}:\d{2}:\d{2}) /);
    if (syslog) {
      assert.equal(Number(syslog[1]), new Date(record.at).getUTCDate(), record.id);
      assert.equal(syslog[2], record.at.slice(11, 19), record.id);
    }
    for (const match of record.raw.matchAll(/audit\((\d+\.\d+):/g)) {
      assert.equal(Number(match[1]) * 1000, Date.parse(record.at), record.id);
    }
  }
  const auth = row('l02-auth');
  const dispatch = row('l02-dispatch');
  assert.equal(auth.pid, dispatch.parent_pid);
  assert.equal(dispatch.user, auth.user);
  assert.match(dispatch.detail, /\buid=1102\b/);
  assert.equal(value(auth, 'fingerprint'), value(row('l02-key-now'), 'fingerprint'));
  assert.equal(Date.parse(dispatch.at) - Date.parse(auth.at), 1000);
  assert.equal(value(row('l01-cron-now'), 'cron_timezone'), 'Asia/Tokyo');
});

test('remote access and retention use JST calendars without losing UTC event timestamps', () => {
  assert.equal(value(row('e02-owner'), 'remote_access_window'), '06:00/22:00');
  assert.equal(value(row('e02-owner'), 'remote_access_window_timezone'), 'Asia/Tokyo');
  assert.equal(jst(row('e02-auth').at).slice(11, 16), '20:41');
  assert.equal(value(row('g02-retention'), 'oldest_expires'), '2026-09-20T15:00:00Z');
  assert.equal(jst(value(row('g02-retention'), 'oldest_expires')).slice(0, 19), '2026-09-21T00:00:00');
  assert.equal(value(row('g02-retention'), 'baseline_oldest'), '2026-09-07');
  assert.equal(value(row('g02-retention'), 'export_timestamp_timezone'), 'UTC');
  assert.equal(value(row('g02-work-window'), 'export_before'), '2026-09-20');
});
