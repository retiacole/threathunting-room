# ThreatHunting-room v0.6 data contract

## Distribution and catalog

One offline HTML; no runtime network, external libraries or web server. `catalog.cjs` exports hydrated `{tasks,environments}`.

- Tutorial: id tutorial, part 0, chapter T, separate from progress totals.
- Part 1: i01..i06 (I), p01..p06 (P), f01..f03 (F), preserving 15 investigations.
- Part 2: A4, B3, C5, D3, E3, L3, G2 = 23 tasks.
- Nine exits attach to existing practice/field tasks, not separate tasks.

The canonical environment contains 20 assets and the union of environment/operations logs. Asset `id` is the inventory-record ID; `device_id` is the telemetry identifier. Shared task definitions use `{part:2,chapter,environment,logIds}`. Hydration resolves logs and assets; targets include unobserved inventory hosts. Each snapshot is independent of completion order. The UI explains why counts differ across tasks. Duplicate IDs or missing references fail loading. Build embeds `{version:6,tasks,environments}`, serializing shared logs/assets once.

Published record IDs use deterministic rec-SHA256-prefix values. public-data.cjs rewrites log IDs and references together; task.logAliases maps authoring IDs for old progress import. Complete free-text query terms can migrate, but field values, prefixes and learner prose are not rewritten. The runtime grades the public IDs.

Part 1 also publishes neutral entity values for scenario-bearing hosts/domains and correlation identifiers. task.entityAliases has fields and text mappings; migration applies legacy v1 choices/targets first, then entity aliases to structured targets/filters/query terms. Exact whole identifier terms may migrate; learner prose remains unchanged. rec IDs remain stable from v0.4. Migration dictionaries remain in the offline HTML deliberately; answer secrecy against source inspection is not a goal.

## Content

Tasks retain id, level, title, subtitle, minutes, focus, brief, context, periods, hypotheses, sources, guide, hints, findings, rubric and explanation. Optional origin records the question's starting point. Optional initialFilters controls the first exploratory view. guideMode checklist removes sequential guidance.

Periods are baseline/current with from/to inclusive dates and optional timezone ('UTC' by default, 'Asia/Tokyo' for Aonagi). Aonagi's local business dates 2026-09-14..16 correspond to [2026-09-13T15:00:00Z, 2026-09-16T15:00:00Z). Logs have id, at, period, source, host, user, event, detail; optional sensor/destination/process/parent/bytes, session/pid/process_guid/parent_process_guid/request_id/device_id/hash, and synthetic native raw. Populate identifiers only where collected. Linux auth-only records do not receive invented GUIDs. At the catalog boundary, timezone-data.cjs shifts Aonagi authoring timestamps once by −9 hours, including raw timestamps and collection/approval windows. Part 1 and tutorial records are not shifted. Record IDs stay stable.

Native event detail uses key=value. Collection materials explain visibility; business records state permitted work. Avoid answer-bearing interpretations in telemetry. Exact schedules are allowed; other recurring events should include plausible variation. Events are synthetic excerpts, not exhaustive telemetry.

## Rubrics

Every applicable criterion is required. Omitted criteria are not graded.

```js
{
  hypotheses:['choice-id'],
  targets:['HOST-01'], // exact unordered set
  verdict:'supported'|'benign'|'insufficient'|'unsubstantiated',
  sources:['通信','端末'], // exact required set, extras fail
  scope:true, // answer dates equal current period
  finding:'choice-id',
  alternative:'choice-id', // explicit evaluation of a benign explanation
  evidenceGroups:[{label,anyOf:['log-id'],role:'support'|'counter'|'context'|'gap'}],
  evidenceExtras:[{id,roles:[],reason}],
  operations:['search','aggregate','compare','pivot'],
  query:{expected:['log-id'],filters:{period:'all'},validation:{logs:[],expected:[],filters:{}}},
  choice:'choice-id', selections:['option-id'],
  selfReview:true, reflection:true
}
```

Evidence groups require a member with the correct role. Precision rejects selected ID/role pairs outside required groups and explicit extras. Notes cannot override this. Counter denotes a real alternative explanation; context/gap must not be relabelled counter to satisfy a quota. Balance verdicts among tasks actually grading a verdict.

The six supported conclusions require actual benign comparison events and business conditions as context, plus an alternativeExplanations choice describing why those conditions do not explain the investigated activity. Missing/wrong alternative judgments fail independently of the evidence groups. This is structured grading, not semantic grading of learner prose.

Query exercises require nonempty expected sets. Grade result sets, never expression text. Fixed dataset/filter scope is independent of exploration. Detection exits use separate validation records to reject host/record-ID overfitting. Metrics describe the supplied samples only.

Validation negatives must be excluded by the stated task, not arbitrary mutations. C exercises inherit the same fixed date/filter scope for main and validation sets. C05 includes both TLS and non-TLS boundary flows; C04 explicitly targets authentication and /download responses. p04's exit requests a narrower UTC date within its fixed corpus; its examples demonstrate dates in both OR branches. The UI shows both grading scopes.

