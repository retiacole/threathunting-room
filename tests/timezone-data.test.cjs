'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
const authored = require('../src/environment.cjs');
const operational = require('../src/content-operations.cjs');
const { shiftAonagiRecord } = require('../src/timezone-data.cjs');
const { tasks, environments } = require('../src/catalog.cjs');
const { createPublicBundle } = require('../src/public-data.cjs');
const shared = environments.aonagi;
const byId = new Map(shared.logs.map(row => [row.id, row]));
const nativeFields = text => Object.fromEntries([...String(text || '').matchAll(/([A-Za-z_][\w-]*)=(?:"([^"]*)"|([^\s]+))/g)].map(match => [match[1].toLowerCase(), match[2] ?? match[3]]));
const jstDay = at => new Date(Date.parse(at) + 9 * 3600000).toISOString().slice(0, 10);

test('catalog converts every shared record once while retaining IDs, correlations and local business dates', () => {
  const input = [...authored.logs, ...operational.logs.map(authored.normalizeLog)];
  assert.equal(input.length, shared.logs.length);
  for (const row of input) {
    const output = byId.get(row.id);
    assert.ok(output, row.id);
    assert.equal(Date.parse(row.at) - Date.parse(output.at), 9 * 3600000, `${row.id} exactly nine hours`);
    assert.equal(jstDay(output.at), row.at.slice(0, 10), `${row.id} keeps business date`);
    for (const key of ['period', 'process_guid', 'parent_process_guid', 'session', 'request_id', 'flow_id', 'device_id', 'hash']) assert.equal(output[key], row[key], `${row.id} keeps ${key}`);
    assert.deepEqual(shiftAonagiRecord(output), output, `${row.id} cannot shift twice`);
  }
});

test('native timestamps, syslog dates and audit epochs refer to the converted UTC instant', () => {
  const rows = [...shared.logs, ...tasks.filter(task => task.chapter === 'C').flatMap(task => task.rubric.query.validation.logs)];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let audits = 0, syslogs = 0;
  for (const row of rows) {
    for (const text of [row.detail, row.raw]) {
      const fields = nativeFields(text);
      for (const key of ['utctime', 'event_time']) if (fields[key]) assert.equal(Date.parse(fields[key]), Date.parse(row.at), `${row.id} ${key}`);
      for (const match of String(text || '').matchAll(/audit\((\d+(?:\.\d+)?):/g)) {
        assert.equal(Number(match[1]) * 1000, Date.parse(row.at), `${row.id} audit epoch`);
        audits++;
      }
    }
    const syslog = row.raw?.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+) (\d\d:\d\d:\d\d)/);
    if (syslog) {
      const date = new Date(row.at);
      assert.equal(syslog[1], months[date.getUTCMonth()], row.id);
      assert.equal(Number(syslog[2]), date.getUTCDate(), row.id);
      assert.equal(syslog[3], row.at.slice(11, 19), row.id);
      syslogs++;
    }
  }
  assert.ok(audits > 20 && syslogs > 20, 'exercise actual native sensors');
});

test('business metadata clearly relates previous-UTC-day schedules and maintenance to JST', () => {
  assert.equal(byId.get('normal-process-build-srv-01-0907').at, '2026-09-06T17:00:00.000Z');
  assert.equal(byId.get('normal-backup-0907').at, '2026-09-06T19:00:00Z');
  assert.equal(byId.get('event-net-20260915-103203').at, '2026-09-15T01:32:03Z');
  const build = nativeFields(byId.get('business-build-daily').detail);
  assert.equal(build.schedule, '17:00Z');
  assert.equal(build.schedule_utc_day_offset, '-1');
  assert.equal(build.business_date_timezone, 'Asia/Tokyo');
  const backup = nativeFields(byId.get('business-backup-daily').detail);
  assert.equal(backup.schedule, '19:00Z');
  assert.equal(backup.receipt_check, '19:10Z');
  assert.equal(backup.receipt_check_utc_day_offset, '-1');
  const gap = nativeFields(byId.get('collection-finance-gap').detail);
  assert.equal(gap.stop, '2026-09-15T01:00:00Z');
  assert.equal(gap.resume, '2026-09-15T03:00:00Z');
  const web = nativeFields(byId.get('business-linux-maintenance').detail);
  assert.equal(web.window, '16:20Z/17:05Z');
  assert.equal(web.window_utc_day_offsets, '-1/-1');
});

test('published JST period filters include early business-day events on the previous UTC date', () => {
  const bundle = createPublicBundle({ tasks, environments });
  const env = bundle.environments.aonagi;
  for (const period of ['baseline', 'current']) {
    assert.equal(env.periods[period].timezone, 'Asia/Tokyo');
    const expected = env.logs.filter(row => row.period === period);
    const found = E.filterLogs(env.logs, { period, ...env.periods[period] });
    assert.deepEqual(found.map(row => row.id).sort(), expected.map(row => row.id).sort());
    assert.ok(found.some(row => row.at.slice(0, 10) < env.periods[period].from), `${period} has prior-UTC-date work`);
    for (const row of found) assert.ok(jstDay(row.at) >= env.periods[period].from && jstDay(row.at) <= env.periods[period].to, row.id);
  }
  for (const task of bundle.tasks.filter(task => task.chapter === 'C')) {
    const rows = new Map(env.logs.map(row => [row.id, row]));
    assert.equal(E.gradeQuery(task.logIds.map(id => rows.get(id)), task.explanation.sampleQuery, task.rubric.query).passed, true, task.id);
  }
});

test('authoring conversion handles calendar rollover and anchored windows without shifting date-only identifiers', () => {
  const input = {
    id: 'event-20260101-020304', at: '2026-01-01T02:03:04.123Z', period: 'current', source: '業務', host: 'BUILD-SRV-01',
    detail: 'window_utc=2026-01-01T01:50/02:15 approved_at=2026-01-01T00:10:00Z date=2026-01-01 schedule=02:00Z',
    raw: 'Jan  1 02:03:04 BUILD-SRV-01 job[14]: started', provenance: { sensor: 'job-scheduler' }
  };
  const output = shiftAonagiRecord(input);
  assert.equal(output.id, input.id);
  assert.equal(output.at, '2025-12-31T17:03:04.123Z');
  assert.match(output.detail, /window_utc=2025-12-31T16:50Z\/2025-12-31T17:15Z/);
  assert.match(output.detail, /approved_at=2025-12-31T15:10:00Z/);
  assert.match(output.detail, /\bdate=2026-01-01\b/);
  assert.match(output.raw, /^Dec 31 17:03:04 /);
  assert.deepEqual(shiftAonagiRecord(output), output);
});
