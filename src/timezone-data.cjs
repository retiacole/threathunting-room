'use strict';

// Aonagi fixtures are authored in local wall-clock values. Their temporary Z
// suffix is an authoring convention, not the final UTC timestamp. The catalog
// calls this once, after sensor normalization, for shared and validation rows.
// IDs and date-only business calendars remain unchanged.
const OFFSET_MS = 9 * 60 * 60 * 1000;
const MARKER = 'aonagi-jst-authoring-to-utc-v1';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shiftedISO(value) {
  const hasSeconds = /T\d{2}:\d{2}:\d{2}/.test(value);
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d\d:\d\d)?$/)?.[1];
  const explicitOffset = /[+-]\d{2}:\d{2}$/.test(value);
  const parsed = Date.parse(/[Z]|[+-]\d{2}:\d{2}$/.test(value) ? value : value + 'Z');
  if (!Number.isFinite(parsed)) return value;
  const iso = new Date(parsed - (explicitOffset ? 0 : OFFSET_MS)).toISOString();
  return hasSeconds ? iso.slice(0, 19) + (fraction ? '.' + iso.slice(20, 23).padEnd(fraction.length, '0').slice(0, fraction.length) : '') + 'Z' : iso.slice(0, 16) + 'Z';
}

function clock(value) {
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?Z?$/);
  if (!match) return null;
  if (Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] || 0) > 59) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]) - 540;
  const minuteOfDay = (minutes + 1440) % 1440;
  return { value: String(Math.floor(minuteOfDay / 60)).padStart(2, '0') + ':' + String(minuteOfDay % 60).padStart(2, '0') + (match[3] ? ':' + match[3] : '') + 'Z', dayOffset: Math.floor(minutes / 1440) };
}

function shiftText(input, originalAt, metadata) {
  if (typeof input !== 'string') return input;
  let text = input;
  const annotations = [];
  // Expand date + start/end clocks before moving either boundary. This also
  // handles maintenance windows crossing midnight in the authoring calendar.
  text = text.replace(/\b([A-Za-z_][\w-]*)=(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)Z?\/(\d{2}:\d{2}(?::\d{2})?)Z?(?=\s|$)/g,
    (_match, key, day, start, end) => {
      const endDay = end < start ? new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10) : day;
      return `${key}=${day}T${start}Z/${endDay}T${end}Z`;
    });

  // Protect ISO timestamps so the time-only pass cannot subtract nine hours a
  // second time from the clock inside an already converted ISO timestamp.
  const isoValues = [];
  text = text.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?(?![\d:])/g, value => {
    const index = isoValues.push(shiftedISO(value)) - 1;
    return `\u0001ISO${index}\u0002`;
  });

  text = text.replace(/\b([A-Za-z_][\w-]*)=((?:\d{2}:\d{2}(?::\d{2})?Z?)(?:\/(?:\d{2}:\d{2}(?::\d{2})?Z?))?)(?=\s|$)/g,
    (match, key, clocks) => {
      const values = clocks.split('/');
      const explicitlyUTC = /(?:^|_)utc(?:_|$)/i.test(key) || values.every(value => value.endsWith('Z'));
      if (!explicitlyUTC) {
        // Unqualified business clocks are wall-clock schedules, not instants.
        annotations.push(`${key}_timezone=Asia/Tokyo`);
        return match;
      }
      const converted = values.map(clock);
      if (converted.some(item => !item)) return match;
      const utcKey = /_utc$/i.test(key) ? key : key + '_utc';
      annotations.push(`${utcKey}_day_offset${converted.length > 1 ? 's' : ''}=${converted.map(item => item.dayOffset).join('/')}`);
      annotations.push('clock_timezone=UTC');
      return `${key}=${converted.map(item => item.value).join('/')}`;
    });
  text = text.replace(/\u0001ISO(\d+)\u0002/g, (_match, index) => isoValues[Number(index)]);

  // Native auditd epochs describe the same instant as row.at; serial numbers
  // and fractional precision are retained, and are not regenerated as IDs.
  text = text.replace(/\baudit\((\d+)(\.\d+)?(?=:)/g, (_match, seconds, fraction) => `audit(${BigInt(seconds) - 32400n}${fraction || ''}`);

  const year = Number(originalAt.slice(0, 4));
  text = text.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}) (\d{2}):(\d{2}):(\d{2})(?=\s)/g,
    (_match, month, day, hour, minute, second) => {
      const date = new Date(Date.UTC(year, MONTHS.indexOf(month), Number(day), Number(hour), Number(minute), Number(second)) - OFFSET_MS);
      return `${MONTHS[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, ' ')} ${date.toISOString().slice(11, 19)}`;
    });

  if (/\b(?:added_schedule|cron_schedule|schedule)="[^"\n]*\s[^"\n]*"/.test(text)) annotations.push('cron_timezone=Asia/Tokyo');
  if (metadata || annotations.length) {
    annotations.push('business_date_timezone=Asia/Tokyo');
    if (metadata) annotations.push('timestamp_timezone=UTC');
  }
  for (const annotation of new Set(annotations)) {
    const key = annotation.slice(0, annotation.indexOf('='));
    if (!new RegExp(`(?:^|\\s)${key}=`).test(text)) text += ' ' + annotation;
  }
  return text;
}

function shiftAonagiRecord(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Aonagi record must be an object');
  if (input.provenance?.timeConversion === MARKER) return { ...input, provenance: { ...input.provenance } };
  if (!Number.isFinite(Date.parse(input.at))) throw new Error(`Invalid Aonagi authoring timestamp: ${input.id}`);
  const metadata = ['業務', '収集'].includes(input.source);
  const row = { ...input, at: shiftedISO(input.at),
    detail: shiftText(input.detail, input.at, metadata),
    provenance: { ...input.provenance, timeConversion: MARKER, authoringTimezone: 'Asia/Tokyo', timestampTimezone: 'UTC', businessDateTimezone: 'Asia/Tokyo' } };
  if (input.raw !== undefined) row.raw = shiftText(input.raw, input.at, metadata);
  return row;
}

module.exports = { shiftAonagiRecord };
