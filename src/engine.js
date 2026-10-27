/* ThreatHunting-room: dependency-free, deterministic learning engine. */
(function (root, factory) {
  'use strict';
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.THEngine = engine;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FIELDS = new Set(['host', 'user', 'source', 'sensor', 'process', 'destination', 'parent', 'session', 'pid', 'process_guid', 'parent_process_guid', 'request_id', 'device_id', 'hash']);
  const EXACT_FIELDS = new Set(['sensor', 'session', 'pid', 'process_guid', 'parent_process_guid', 'request_id', 'device_id', 'hash']);
  const TIMEZONES = new Set(['UTC', 'Asia/Tokyo']);
  const DATE_FIELDS = new Set(['after', 'before']);
  const QUERY_FIELDS = new Set([...FIELDS, ...DATE_FIELDS]);
  const ROLES = new Set(['support', 'counter', 'context', 'gap']);
  const ROLE_LABELS = {support:'支持',counter:'反証',context:'背景',gap:'観測不足'};
  const VERDICTS = new Set(['supported', 'benign', 'insufficient', 'unsubstantiated']);
  const OPERATIONS = new Set(['search', 'aggregate', 'compare', 'pivot']);
  const TUTORIAL_ACTIONS = new Set(['read-brief', 'opened-log', 'opened-answers', 'viewed-solution', 'graded']);
  const OP_LABELS = {search: '条件を指定して検索する', aggregate: '記録を集計する', compare: '通常期間と比較する', pivot: '対象から関連記録を追う'};
  const EMPTY_KEY = '（記録なし）';
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const asText = value => value == null ? '' : String(value);
  const lower = value => asText(value).toLocaleLowerCase('en-US');
  const unique = arr => [...new Set(arr)];
  const isArray = Array.isArray;
  const sensorOf = log => log.sensor || (log.provenance && log.provenance.sensor) || '';
  const periodTimezone = task => task.periods && (task.periods.timezone || task.periods.current && task.periods.current.timezone) || 'UTC';

  function parseQuery(query, locations) {
    const terms = [], groups = [], errors = [];
    if (typeof query !== 'string') return {terms, groups, errors: ['検索条件は文字列で入力してください。']};
    if (query.length > 2000) return {terms, groups, errors: ['検索条件は2,000文字以内で入力してください。']};
    let group = [], afterOR = false;
    let i = 0;
    while (i < query.length) {
      while (/\s/.test(query[i] || '') && i < query.length) i++;
      if (i >= query.length) break;
      if (/^OR(?:\s|$)/.test(query.slice(i))) {
        if (!group.length) errors.push('ORの前後には検索条件が必要です。');
        else groups.push(group);
        group = [];
        afterOR = true;
        i += 2;
        continue;
      }
      const start = i;
      let negated = false, field = null, value = '';
      if (query[i] === '-') { negated = true; i++; }
      const fieldMatch = query.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*):/);
      if (fieldMatch) {
        field = fieldMatch[1].toLowerCase();
        i += fieldMatch[0].length;
        if (!QUERY_FIELDS.has(field)) errors.push('未対応のフィールド「' + field + '」です。' + [...QUERY_FIELDS].join(' / ') + ' が使えます。');
        while (i < query.length && /\s/.test(query[i])) i++;
      }
      const valueStart = i;
      if (query[i] === '"') {
        i++;
        let closed = false;
        while (i < query.length) {
          if (query[i] === '"') { i++; closed = true; break; }
          if (query[i] === '\\' && (query[i + 1] === '"' || query[i + 1] === '\\')) { value += query[i + 1]; i += 2; }
          else value += query[i++];
        }
        if (!closed) errors.push('引用符（"）を閉じてください。');
        if (i < query.length && !/\s/.test(query[i])) {
          errors.push('引用符の後は空白で区切ってください。');
          while (i < query.length && !/\s/.test(query[i])) i++;
        }
      } else {
        while (i < query.length && !/\s/.test(query[i])) value += query[i++];
        if (value.includes('"')) errors.push('語句全体を引用符（"）で囲んでください。');
      }
      if (!value.trim()) errors.push(field ? '「' + field + ':」の後に値を入力してください。' : '検索する語句を入力してください。');
      else {
        if (DATE_FIELDS.has(field) && !Number.isFinite(dayStamp(value))) errors.push('「' + field + ':」には実在する日付をYYYY-MM-DDで指定してください（UTC・当日を含む）。');
        const term = {field, value, negated};
        terms.push(term);
        group.push(term);
        if (isArray(locations)) locations.push({start, valueStart, end: i, term, quoted: query[valueStart] === '"'});
        afterOR = false;
      }
    }
    if (group.length) groups.push(group);
    if (afterOR) errors.push('ORの前後には検索条件が必要です。');
    return {terms, groups, errors: unique(errors)};
  }

  function logIdResolver(aliases) {
    const map = new Map(aliases && typeof aliases === 'object' ? Object.entries(aliases)
      .filter(([, value]) => typeof value === 'string' && value)
      .map(([key, value]) => [lower(key), value]) : []);
    return id => map.get(lower(id)) || id;
  }

  function replaceQueryAliases(query, resolve, aliases, legacyHosts) {
    const locations = [];
    if (parseQuery(query, locations).errors.length) return query;
    const textAliases = Object.fromEntries(Object.entries(aliases && aliases.text || {}).filter(([key]) => key.length >= 6));
    const resolveText = logIdResolver(textAliases);
    const resolveLegacyHost = logIdResolver(legacyHosts);
    let result = query;
    for (const {valueStart, end, term, quoted} of locations.reverse()) {
      let replacement;
      if (term.field === null) {
        const value = resolve(term.value);
        const renamed = value.length >= 6 ? resolveLegacyHost(value) : value;
        replacement = renamed !== value ? logIdResolver(aliases && aliases.fields && aliases.fields.host)(renamed) : resolveText(value);
      }
      else if (aliases && aliases.fields && own(aliases.fields, term.field)) {
        const value = term.field === 'host' ? resolveLegacyHost(term.value) : term.value;
        replacement = logIdResolver(aliases.fields[term.field])(value);
      } else if (term.field === 'host') replacement = resolveLegacyHost(term.value);
      else continue;
      if (replacement === term.value) continue;
      const escaped = quoted || /\s|"|^OR$|^-|^[A-Za-z_][A-Za-z0-9_]*:/.test(replacement)
        ? '"' + replacement.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : replacement;
      result = result.slice(0, valueStart) + escaped + result.slice(end);
    }
    // Keep an unfinished or over-limit migration editable instead of truncating
    // a learner's condition or rejecting their otherwise valid progress file.
    return result.length <= 2000 ? result : query;
  }

  function dayStamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const stamp = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp : NaN;
  }

  function filterLogs(logs, filters) {
    filters = filters && typeof filters === 'object' ? filters : {};
    const parsed = parseQuery(filters.query == null ? '' : filters.query);
    if (parsed.errors.length || !isArray(logs)) return [];
    const period = filters.period || 'current';
    if (!['all', 'current', 'baseline'].includes(period)) return [];
    const timezone = filters.timezone == null ? 'UTC' : filters.timezone;
    if (!TIMEZONES.has(timezone)) return [];
    const offset = timezone === 'Asia/Tokyo' ? 9 * 3600000 : 0;
    const from = filters.from ? dayStamp(filters.from) - offset : -Infinity;
    const to = filters.to ? dayStamp(filters.to) + 86400000 - 1 - offset : Infinity;
    if (Number.isNaN(from) || Number.isNaN(to) || from > to) return [];
    return logs.filter(log => {
      if (!log || typeof log !== 'object') return false;
      if (period !== 'all' && log.period !== period) return false;
      if (filters.source && lower(log.source) !== lower(filters.source)) return false;
      if (filters.host && lower(log.host) !== lower(filters.host)) return false;
      const stamp = Date.parse(log.at);
      if (!Number.isFinite(stamp) || stamp < from || stamp > to) return false;
      return parsed.groups.length === 0 || parsed.groups.some(group => group.every(term => {
        if (DATE_FIELDS.has(term.field)) {
          const boundary = dayStamp(term.value);
          const match = term.field === 'after' ? stamp >= boundary : stamp < boundary + 86400000;
          return term.negated ? !match : match;
        }
        const haystack = term.field ? lower(term.field === 'sensor' ? sensorOf(log) : log[term.field]) : lower([
          log.id, log.at, log.source, sensorOf(log), log.host, log.user, log.event, log.detail,
          log.destination, log.process, log.parent, log.session, log.pid,
          log.process_guid, log.parent_process_guid, log.request_id, log.device_id, log.hash, log.raw, log.bytes
        ].filter(value => value != null).join(' '));
        const match = EXACT_FIELDS.has(term.field) ? haystack === lower(term.value) : haystack.includes(lower(term.value));
        return term.negated ? !match : match;
      }));
    });
  }

  function groupKey(log, field) {
    if (field === 'parent_process') {
      const values = {parent: asText(log.parent).trim(), process: asText(log.process).trim()};
      return {identity: JSON.stringify([values.parent, values.process]), key: (values.parent || EMPTY_KEY) + ' → ' + (values.process || EMPTY_KEY), values};
    }
    const key = asText(field === 'sensor' ? sensorOf(log) : log[field]).trim() || EMPTY_KEY;
    return {identity: EXACT_FIELDS.has(field) ? lower(key) : key, key};
  }

  function aggregateLogs(logs, field, options) {
    if (!isArray(logs) || (!FIELDS.has(field) && field !== 'parent_process')) return [];
    const groups = new Map();
    logs.forEach(log => {
      if (!log || typeof log !== 'object') return;
      const {identity, ...key} = groupKey(log, field);
      if (!groups.has(identity)) groups.set(identity, {...key, count: 0, hosts: new Set(), bytes: 0});
      const row = groups.get(identity);
      row.count++;
      if (log.host) row.hosts.add(asText(log.host));
      if (Number.isFinite(log.bytes) && log.bytes > 0) row.bytes += log.bytes;
    });
    const direction = options && options.sort === 'count-asc' ? 1 : -1;
    return [...groups.values()].map(row => ({...row, hosts: [...row.hosts].sort()}))
      .sort((a, b) => direction * (a.count - b.count) || a.key.localeCompare(b.key, 'ja'));
  }

  function compareLogs(logs, field, source) {
    if (!isArray(logs) || (!FIELDS.has(field) && field !== 'parent_process')) return [];
    const groups = new Map();
    logs.forEach(log => {
      if (!log || !['current', 'baseline'].includes(log.period) || (source && lower(source) !== lower(log.source))) return;
      const {identity, ...key} = groupKey(log, field);
      if (!groups.has(identity)) groups.set(identity, {...key, baseline: 0, current: 0});
      groups.get(identity)[log.period]++;
    });
    return [...groups.values()].map(row => ({...row, delta: row.current - row.baseline, ratio: row.baseline ? row.current / row.baseline : null}))
      .sort((a, b) => b.delta - a.delta || b.current - a.current || a.key.localeCompare(b.key, 'ja'));
  }

  function gradeQuery(logs, query, spec) {
    spec = spec && typeof spec === 'object' ? spec : {};
    const evaluate = (corpus, expected, filters) => {
      const errors = [...parseQuery(query).errors];
      if (!isArray(corpus) || corpus.some(log => !log || typeof log.id !== 'string' || !Number.isFinite(Date.parse(log.at))) || (isArray(corpus) && unique(corpus.map(log => log && log.id)).length !== corpus.length)) errors.push('検索課題の記録を確認できません。');
      const expectedIds = isArray(expected) ? unique(expected.filter(id => typeof id === 'string')) : [];
      if (!isArray(expected) || !expected.length || expected.some(id => typeof id !== 'string') || expectedIds.length !== expected.length) errors.push('検索課題の正解集合を確認できません。');
      const fixed = {period: 'all', ...(filters && typeof filters === 'object' ? filters : {}), query};
      if (!['all', 'baseline', 'current'].includes(fixed.period)) errors.push('採点用の期間指定を確認できません。');
      if (!TIMEZONES.has(fixed.timezone == null ? 'UTC' : fixed.timezone)) errors.push('採点用の日付のタイムゾーンを確認できません。');
      if ((fixed.from && !Number.isFinite(dayStamp(fixed.from))) || (fixed.to && !Number.isFinite(dayStamp(fixed.to))) || (fixed.from && fixed.to && fixed.from > fixed.to)) errors.push('採点用の日付範囲を確認できません。');
      const available = new Set(isArray(corpus) ? filterLogs(corpus, {...fixed, query: ''}).map(log => log.id) : []);
      if (expectedIds.some(id => !available.has(id))) errors.push('採点用の範囲に正解の記録がありません。');
      const matched = errors.length ? [] : filterLogs(corpus, fixed).map(log => log.id);
      const expectedSet = new Set(expectedIds), matchedSet = new Set(matched);
      const missing = expectedIds.filter(id => !matchedSet.has(id));
      const unexpected = matched.filter(id => !expectedSet.has(id));
      const hits = matched.length - unexpected.length;
      return {passed: errors.length === 0 && missing.length === 0 && unexpected.length === 0, errors: unique(errors), matched, missing, unexpected, precision: matched.length ? hits / matched.length : 0, recall: expectedIds.length ? hits / expectedIds.length : 0};
    };
    const result = evaluate(logs, spec.expected, spec.filters);
    if (spec.validation != null) {
      const validation = spec.validation && typeof spec.validation === 'object' ? spec.validation : {};
      result.validation = evaluate(validation.logs, validation.expected, {...(spec.filters || {}), ...(validation.filters || {})});
      result.passed = result.passed && result.validation.passed;
    }
    return result;
  }

  // Open hunts have no fixed true-positive set. Check reproducibility only;
  // never present precision/recall or certify the learner's reasoning.
  function checkOpenQuery(task, draft) {
    const query=asText(draft.query), errors=[...parseQuery(query).errors];
    if(!query.trim()) errors.push('再現する検索式を入力してください。');
    const matched=errors.length?[]:filterLogs(task.logs,{period:'all',query}).map(log=>log.id);
    const selected=isArray(draft.evidence)?draft.evidence:[], found=new Set(matched);
    const missing=selected.filter(e=>!e||!found.has(e.id)).map(e=>e&&e.id);
    return {openHunt:true,errors,matched,missing,passed:!errors.length&&selected.length>0&&missing.length===0&&matched.length>0&&matched.length<task.logs.length};
  }

  function gradeTask(task, draft, operations) {
    const rubric = task && task.rubric || {};
    draft = draft && typeof draft === 'object' ? draft : {};
    const criteria = [];
    const add = (id, label, passed, yes, no) => criteria.push({id, label, passed: Boolean(passed), detail: passed ? yes : no});
    const selected = Array.isArray(draft.evidence) ? draft.evidence : [];
    const logs = new Set((task && task.logs || []).map(log => log.id));
    const targets = isArray(draft.targets) ? draft.targets : [];
    const sources = isArray(draft.sources) ? draft.sources : [];
    const ops = new Set(isArray(operations) ? operations : []);
    let queryResult;

    if (rubric.openHunt) {
      const rows=selected.map(e=>(task.logs||[]).find(log=>log.id===e?.id)).filter(Boolean);
      const availableHosts=new Set((task.assets||[]).map(a=>a.host)),availableSources=new Set((task.sources||[]).map(s=>s.name));
      add('open-targets','自分で選んだ対象',targets.length>0&&new Set(targets).size===targets.length&&targets.every(host=>availableHosts.has(host)),'対象を記録しました。','台帳にある対象を一つ以上選んでください。');
      add('open-sources','使用したログと証拠の対応',sources.length>=2&&new Set(sources).size===sources.length&&sources.every(source=>availableSources.has(source)&&rows.some(row=>row.source===source))&&rows.every(row=>sources.includes(row.source)),'選んだ種類と証拠の種類が対応しています。','証拠に使ったログ種類を2種類以上選び、証拠と対応させてください。');
      add('open-evidence','両期間の証拠と検討メモ',selected.length>=4&&selected.length<=8&&rows.length===selected.length&&new Set(selected.map(e=>e.id)).size===selected.length&&selected.every(e=>ROLES.has(e.role)&&typeof e.note==='string'&&e.note.trim())&&['baseline','current'].every(period=>rows.some(row=>row.period===period))&&['context','counter','gap'].every(role=>selected.some(e=>e.role===role)),'両期間・背景・反証・観測不足と各メモがそろっています。役割の意味は自己比較で確かめてください。','4〜8件の証拠にメモを付け、比較用と今回の両期間、背景・反証・観測不足の役割を含めてください。');
      add('open-report','結論・限界・次の行動の記入',VERDICTS.has(draft.verdict)&&['summary','limitations','nextAction'].every(key=>typeof draft[key]==='string'&&draft[key].trim()),'報告の各欄に記入があります。内容の妥当性は自動判定しません。','結論を選び、調査メモ・限界・次の行動を記入してください。');
      queryResult=checkOpenQuery(task,draft);
      add('open-query','選んだ証拠を再取得する検索',queryResult.passed,'提出式で選んだ証拠を再取得できました。検索の適切さは自己比較で確認します。','両期間の全記録に適用して証拠を再取得できる、空欄でも全件抽出でもない検索式を記入してください。');
    }
    if (own(rubric, 'hypotheses')) add('hypothesis', '調べる仮説', isArray(rubric.hypotheses) && rubric.hypotheses.includes(draft.hypothesis), '調査の目的に合う仮説を選べています。', '依頼内容と、記録から検証できることを読み直して仮説を選んでください。');
    if (own(rubric, 'targets')) {
      const expected = new Set(rubric.targets || []), actual = new Set(targets);
      const okay = actual.size === expected.size && [...expected].every(target => actual.has(target));
      add('targets', '調査対象', okay, '対象を根拠に沿って絞れています。', '対象に不足または余分な端末があります。比較と関連記録から対象を見直してください。');
    }
    if (own(rubric, 'verdict')) add('verdict', '結論', draft.verdict === rubric.verdict, '教材の記録に合う結論です。', '不審な特徴、正当な業務の説明、観測の不足を区別して結論を見直してください。');
    if (own(rubric, 'sources')) {
      const available = new Set((task.sources || []).map(source => source.name));
      const expected = new Set(rubric.sources || []), actual = new Set(sources);
      const missing = [...expected].filter(source => !actual.has(source));
      const extra = [...actual].filter(source => !expected.has(source) || !available.has(source));
      const okay = missing.length === 0 && extra.length === 0 && [...expected].every(source => available.has(source));
      const diagnosis = [missing.length ? '不足：' + missing.join('、') + '。' : '', extra.length ? '過剰：' + extra.join('、') + '。' : ''].join('');
      add('sources', '確認するログの種類', okay, '確認に必要なログの種類を過不足なく選べています。', diagnosis + '各ログで何を確かめるかを見直し、この仮説の検証に必要な種類を選んでください。');
    }
    if (rubric.scope) {
      const from = dayStamp(draft.from), to = dayStamp(draft.to);
      const expected = task.periods && task.periods.current || {};
      const okay = Number.isFinite(from) && Number.isFinite(to) && from === dayStamp(expected.from) && to === dayStamp(expected.to);
      add('scope', '調査期間', okay, '今回の調査期間を正確に報告しています。', '左側に示した「今回」の開始日・終了日を報告してください（' + (periodTimezone(task) === 'Asia/Tokyo' ? 'JST' : 'UTC') + '）。収録されていない期間まで調査済みにはできません。');
    }
    if (own(rubric, 'finding')) add('finding', '限界・次に確かめること', draft.finding === rubric.finding, '確認できた範囲と、残る確認事項を区別できています。', '記録にない事実を断定せず、観測の限界や次の調査を選び直してください。');
    if (own(rubric, 'alternative')) add('alternative', '良性の説明を検討した結果', draft.alternative === rubric.alternative && (task.alternativeExplanations || []).some(item => item.id === draft.alternative), '比較した良性の活動を、今回の説明として適用できない理由を確認しています。', '良性の活動と業務条件を比較し、今回の観測を説明できる範囲と一致しない点を選んでください。');
    if (own(rubric, 'choice')) add('choice', '判断の選択', draft.choice === rubric.choice, '観測できることと課題の目的に合う判断です。', '選択肢を記録・資産情報と照らして見直してください。');
    if (own(rubric, 'selections')) {
      const actual = new Set(isArray(draft.selections) ? draft.selections : []), expected = new Set(rubric.selections || []);
      add('selections', task.selectionLabel || '必要な項目の選択', actual.size === expected.size && [...expected].every(id => actual.has(id)), '必要な項目を過不足なく選べています。', '選んだ項目に不足または余分な項目があります。調査目的と観測範囲を確認してください。');
    }
    if (rubric.selfReview) add('self-review', '自分の仮説とモデルの比較', typeof draft.ownHypothesis === 'string' && Boolean(draft.ownHypothesis.trim()) && draft.reviewedHypothesis === draft.ownHypothesis, '現在の仮説をモデルと比較しました。文章の意味を自動採点した結果ではありません。', '自分の仮説を書き、モデルとの共通点・違いを確認してください。文章を編集した場合は再び比較してください。');
    if (rubric.reflection) add('reflection', '考察とモデルの比較', typeof draft.reflection === 'string' && Boolean(draft.reflection.trim()) && draft.reviewedReflection === draft.reflection, '現在の考察をモデルと比較しました。文章の意味を自動採点した結果ではありません。', '自分の考察を書き、モデルと比較してください。文章を編集した場合は再び比較してください。');
    if (rubric.query) {
      queryResult = gradeQuery(task.logs || [], draft.query == null ? '' : draft.query, rubric.query);
      const describe = (result, label) => label + '：' + (result.errors.length ? result.errors.join(' ') : '不足 ' + result.missing.length + '件' + (result.missing.length ? '（' + result.missing.join('、') + '）' : '') + '、余分 ' + result.unexpected.length + '件' + (result.unexpected.length ? '（' + result.unexpected.join('、') + '）' : '') + '。');
      add('query', '検索結果の検証', queryResult.passed, '対象の記録を過不足なく抽出しました。' + (queryResult.validation ? '別の記録でも条件が成立しています。' : ''), describe(queryResult, '教材の記録') + (queryResult.validation ? ' ' + describe(queryResult.validation, '別の検証記録') : ''));
      criteria[criteria.length - 1].result = queryResult;
    }

    if (!rubric.openHunt && ((rubric.evidenceGroups || []).length || selected.length)) {
      const valid = selected.length <= 8 && unique(selected.map(e => e && e.id)).length === selected.length && selected.every(e => e && logs.has(e.id) && ROLES.has(e.role));
      add('evidence-valid', '証拠の登録', valid, '教材に存在する証拠を、重複なく8件以内に整理しています。', '証拠はこの課題の記録から重複なく8件以内に選び、役割を設定してください。');
      (rubric.evidenceGroups || []).forEach((group, index) => {
        const okay = selected.some(e => e && (group.anyOf || []).includes(e.id) && e.role === group.role && logs.has(e.id));
        add('evidence-' + index, group.label || '根拠 ' + (index + 1), okay, '必要な記録を適切な役割で登録しています。', 'この観点を確かめる記録と、証拠の役割（支持・反証・背景・観測不足）を見直してください。');
      });
      const allowed = new Map();
      const allow = (id, role) => {
        if (!logs.has(id) || !ROLES.has(role)) return;
        if (!allowed.has(id)) allowed.set(id, new Set());
        allowed.get(id).add(role);
      };
      (rubric.evidenceGroups || []).forEach(group => (group.anyOf || []).forEach(id => allow(id, group.role)));
      (rubric.evidenceExtras || []).forEach(extra => (isArray(extra.roles) ? extra.roles : []).forEach(role => allow(extra.id, role)));
      const unrelated = selected.filter(e => !e || !allowed.get(e.id)?.has(e.role));
      const labels = unrelated.map(e => asText(e && e.id) + '（' + asText(e && e.role) + ' / ' + (ROLE_LABELS[e && e.role] || '役割未設定') + '）');
      add('evidence-precision', '証拠の関連性と役割', unrelated.length === 0,
        selected.length ? '登録したすべての記録が、この調査の根拠または妥当な補足として役立っています。' : '証拠は未登録です。必要な根拠は上の各項目で確認します。',
        '調査との関連または役割を確認してください：' + labels.join('、') + '。不要な記録は外し、残す記録には適切な役割を指定してください。');
    }
    (rubric.operations || []).forEach(operation => add('operation-' + operation, OP_LABELS[operation] || operation, ops.has(operation), '必要な調査操作を実施しました。', 'この操作を使って記録を確認してください。画面を開くだけでは実施済みになりません。'));
    const earned = criteria.filter(criterion => criterion.passed).length;
    const result = {passed: criteria.length > 0 && earned === criteria.length, earned, total: criteria.length, criteria};
    if (queryResult) result.query = queryResult;
    return result;
  }

  function gradeExit(task, exitDraft) {
    const exit = task && task.exit || {};
    return gradeTask({...task, ...exit, logs: exit.logs || task && task.logs || [], rubric: exit.rubric || {}}, exitDraft, []);
  }

  // Extensions are optional decisions after an investigation, never part of its rubric.
  function extensionQuestions(task) {
    const questions = task && task.extension && task.extension.questions;
    const id = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !value.includes('\u0000') && !['__proto__', 'constructor', 'prototype'].includes(value);
    if (!isArray(questions) || !questions.length || questions.length > 100) return null;
    const seen = new Set();
    for (const question of questions) {
      if (!question || !id(question.id) || seen.has(question.id) || !isArray(question.options) || !question.options.length || question.options.length > 100) return null;
      seen.add(question.id);
      const options = question.options.map(option => option && option.id);
      if (options.some(option => !id(option)) || unique(options).length !== options.length || !options.includes(question.answer)) return null;
    }
    return questions;
  }

  function gradeExtension(task, answers) {
    const questions = extensionQuestions(task);
    if (!questions) return {passed: false, earned: 0, total: 0, criteria: []};
    const plain = answers && typeof answers === 'object' && !isArray(answers) && [Object.prototype, null].includes(Object.getPrototypeOf(answers));
    const valid = plain && Object.keys(answers).every(key => {
      const question = questions.find(item => item.id === key);
      return question && typeof answers[key] === 'string' && answers[key].length <= 200 && (answers[key] === '' || question.options.some(option => option.id === answers[key]));
    });
    const criteria = questions.map(question => ({id: question.id, passed: Boolean(valid && own(answers, question.id) && answers[question.id] === question.answer)}));
    const earned = criteria.filter(criterion => criterion.passed).length;
    return {passed: earned === criteria.length, earned, total: criteria.length, criteria};
  }

  function validateProgress(value, tasks) {
    const fail = message => { throw new Error('進捗ファイルを読み込めません。' + message); };
    const plain = (obj, label) => {
      if (!obj || typeof obj !== 'object' || isArray(obj) || ![Object.prototype, null].includes(Object.getPrototypeOf(obj))) fail(label + 'の形式が正しくありません。');
      if (['__proto__', 'constructor', 'prototype'].some(key => own(obj, key))) fail(label + 'に使用できない項目があります。');
      return obj;
    };
    const text = (input, max, label) => {
      if (input == null) return '';
      if (typeof input !== 'string' || input.length > max) fail(label + 'の形式または長さが正しくありません。');
      return input.replace(/\u0000/g, '');
    };
    const list = (input, allowed, max, label) => {
      if (input == null) return [];
      if (!isArray(input) || input.length > max || input.some(item => typeof item !== 'string' || !allowed.has(item))) fail(label + 'に課題にない値が含まれています。');
      return unique(input);
    };
    plain(value, '進捗');
    if (![1, 2, 3].includes(value.schemaVersion)) fail('対応する形式はバージョン1・2・3です。');
    const legacyMigration = value.schemaVersion === 1;
    const migrating = value.schemaVersion < 3;
    const choice = (input, allowed, legacyMap, label, strict = false, resolve) => {
      let selected = text(input, 200, label);
      if (!selected) return '';
      if (legacyMigration && legacyMap && typeof legacyMap === 'object' && own(legacyMap, selected)) {
        selected = legacyMap[selected];
        if (typeof selected !== 'string') fail(label + 'の移行情報を確認できません。');
      }
      if (selected && resolve) selected = resolve(selected);
      if (!selected || allowed.has(selected)) return selected;
      if (legacyMigration && !strict) return '';
      fail(label + 'に課題にない値が含まれています。');
    };
    const choicesList = (input, allowed, max, legacyMap, label, resolve) => {
      if (input == null) return [];
      if (!isArray(input) || input.length > max || input.some(item => typeof item !== 'string')) fail(label + 'の形式が正しくありません。');
      return unique(input.map(item => choice(item, allowed, legacyMap, label, false, resolve)).filter(Boolean));
    };
    try { if (JSON.stringify(value).length > 4000000) fail('ファイルが大きすぎます（上限4MB）。'); } catch (error) { if (/進捗ファイル/.test(error.message)) throw error; fail('JSONとして保存されたファイルを選んでください。'); }
    if (!isArray(tasks)) fail('教材情報を確認できません。');
    const taskMap = new Map(tasks.map(task => [task.id, task]));
    const states = plain(value.taskStates, 'タスクの進捗');
    const keys = Object.keys(states);
    if (keys.length > tasks.length || keys.some(id => !taskMap.has(id))) fail('この教材にないタスクが含まれています。');
    if (value.lastTask != null && (typeof value.lastTask !== 'string' || !taskMap.has(value.lastTask))) fail('最後に開いたタスクを確認できません。');
    if (value.activeTask != null && (typeof value.activeTask !== 'string' || !taskMap.has(value.activeTask))) fail('現在開いているタスクを確認できません。');
    const activeTask = value.activeTask === undefined ? (migrating ? value.lastTask || null : null) : value.activeTask;
    const timeDisplay = value.timeDisplay == null ? 'utc' : value.timeDisplay;
    if (!['utc', 'utc-jst'].includes(timeDisplay)) fail('時刻表示はUTCまたはUTC・JSTを指定してください。');
    const normalized = {schemaVersion: 3, taskStates: {}, lastTask: value.lastTask || null, activeTask, timeDisplay};
    if (migrating) normalized.migrated = true;
    const entityResolver = (task, field) => {
      const resolve = logIdResolver(task.entityAliases && task.entityAliases.fields && task.entityAliases.fields[field]);
      return value => {
        const replacement = resolve(value);
        if (replacement !== value) normalized.migrated = true;
        return replacement;
      };
    };
    // v1 target maps also contain revoked answers (empty values), which must not
    // erase an exploratory host query. Only actual host renames apply there.
    const legacyHosts = task => legacyMigration ? Object.fromEntries(Object.entries(task.legacy && task.legacy.targets || {}).filter(([, replacement]) => typeof replacement === 'string' && replacement)) : {};
    const migrateQuery = (query, task) => {
      const result = replaceQueryAliases(query, logIdResolver(task.logAliases), task.entityAliases, legacyHosts(task));
      if (result !== query) normalized.migrated = true;
      return result;
    };
    const hosts = task => new Set([...(task.logs || []).map(log => log.host), ...(task.assets || []).map(asset => asset.host)].filter(Boolean));
    const normalizeDates = (range, label) => {
      if ((range.from && !Number.isFinite(dayStamp(range.from))) || (range.to && !Number.isFinite(dayStamp(range.to)))) fail(label + 'の日付は実在する日付をYYYY-MM-DDで指定してください。');
      if (range.from && range.to && range.from > range.to) fail(label + 'の開始日は終了日以前にしてください。');
    };
    const normalizeExtension = (input, task) => {
      if (input == null) return {};
      const rawAnswers = plain(input, '追加体験の回答');
      const keys = Object.keys(rawAnswers), questions = extensionQuestions(task) || [];
      if (keys.length > 100 || keys.some(key => !questions.some(question => question.id === key))) fail('追加体験にない質問が含まれています。');
      const answers = {};
      for (const key of keys) {
        const selected = rawAnswers[key];
        if (selected === '') continue;
        const question = questions.find(item => item.id === key);
        if (typeof selected !== 'string' || selected.length > 200 || !question.options.some(option => option.id === selected)) fail('追加体験の選択肢の形式または値が正しくありません。');
        answers[key] = selected;
      }
      return answers;
    };
    const normalizeDraft = (rawDraft, task, legacy) => {
      plain(rawDraft, '回答');
      const logs = new Map((task.logs || []).map(log => [log.id, log]));
      const resolveLogId = logIdResolver(task.logAliases);
      const choices = new Set((task.hypotheses || []).map(item => item.id));
      const findings = new Set((task.findings || []).map(item => item.id));
      const draft = {
        hypothesis: choice(rawDraft.hypothesis, choices, legacy.hypothesis, '仮説'),
        ownHypothesis: text(rawDraft.ownHypothesis, 4000, '自分の仮説'),
        reviewedHypothesis: text(rawDraft.reviewedHypothesis, 4000, '比較済みの仮説'),
        query: text(rawDraft.query, 2000, '提出する検索条件'),
        choice: choice(rawDraft.choice, new Set((task.choices || []).map(item => item.id)), null, '判断の選択'),
        alternative: choice(rawDraft.alternative, new Set((task.alternativeExplanations || []).map(item => item.id)), null, '良性の説明を検討した結果', true),
        selections: choicesList(rawDraft.selections, new Set((task.selectionOptions || []).map(item => item.id)), 100, null, '選択項目'),
        reflection: text(rawDraft.reflection, 4000, '自分の考察'),
        reviewedReflection: text(rawDraft.reviewedReflection, 4000, '比較済みの考察'),
        targets: choicesList(rawDraft.targets, hosts(task), 100, legacy.targets, '対象端末', entityResolver(task, 'host')),
        verdict: text(rawDraft.verdict, 50, '結論'),
        sources: choicesList(rawDraft.sources, new Set((task.sources || []).map(source => source.name)), 30, null, 'ログの種類'),
        from: text(rawDraft.from, 10, '開始日'), to: text(rawDraft.to, 10, '終了日'),
        finding: choice(rawDraft.finding, findings, legacy.finding, '残る確認事項'), evidence: [],
        summary: text(rawDraft.summary, 12000, '調査メモ'),
        limitations: text(rawDraft.limitations, 4000, '観測の限界'),
        nextAction: text(rawDraft.nextAction, 4000, '次の行動')
      };
      draft.query = migrateQuery(draft.query, task);
      if (task.rubric && task.rubric.alternative && rawDraft.alternative == null) normalized.migrated = true;
      // A snapshot acknowledges only the exact version the learner compared.
      if (draft.reviewedHypothesis !== draft.ownHypothesis) draft.reviewedHypothesis = '';
      if (draft.reviewedReflection !== draft.reflection) draft.reviewedReflection = '';
      if (draft.verdict && !VERDICTS.has(draft.verdict)) fail('課題にない結論が含まれています。');
      normalizeDates(draft, '調査期間');
      const evidence = rawDraft.evidence == null ? [] : rawDraft.evidence;
      if (!isArray(evidence) || evidence.length > 8) fail('証拠は8件以内にしてください。');
      const seen = new Set();
      evidence.forEach(item => {
        plain(item, '証拠');
        if (typeof item.id !== 'string' || item.id.length > 200 || !ROLES.has(item.role)) fail('証拠ID・役割・重複を確認してください。');
        const id = resolveLogId(item.id);
        if (seen.has(id)) fail('証拠ID・役割・重複を確認してください。');
        seen.add(id);
        if (!logs.has(id)) {
          if (legacyMigration) return;
          fail('この課題にない証拠IDが含まれています。');
        }
        if (id !== item.id) normalized.migrated = true;
        draft.evidence.push({id, role: item.role, note: text(item.note, 2000, '証拠メモ')});
      });
      return draft;
    };
    keys.forEach(id => {
      const task = taskMap.get(id), raw = plain(states[id], 'タスク ' + id);
      const draft = normalizeDraft(raw.draft, task, task.legacy || {});
      const exitTask = {...task, ...(task.exit || {}), logs: task.exit && task.exit.logs || task.logs || [], rubric: task.exit && task.exit.rubric || {}};
      const exitDraft = normalizeDraft(raw.exitDraft == null ? {} : raw.exitDraft, exitTask, {});
      const rawFilters = raw.filters == null ? {} : plain(raw.filters, '探索の検索条件');
      const defaultTimezone = periodTimezone(task);
      if (!TIMEZONES.has(defaultTimezone)) fail('教材の日付のタイムゾーンを確認できません。');
      const oldManualDates = rawFilters.timezone == null && Boolean(rawFilters.from || rawFilters.to);
      const filters = {
        query: text(rawFilters.query, 2000, '探索の検索条件'),
        source: choice(rawFilters.source, new Set((task.sources || []).map(source => source.name)), null, '探索のログ種類'),
        host: choice(rawFilters.host, hosts(task), legacyHosts(task), '探索の対象端末', false, entityResolver(task, 'host')),
        period: text(rawFilters.period == null ? 'current' : rawFilters.period, 20, '探索の期間'),
        from: text(rawFilters.from, 10, '探索の開始日'), to: text(rawFilters.to, 10, '探索の終了日'),
        timezone: rawFilters.timezone == null ? (oldManualDates ? 'UTC' : defaultTimezone) : rawFilters.timezone
      };
      if (!TIMEZONES.has(filters.timezone)) fail('探索の日付のタイムゾーンはUTCまたはAsia/Tokyoを指定してください。');
      if (rawFilters.timezone == null && defaultTimezone === 'Asia/Tokyo') normalized.migrated = true;
      filters.query = migrateQuery(filters.query, task);
      if (!['current', 'baseline', 'all'].includes(filters.period)) fail('探索の期間を確認してください。');
      normalizeDates(filters, '探索の期間');
      const operations = list(raw.operations, OPERATIONS, 4, '操作履歴');
      const tutorialActions = list(raw.tutorialActions, TUTORIAL_ACTIONS, TUTORIAL_ACTIONS.size, '操作体験の履歴');
      const hintLevel = raw.hintLevel == null ? 0 : raw.hintLevel;
      let guideStep = raw.guideStep == null ? 0 : raw.guideStep;
      if (!Number.isInteger(hintLevel) || hintLevel < 0 || hintLevel > 3) fail('ヒントの進捗を確認してください。');
      if (!Number.isInteger(guideStep) || guideStep < 0 || guideStep > 10000) fail('ガイドの進捗を確認してください。');
      if (migrating) guideStep = Math.min(guideStep, (task.guide || []).length);
      else if (guideStep > (task.guide || []).length) fail('ガイドの進捗を確認してください。');
      const completed = gradeTask(task, draft, operations).passed;
      const exitCompleted = Boolean(task.exit && completed && gradeExit(task, exitDraft).passed);
      const extensionAnswers = normalizeExtension(raw.extensionAnswers, task);
      const extensionCompleted = Boolean(completed && (!task.exit || exitCompleted) && gradeExtension(task, extensionAnswers).passed);
      normalized.taskStates[id] = {draft, operations, completed, hintLevel, guideStep, filters, exitDraft, exitCompleted, tutorialActions, extensionAnswers, extensionCompleted};
    });
    return normalized;
  }

  return Object.freeze({parseQuery, filterLogs, aggregateLogs, compareLogs, gradeQuery, checkOpenQuery, gradeTask, gradeExit, gradeExtension, validateProgress});
});
