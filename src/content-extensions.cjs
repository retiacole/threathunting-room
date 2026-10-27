'use strict';

// These tables are independent mini-examples. They never enter task.logs,
// the shared environment, evidence groups or query-evaluation datasets.
const translations = {};
const tr = (ja, en) => (translations[ja] = en, ja);
const option = (id, ja, en) => ({ id, label: tr(ja, en) });

const extensions = {
  a03: {
    title: tr('起きた時刻と届いた時刻を分ける', 'Separate event time from ingestion time'),
    intro: tr('これはLAB-LT-09の別例です。本編の復元不能な欠測とは関係ありません。この例では端末時計と収集先時計は同期済みで、すべてUTCです。発生時刻は端末で起きた時刻、取込時刻は収集先で検索可能になった時刻を表します。起動の1行だけ転送が遅れました。', 'This is a separate example for LAB-LT-09, unrelated to the unrecoverable gap in the main task. The endpoint and collector clocks are synchronized, and every timestamp is UTC. Event time is when the event occurred on the endpoint; ingestion time is when the collector made it searchable. Delivery of only the process-start row was delayed.'),
    minutes: tr('4〜5分', '4–5 minutes'),
    table: {
      caption: tr('独立した転送遅延の例 — 発生・取込ともUTC', 'Independent delivery-delay example — event and ingestion timestamps are both UTC'),
      columns: [
        { key: 'eventId', label: tr('イベントID', 'Event ID') },
        { key: 'host', label: tr('端末', 'Host') },
        { key: 'event', label: tr('出来事', 'Event') },
        { key: 'eventAt', label: tr('発生時刻（UTC）', 'Event time (UTC)') },
        { key: 'ingestedAt', label: tr('取込時刻（UTC）', 'Ingestion time (UTC)') }
      ],
      rows: [
        { eventId: 'DELAY-01', host: 'LAB-LT-09', event: 'process_start', eventAt: '2026-10-01T09:02:00Z', ingestedAt: '2026-10-01T09:07:00Z' },
        { eventId: 'DELAY-02', host: 'LAB-LT-09', event: 'network_connection', eventAt: '2026-10-01T09:03:00Z', ingestedAt: '2026-10-01T09:03:10Z' },
        { eventId: 'DELAY-03', host: 'LAB-LT-09', event: 'process_exit', eventAt: '2026-10-01T09:04:00Z', ingestedAt: '2026-10-01T09:04:10Z' }
      ]
    },
    questions: [
      {
        id: 'eventorder',
        prompt: tr('端末で起きた順序として、この表から確かめられるものはどれですか。', 'Which order of events on the endpoint does this table support?'),
        options: [
          option('arrivalorder', '通信 → 終了 → 起動。取込順を端末での発生順として使う。', 'Connection → exit → start. Use ingestion order as the order of events on the endpoint.'),
          option('eventorder', '起動 → 通信 → 終了。発生時刻で並べ、取込の遅れを別に記録する。', 'Start → connection → exit. Order by event time and document the ingestion delay separately.'),
          option('simultaneous', '3行は同じ端末なので、同時に起きた出来事としてまとめる。', 'Treat all three rows as simultaneous because they are from the same endpoint.')
        ],
        answer: 'eventorder',
        explanation: tr('発生時刻は09:02、09:03、09:04の順です。09:07に取り込まれた起動行を最後の出来事にしてはいけません。発生順だけで、別の記録との因果関係まで証明できるわけではありません。', 'The event timestamps are 09:02, 09:03 and 09:04. The start row ingested at 09:07 is not the last event. Event order alone does not prove a causal relationship with other records.')
      },
      {
        id: 'knownat',
        prompt: tr('09:05 UTCに収集先だけを検索した時点で、起動行が見つからなかった場合の扱いはどれですか。', 'At 09:05 UTC, a search of only the collector does not find the start row. How should that result be treated?'),
        options: [
          option('notstarted', '起動行が0件なので、端末で起動がなかったと確定する。', 'Conclude that no process started on the endpoint because the search returned no start rows.'),
          option('knownlater', '09:07に届く行を、09:05にも検索できた根拠として報告する。', 'Report the row that arrives at 09:07 as evidence already searchable at 09:05.'),
          option('checkdelivery', 'その時点では起動行が未着と扱い、到着状況を確認する。後着したら当時の記録と区別して判断を更新する。', 'Treat the start row as not yet received at that point and check delivery status. When it arrives, update the assessment while distinguishing it from what was known earlier.')
        ],
        answer: 'checkdelivery',
        explanation: tr('09:05までに検索できるのは通信と終了の2行です。起動行の取込は09:07です。この遅延例では後着しますが、本編A03の失われた記録が同じように届くという意味ではありません。', 'Only the connection and exit rows are searchable by 09:05. The start row is ingested at 09:07. This delivery-delay example eventually receives the row; it does not mean the lost records in main task A03 will arrive in the same way.')
      }
    ],
    takeaway: tr('起きた順序は発生時刻、当時知り得た範囲は取込時刻で確かめます。遅延到着と復元不能な欠測を分けて記録します。', 'Use event time to establish event order and ingestion time to establish what was knowable then. Document delayed delivery separately from an unrecoverable collection gap.')
  },
  f01: {
    title: tr('同じ実行の記録を一つの候補にまとめる', 'Group records from the same execution into one candidate'),
    intro: tr('本編とは別の5行です。この小体験では、同じ端末と同じ実行IDの組を1候補として整理します。実行IDはこの表の端末内で重複しません。event_idが同じで発生時刻・内容も一致する再送行は、同じ元イベントの重複配送です。候補にまとめても、開始と通信の根拠は残してください。', 'These five rows are separate from the main task. In this mini-exercise, one host and execution-ID pair forms one candidate. Execution IDs are not reused on this endpoint within the table. A replay with the same event_id, event time and content is duplicate delivery of the original event. Retain both start and connection evidence when grouping a candidate.'),
    minutes: tr('3〜5分', '3–5 minutes'),
    table: {
      caption: tr('同じ端末の実行A・Bと、通信行の再送 — 時刻はすべてUTC', 'Executions A and B on one endpoint, with a replayed connection row — all times are UTC'),
      columns: [
        { key: 'eventId', label: 'event_id' },
        { key: 'host', label: tr('端末', 'Host') },
        { key: 'executionId', label: tr('実行ID', 'Execution ID') },
        { key: 'event', label: tr('出来事', 'Event') },
        { key: 'eventAt', label: tr('発生時刻（UTC）', 'Event time (UTC)') },
        { key: 'ingestedAt', label: tr('取込時刻（UTC）', 'Ingestion time (UTC)') },
        { key: 'detail', label: tr('内容', 'Content') }
      ],
      rows: [
        { eventId: 'GROUP-01', host: 'LAB-WS-21', executionId: 'RUN-A17', event: 'process_start', eventAt: '2026-10-02T09:10:00Z', ingestedAt: '2026-10-02T09:10:01Z', detail: 'parent=docview.exe process=script-runner.exe' },
        { eventId: 'GROUP-02', host: 'LAB-WS-21', executionId: 'RUN-A17', event: 'network_connection', eventAt: '2026-10-02T09:10:05Z', ingestedAt: '2026-10-02T09:10:06Z', detail: 'destination=review-gateway.example result=allowed' },
        { eventId: 'GROUP-02', host: 'LAB-WS-21', executionId: 'RUN-A17', event: 'network_connection', eventAt: '2026-10-02T09:10:05Z', ingestedAt: '2026-10-02T09:10:30Z', detail: 'destination=review-gateway.example result=allowed' },
        { eventId: 'GROUP-03', host: 'LAB-WS-21', executionId: 'RUN-B28', event: 'process_start', eventAt: '2026-10-02T09:12:00Z', ingestedAt: '2026-10-02T09:12:01Z', detail: 'parent=docview.exe process=script-runner.exe' },
        { eventId: 'GROUP-04', host: 'LAB-WS-21', executionId: 'RUN-B28', event: 'network_connection', eventAt: '2026-10-02T09:12:05Z', ingestedAt: '2026-10-02T09:12:06Z', detail: 'destination=review-gateway.example result=allowed' }
      ]
    },
    questions: [
      {
        id: 'candidates',
        prompt: tr('この教材条件で候補をまとめると、いくつになりますか。', 'How many candidates result from the grouping rule for this exercise?'),
        options: [
          option('one', '1候補。同じ端末・同じ実行ファイル名なので、AとBも一つにする。', 'One candidate. Merge A and B because the host and executable name are the same.'),
          option('five', '5候補。取り込まれた行ごとに別の実行があったと数える。', 'Five candidates. Count every ingested row as a separate execution.'),
          option('two', '2候補。LAB-WS-21 / RUN-A17とLAB-WS-21 / RUN-B28を分ける。', 'Two candidates. Keep LAB-WS-21 / RUN-A17 separate from LAB-WS-21 / RUN-B28.')
        ],
        answer: 'two',
        explanation: tr('Aは開始・通信・通信の再送で3行、Bは開始・通信で2行あります。候補は端末と実行IDの組で2つです。同じ実行ファイル名や宛先でも、別の実行IDを消してはいけません。', 'A has three delivered rows: start, connection and a replay of that connection. B has two: start and connection. The host/execution-ID pairs give two candidates. The same executable name or destination does not justify dropping a different execution ID.')
      },
      {
        id: 'retainproof',
        prompt: tr('重複を整理した候補一覧と、その根拠の残し方として適切なのはどれですか。', 'Which candidate list and evidence record correctly handles the duplicate?'),
        options: [
          option('keepevents', 'AはGROUP-01とGROUP-02、BはGROUP-03とGROUP-04を根拠にし、GROUP-02の再送を注記する。', 'Use GROUP-01 and GROUP-02 as evidence for A, and GROUP-03 and GROUP-04 for B. Note the replay of GROUP-02.'),
          option('latestonly', '最後に取り込まれたBだけを残し、Aは同じ端末の古い重複として消す。', 'Keep only the latest execution B and discard A as an older duplicate on the same host.'),
          option('countreplay', 'GROUP-02が2回来たことを2回の通信成立とし、Aの通信回数を増やす。', 'Treat the two deliveries of GROUP-02 as two successful connections and increase A’s connection count.')
        ],
        answer: 'keepevents',
        explanation: tr('5配送行に含まれる元イベントは4件です。重複配送を区別することと、別の実行や開始・通信の異なる根拠を捨てることは違います。この2候補の整理だけで悪性や通信目的は確定しません。', 'The five delivered rows contain four original events. Distinguishing duplicate delivery does not mean discarding another execution or its distinct start and connection evidence. Grouping these two candidates does not establish maliciousness or communication purpose.')
      }
    ],
    takeaway: tr('行数・元イベント数・実行候補数を区別します。この例は5配送行、4イベント、2候補です。まとめた後も各候補を元の根拠へ戻せるようにします。', 'Distinguish delivered rows, original events and execution candidates: five rows, four events and two candidates here. Keep each candidate traceable to its original evidence.')
  },
  f03: {
    title: tr('改善した観測を別日のテストで確かめる', 'Test improved visibility with a separate later session'),
    intro: tr('本編の9月15日に保存されなかったオブジェクト監査は、未解決のままです。以下は改善を試す9月17日の別セッションで、すべてUTCの独立したテスト記録です。object_id・classification・操作結果をrequest_idとsessionへ対応させて取得しました。この小体験で保持期間全体や本番の全経路を検証したことにはなりません。', 'The object audit missing from September 15 in the main task remains unresolved. Below are independent test records from a different session on September 17, all in UTC. The improved collection links object_id, classification and operation result to request_id and session. This mini-exercise does not validate the full retention period or every production collection path.'),
    minutes: tr('3〜5分', '3–5 minutes'),
    table: {
      caption: tr('改善後のオブジェクト監査 — 9月17日の別セッション・UTC', 'Object audit after the improvement — a different session on September 17, UTC'),
      columns: [
        { key: 'eventAt', label: tr('発生時刻（UTC）', 'Event time (UTC)') },
        { key: 'session', label: 'session' },
        { key: 'requestId', label: 'request_id' },
        { key: 'objectId', label: 'object_id' },
        { key: 'classification', label: 'classification' },
        { key: 'operation', label: 'operation' },
        { key: 'result', label: 'result' }
      ],
      rows: [
        { eventAt: '2026-09-17T06:10:04Z', session: 'TEST-SESSION-917', requestId: 'TEST-REQUEST-01', objectId: 'PUBLIC-AGGREGATE-09', classification: 'public', operation: 'read', result: 'success' },
        { eventAt: '2026-09-17T06:10:12Z', session: 'TEST-SESSION-917', requestId: 'TEST-REQUEST-02', objectId: 'DESIGN-DRAFT-09', classification: 'confidential', operation: 'read', result: 'denied' }
      ]
    },
    questions: [
      {
        id: 'newvisibility',
        prompt: tr('改善後のこのテストで直接確認できたことはどれですか。', 'What does this test directly establish about visibility after the improvement?'),
        options: [
          option('allread', '同じセッションに2つのobject_idがあるので、両方の読取が成功した。', 'Both reads succeeded because two object_id values appear under the same session.'),
          option('linkedresults', '公開対象の読取成功と機密対象の読取拒否を、対象物・分類・要求ID・セッションと対応させられた。', 'The successful read of a public object and the denied read of a confidential object can each be linked to the object, classification, request ID and session.'),
          option('allcovered', 'この2行があるので、すべての期間・経路のオブジェクト監査を完全に収集できている。', 'These two rows prove complete object-audit coverage for every period and collection path.')
        ],
        answer: 'linkedresults',
        explanation: tr('TEST-REQUEST-01はpublicのread成功、TEST-REQUEST-02はconfidentialのread拒否です。対象物が記録されたことと、読取が成功したことを分けます。確かめたのは、この別日のテストで必要項目を対応付けられることです。', 'TEST-REQUEST-01 is a successful read classified public; TEST-REQUEST-02 is a denied read classified confidential. An object being logged does not mean its read succeeded. This test establishes that the required fields can be correlated in this later test session.')
      },
      {
        id: 'pastlimit',
        prompt: tr('この改善後の結果を、本編の9月15日の未解決事項へどう反映しますか。', 'How should these post-improvement results affect the unresolved September 15 questions in the main task?'),
        options: [
          option('backfillpublic', '9月17日の成功がpublicなので、9月15日も公開対象だけの取得だったと補う。', 'Because the September 17 success was public, fill the September 15 gap as retrieval of public objects only.'),
          option('retrorestore', '収集設定を改善したので、保存されなかった9月15日の元監査も復元済みとする。', 'Treat the unretained September 15 audit as restored because collection settings were improved.'),
          option('keeplimit', '9月17日のテスト結果として記録する。9月15日の対象物・分類は未確認のまま、別監査や所有者記録の残存可否を調べる。', 'Record these as September 17 test results. Keep the September 15 objects and classifications unresolved and investigate whether alternative audits or data-owner records remain.')
        ],
        answer: 'keeplimit',
        explanation: tr('別日・別セッションの正常試験は、過去の取得物の証拠にはなりません。将来の可視性が改善したことと、失われた過去の記録を回復したことを別々に報告します。', 'A test on another date and session is not evidence of what was retrieved earlier. Report improved future visibility separately from recovery of historical records that were lost.')
      }
    ],
    takeaway: tr('改善の完了は必要項目を使った試験で確かめます。将来の観測が良くなっても、過去の空白を別日の記録で埋めません。', 'Verify an improvement through a test using the required fields. Better future visibility does not fill a historical gap with records from another day.')
  }
};

const retainedObjects = tr('一致した行が示すのは保持された標本の痕跡まで。今回の範囲では実行や、その後の一連の活動を裏付けるものではない。', 'The matching rows establish only traces of retained samples. Within this scope, they do not substantiate execution or the subsequent sequence of activity.');

function applyExtensions(tasks) {
  return tasks.map(task => {
    if (task.id === 'c03') return { ...task, findings: task.findings.map(finding => finding.id === 'retained-objects' ? { ...finding, label: retainedObjects } : finding) };
    if (Object.hasOwn(extensions, task.id)) return { ...task, extension: JSON.parse(JSON.stringify(extensions[task.id])) };
    return task;
  });
}

module.exports = { applyExtensions, translations };