Optional choices/selectionOptions are arrays of {id,label}, with choiceLabel/selectionLabel. hypothesisPrompt/modelHypothesis and reflectionPrompt/modelReflection enable prose exercises. selfReview requires nonempty ownHypothesis equal to reviewedHypothesis; reflection similarly requires reflection equal to reviewedReflection. Snapshots reflect explicit confirmation, not semantic correctness. Opening a comparison alone does not confirm it; edits invalidate confirmation.

An exit contains title, kind, prompt, choices/selectionOptions, modelReflection, rubric, explanation, and optionally logs. gradeExit uses exit logs if supplied, otherwise investigation logs. Controller/validation gate exit completion on investigation completion. Adding an exit does not erase investigation completion.

## Pure engine API

CommonJS exports and browser THEngine:

- parseQuery(query) → {terms,groups,errors}. Groups are AND branches combined by uppercase unquoted OR. No parentheses/eval. Unknown fields or malformed dates fail closed.
- filterLogs(logs,filters) → rows. Filters: query/source/host/period/from/to/timezone. Global filters apply to every OR branch. The date controls use the selected timezone; query after/before always include the specified UTC day. session/pid/GUID/request_id/device_id/hash/sensor use case-insensitive equality; ordinary fields use substrings. sensor also supports grouping, comparison, pivots and CSV export.
- aggregateLogs(logs,field,{sort:'count-desc'|'count-asc'}) → {key,count,hosts,bytes,values?}[].
- compareLogs(logs,field,source) → {key,baseline,current,delta,ratio,values?}[]; no baseline means null ratio.
- Both grouping functions support parent_process as a pair with values:{parent,process}. Display keys are not identity; pivots use two terms.
- gradeQuery(logs,query,spec) → {passed,errors,matched,missing,unexpected,precision,recall,validation?}.
- gradeTask(task,draft,operations) and gradeExit(task,exitDraft) → {passed,earned,total,criteria,query?}.
- validateProgress(value,tasks) → normalized safe v3 state, or throws for invalid containers/oversized input.

## Progress

```js
{
  schemaVersion:3,
  taskStates:{
    'task-id':{
      draft:{
        hypothesis:'',ownHypothesis:'',reviewedHypothesis:'',
        query:'',choice:'',alternative:'',selections:[],reflection:'',reviewedReflection:'',
        targets:[],verdict:'',sources:[],from:'',to:'',finding:'',
        evidence:[{id,role,note}],summary:'',limitations:'',nextAction:''
      },
      operations:[],completed:false,hintLevel:0,guideStep:0,
      filters:{query:'',source:'',host:'',period:'current',from:'',to:'',timezone:'UTC'},
      exitDraft:{/* same draft shape */},exitCompleted:false,
      tutorialActions:[]
    }
  },
  lastTask:null, // last normal task; tutorial must not overwrite it
  activeTask:null, // includes the tutorial
  timeDisplay:'utc' // 'utc' | 'utc-jst'; presentation only
}
```

Bound input to 4 MB, evidence to eight rows, query to 2000 characters, hypothesis/reflection/limitations/nextAction to 4000, summary to 12000. Normalize unknown choices/targets/IDs safely. Escape displayed text and protect spreadsheet formulas in CSV.

Accept v1/v2/v3. Apply legacy hypothesis/finding/target mappings only to v1; empty mappings clear changed meanings. Recompute completion from current rubrics. Invalid syntax remains an editable incomplete draft. Preserve unrelated tasks and notes. Retain localStorage key threat-hunting-room.progress.v1, writing v3. Import must not overwrite incoming filters with stale screen filters.

## Tutorial and exports

Fresh launch without normal progress or an explicit route begins the ten-step tutorial. Actual search/detail/evidence/role/answer actions gate progression in UI and controller; arbitrary jumps are disallowed. Completion requires passed grading, an explicit graded action, viewing the solution after grading, and the final guide step. Edits invalidate the grade/solution actions and return completed guidance to the grading step. Restart affects only tutorial state. Narrow screens retain the sticky coach. Timelines paginate 50 records without changing search scope.

reports.js exports seven sections: hypothesis, origin, logs, query, results, limits, next action. The first-hunt plan uses saved A/B/C/G answers and D/E/L notes. Incomplete work is labelled, prose is not presented as automatically validated, and scopes do not imply observation through uncollected intervals.

JST display adds nine hours with date rollover to event cards, timelines, details and validation rows. Period windows show the equivalent UTC interval for Aonagi's JST business dates, with an exclusive upper endpoint. UTC periods optionally show the equivalent JST interval. Raw timestamps, stored at values, query date predicates and CSV remain UTC; report periods and grading scopes explicitly carry UTC/JST. The display preference persists in progress JSON and never changes filter semantics or invalidates an answer. Old Part 2 manual date filters without timezone retain UTC semantics; date-free old filters adopt the task default. Query text and learner prose are not silently converted. Import recalculates completion against the revised dataset; migration dictionaries remain available.

## Verification boundary

Engine/content tests and controller-handler tests cover 38 investigations, nine exits, alternative queries, held-out fixtures, migration, regrading, tutorial gating/resumption/isolation, exports and runtime hydration. Build tests require one self-contained HTML. Controller/view tests use Node VM and a minimal DOM; they do not validate real-browser layout, keyboard focus or native download behavior. Automated tests/builds do not start a web server. A user-authorized loopback server may be used temporarily for manual browser verification and must be stopped afterward.
