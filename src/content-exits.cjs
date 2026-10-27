'use strict';

// 出口の採点は調査本体とは独立。元の課題のログや合格条件は変更しない。
const choice = (id, label) => ({id, label});
const heldout = (id, source, host, extra) => ({
  id, at:'2026-09-16T15:21:12Z', period:'current', source, host,
  user:'training-user', event:'独立検証用の合成イベント',
  detail:'dataset=independent-validation purpose=query-check',
  provenance:{kind:'synthetic',sensor:'validation-fixture',format:'normalized'},
  ...extra,
});

const exits = {
  p01: {
    title:'この事案の通信を再び探す条件にする', kind:'query',
    prompt:'調査で実行元まで対応した通信を候補として取り出す検索式を書きます。プロセス名と宛先の組み合わせを使い、端末名や証拠IDを固定しないでください。採点は前週・今回を含む全記録と、端末名を変えた独立標本に対して行います。この検索機能だけでは通信間隔の規則性を判定できないため、候補抽出後の確認を文章で残します。',
    modelReflection:'sync-agent.exe と sync-node.example の組み合わせで通信候補を抽出し、実行GUIDから起動元を確認する。その後、時系列で間隔と回数を確認し、業務変更やファイルの来歴を照合する。この条件は今回の特徴に依存するため、名称や宛先を変えた活動は見逃す。合成標本上の適合率は本番の誤検知率を表さない。',
    rubric:{
      query:{expected:['p01-e02','p01-e03','p01-e04','p01-e05','p01-e06'],filters:{period:'all'},validation:{
        logs:[
          heldout('check-p01-1','通信','REVIEW-WS-31',{process:'sync-agent.exe',destination:'sync-node.example',process_guid:'VALID-P1-31',bytes:1040}),
          heldout('check-p01-2','通信','REVIEW-WS-45',{process:'sync-agent.exe',destination:'sync-node.example',process_guid:'VALID-P1-45',bytes:1120,at:'2026-09-08T08:18:41Z',period:'baseline'}),
          heldout('check-p01-3','通信','REVIEW-WS-31',{process:'sync-agent.exe',destination:'company-sync.example',process_guid:'VALID-P1-32',bytes:1040}),
          heldout('check-p01-4','通信','REVIEW-WS-45',{process:'browser.exe',destination:'sync-node.example',process_guid:'VALID-P1-46',bytes:1120}),
          heldout('check-p01-5','端末','REVIEW-WS-45',{process:'sync-agent.exe',parent:'viewer.exe',process_guid:'VALID-P1-45'}),
        ],expected:['check-p01-1','check-p01-2'],
      }},reflection:true,
    },
    explanation:{summary:'今回の特徴に対応する通信の候補条件を保存し、間隔と実行元の確認を次の処理として明記します。',sampleQuery:'source:通信 process:sync-agent.exe destination:sync-node.example',reasoning:['今回の通信5件を抽出し、既知の更新や別プロセスによる通信を分けます。','前週・今回の固定データと独立標本で同じ条件を評価します。証拠IDや特定端末の列挙は別端末の検証標本を拾えません。','この検索式は通信間隔や複数イベントの因果関係を自動判定しません。候補の時系列、実行GUID、業務変更を別に確認します。'],next:'別期間の業務データで候補の件数と説明可能性を確認し、適用範囲・例外・見直し条件を決めます。'},
  },
  p02: {
    title:'移行作業の例外条件を記録する', kind:'baseline',
    prompt:'今回の正当な実行を次の比較に使う記録へ変えます。アカウント単位の恒久除外ではなく、MIG-214で確認した適用範囲と再確認の条件を残してください。',
    choices:[
      choice('service-account','svc-report の証明書認証を移行の通常値として扱い、端末と実行時間の差を月次で見直す。'),
      choice('bounded-run','REPORT-SRV-02 の承認枠・証明書・ジョブ・RUN-214を記録し、期間外や別方式の利用を再確認する。'),
      choice('server-window','REPORT-SRV-02 の02時台の処理を一つの基準にまとめ、実行IDは保存するが例外条件から外す。'),
    ],
    modelReflection:'MIG-214の2026-09-15 02:00〜03:00 UTC、REPORT-SRV-02、svc-report、CERT-REPORT-2、report-batch、テスト集計という条件を記録する。観測したRUN-214の実行内容・時刻と開始終了がその作業に対応する。移行期間後、対話型認証、別端末・証明書・ジョブの利用は再調査する。',
    rubric:{choice:'bounded-run',reflection:true},
    explanation:{summary:'正当と判断できた一回の作業条件を保存します。',reasoning:['MIG-214の条件とRUN-214の実行が一致したため、その実行を説明できます。','svc-reportの全認証や同じ端末の同時間帯に承認範囲を広げる根拠はありません。'],next:'移行終了時に例外を見直し、条件から外れた利用を別の候補として確認します。'},
  },
  p03: {
    title:'裏付けのない仮説を終了記録にする', kind:'record',
    prompt:'今回の探索を再利用できる終了記録にします。調べた条件、比較期間、母集団、確認できたこと、再開するきっかけを短くまとめてください。',
    choices:[
      choice('scoped-close','3台・両期間のプロセス記録では管理端末以外への広がりを確認できず、範囲と検索条件を残して終了する。'),
      choice('role-close','管理作業用という資産情報を根拠に今回のadminctl.exeを通常処理へ登録し、同名実行の確認を省略する。'),
      choice('open-without-trigger','一般端末に該当がない点を記録し、同じ3台へ同じ検索を日ごとに繰り返して結論を保留する。'),
    ],
    modelReflection:'仮説はadminctl.exeが一般端末へ広がったこと。IT-ADM-01、SALES-WS-01、DESIGN-WS-01について9月7〜9日と14〜16日の教材内プロセス記録を同条件で検索した。利用は管理端末に限られ仮説は裏付けられない。全操作の正当性は未判定。一般端末の実行や異なる親子関係など新しい根拠で再開する。',
    rubric:{choice:'scoped-close',reflection:true},
    explanation:{summary:'結果が否定的でも、範囲・検索条件・比較結果を残せば次回の判断に使えます。',reasoning:['収集範囲を確認したうえで、今回の仮説を裏付ける広がりがないと記録します。','管理端末であることは個別実行の正当性を証明しません。新しい根拠や範囲の変更を再開条件にします。'],next:'同じ検索の反復だけで埋めず、別の根拠がある仮説へ調査時間を配分します。'},
  },
  p04: {
    title:'繰り返し実行の確認を担当へ渡す', kind:'handoff',
    prompt:'担当者が追跡を始められる引継ぎにします。確認済みの登録・実行と、まだ確認していない登録元・ファイル来歴を分けてください。実環境での対処は担当権限と業務影響の確認を伴います。',
    selectionLabel:'引継ぎに含める事項',
    selectionOptions:[
      choice('registration','BACKUP-SRV-01のTASK-442登録、ログオン起動、実行先パスと根拠の記録'),
      choice('daily-task-only','同じバックアップ端末のDaily-バックアップを中心にまとめた運用報告'),
      choice('repeated-starts','9月15日と16日の起動を定義IDで対応させた時系列と既存運用との差'),
      choice('open-questions','登録元セッション・実行ファイル来歴・同じ定義の広がりの追加確認'),
      choice('intent-confirmed','operator-2の登録を意図的な侵害操作と確定した人物単位の結論'),
    ],
    modelReflection:'TASK-442はBACKUP-SRV-01にログオン起動として登録され、同じパスのuser-sync.exeが翌日を含め2回起動した。既存の日次バックアップとは定義と実行条件が異なる。登録・起動の根拠を保存し、登録元セッション、ファイル来歴、同じ条件の他端末を担当チームが確認する。操作の意図や取得元は未確定。',
    rubric:{selections:['registration','repeated-starts','open-questions'],reflection:true},
    explanation:{summary:'登録から反復起動までの確認結果と未確認事項を分けて引き継ぎます。',reasoning:['TASK-442と実行先パスは日をまたいだ2回の起動を対応付ける根拠です。','別定義の既存バックアップを一緒に扱うと範囲が曖昧になります。アカウント名だけで行為者の意図は判断できません。'],next:'証拠の保存後、対処権限と業務影響を確認できる担当者が封じ込め等の要否を判断します。'},
  },
  p05: {
    title:'承認済み送信の境界を残す', kind:'baseline',
    prompt:'ART-552の送信を説明した条件を、次回の比較用記録として保存します。送信量の増加を許可する条件と、引き続き調べる条件を分けてください。',
    choices:[
      choice('destination-rule','partner-drop.exampleとsvc-ledgerを通常条件にし、ファイルや時刻の違いは量が増えた場合に確認する。'),
      choice('size-rule','今回の50 MiBをこの宛先の基準値として採用し、同量以下の送信は次回の集計から除外する。'),
      choice('artifact-boundary','EX-315、EXPORT-52、ART-552、外部提供可の対象物・宛先・時刻を記録し、条件外の送信は確認する。'),
    ],
    modelReflection:'EX-315に一致するEXPORT-52/ART-552の送信として記録する。外部提供可のpublic-quarterly-aggregate.csv、MAN-552、svc-ledger、承認時間帯、partner-drop.example、52428800 bytesが作成・実行票・通信で対応する。同じ宛先でも別の対象物・期間・アカウントや説明できない増加は今回の例外に含めない。',
    rubric:{choice:'artifact-boundary',reflection:true},
    explanation:{summary:'送信量だけでなく、承認された対象物まで対応する条件を保存します。',reasoning:['今回の対象物と処理IDはEX-315の承認と転送実行に対応します。','宛先・アカウントの恒久除外やバイト数だけの基準では、別の対象物を見分けられません。'],next:'承認範囲が更新された際に記録を見直し、対象物の分類と処理IDを確認できる状態を維持します。'},
  },
  p06: {
    title:'実行元の観測不足を改善事項にする', kind:'visibility',
    prompt:'今回の空白を再検索だけで埋めず、欠落範囲・必要な項目・代替記録の確認先・将来の検証を残します。改善によって過去の記録が自動で戻ると扱わないでください。',
    selectionLabel:'改善事項に含める条件',
    selectionOptions:[
      choice('gap-window','FIN-WS-01の9月15日10:00〜12:00のプロセス停止と再送なしを記録する'),
      choice('recovery-link','12:05のブラウザーを10:32の通信へ仮対応させ、将来の再送で確かめる'),
      choice('alternative-records','端末側監査・アプリ記録・取得履歴の残存可否を担当へ確認する'),
      choice('process-correlation','将来はプロセスの実行IDと通信を対応できる収集経路・疎通を検証する'),
      choice('boundary-rename','境界flow_idをプロセスID欄へ転記し、境界ログだけで起動元を追えるようにする'),
    ],
    modelReflection:'対象はFIN-WS-01の9月15日10:32の外向き通信。10:00〜12:00のプロセス記録は停止して再送がなく、edge-flowに実行元はない。端末側監査やアプリ記録が残るか確認し、残らなければ過去の限界として記録する。将来は実行IDと通信の対応、収集停止の検知、復旧後の取り込みを試験する。',
    rubric:{selections:['gap-window','alternative-records','process-correlation'],reflection:true},
    explanation:{summary:'現在の判断限界と、これから改善する観測を分けて記録します。',reasoning:['flow_idは通信の識別子であり、実行GUIDの代わりにはなりません。','復旧後の別プロセスを過去の通信へ結び付ける根拠はありません。代替資料が残存するか確認し、将来の対応付けを検証します。'],next:'担当・必要項目・保持期間・確認試験を決め、欠落した過去の範囲は未解決のまま明示します。'},
  },
  f01: {
    title:'行動の組み合わせを検知候補にする', kind:'query',
    prompt:'文書アプリからスクリプトが起動する候補を取り出す検索式を書きます。プロセス名と親の組み合わせを使い、特定端末・証拠ID・実行GUIDを列挙しないでください。前週・今回の全記録と独立標本で評価します。通信先の照合は複数記録を必要とするため、抽出後の追加確認として文章に残します。',
    modelReflection:'docview.exeを親とするpowershell.exeの起動を候補にする。候補の実行GUIDで通信を照合し、時刻・宛先・文書やスクリプトの来歴を確認する。定例inventoryと承認された臨時帳票出力は親と作業条件が異なる。この条件だけでは通信の相関や侵害を確定せず、他の文書アプリや名称変更の見逃しもある。業務標本を増やして適用範囲を検討する。',
    rubric:{query:{expected:['f01-e04'],filters:{period:'all'},validation:{logs:[
      heldout('check-f01-1','端末','REVIEW-WS-61',{process:'powershell.exe',parent:'docview.exe',process_guid:'VALID-F1-61',parent_process_guid:'VALID-F1-60'}),
      heldout('check-f01-2','端末','REVIEW-WS-72',{process:'powershell.exe',parent:'docview.exe',process_guid:'VALID-F1-72',parent_process_guid:'VALID-F1-71',at:'2026-09-09T11:47:08Z',period:'baseline'}),
      heldout('check-f01-3','端末','REVIEW-WS-61',{process:'powershell.exe',parent:'inventory-agent.exe',process_guid:'VALID-F1-63'}),
      heldout('check-f01-4','端末','REVIEW-WS-72',{process:'powershell.exe',parent:'browser.exe',process_guid:'VALID-F1-74'}),
      heldout('check-f01-5','端末','REVIEW-WS-72',{process:'browser.exe',parent:'docview.exe',process_guid:'VALID-F1-75'}),
      heldout('check-f01-6','通信','REVIEW-WS-61',{process:'powershell.exe',destination:'cdn-session.example',process_guid:'VALID-F1-61'}),
    ],expected:['check-f01-1','check-f01-2']}},reflection:true},
    explanation:{summary:'親と子の組み合わせで候補を抽出し、通信との対応は次の確認に残します。',sampleQuery:'source:端末 parent:docview.exe process:powershell.exe',reasoning:['端末名や実行GUIDに依存しない条件で、別端末の独立標本も取り出せます。','同じpowershell.exeでもinventory-agent.exeの定例処理やexcel.exeの臨時帳票出力は別の候補として照合できます。','合成標本に対する一致率であり、実環境の誤検知率や見逃し率を示すものではありません。通信相関は別途必要です。'],next:'候補数・通常業務の別説明・収集項目を追加の業務標本で確認し、適用条件を見直します。'},
  },
  f02: {
    title:'主体を分けて終了条件を残す', kind:'record',
    prompt:'共有IPから同一主体と考えた仮説を、識別子に基づく終了記録へ修正します。共通IPの意味、主体の照合、対象期間と収集範囲、再開の条件を含めてください。',
    choices:[
      choice('proxy-exception','共通プロキシのIPを通常値として登録し、同じIPから来た認証の端末横断確認を省く。'),
      choice('identity-scope','端末ID・アカウント・セッションで3台を分け、今回の認証範囲では同一アカウントの移動を裏付けられないと残す。'),
      choice('timing-subject','連続する認証時刻を主な識別子にして主体候補を一つ残し、次の通信量集計まで結論を保留する。'),
    ],
    modelReflection:'192.0.2.80は共通プロキシの外向きIPである。WS-F2-01/02/03の認証と通信を端末ID・アカウント・セッションで照合すると別主体に分かれた。9月14〜16日の教材内認証では同一アカウントの移動は裏付けられない。別端末や認証を伴わない操作は範囲外。同一アカウントの複数端末利用や対応する遠隔操作など新しい根拠で再開する。',
    rubric:{choice:'identity-scope',reflection:true},
    explanation:{summary:'共有IPを除外リストにするのではなく、主体の識別方法を修正して探索を閉じます。',reasoning:['IPの共有と主体の同一性は異なります。端末ID・セッション・アカウントの組み合わせが必要です。','今回の認証範囲で裏付けがないことを記録し、時間の近さだけで主体をまとめません。'],next:'新しい仮説でも識別に使える項目と収集範囲を先に決めます。'},
  },
  f03: {
    title:'取得対象を確認する観測を設計する', kind:'visibility',
    prompt:'9月15日のSF3-91で何を取得したか確認するための追加調査と、将来に必要な観測を分けて残します。保存契約外だった元の監査を後から復元できるとは扱わないでください。',
    selectionLabel:'追加調査・可視性改善に含める事項',
    selectionOptions:[
      choice('size-classification','20 MiBという量を機密データの分類欄へ変換し、同じ量の応答を同じ対象物として追う'),
      choice('alternate-owner','サービス側の別監査、データ所有者の処理記録、資格情報の利用履歴の残存可否を確認する'),
      choice('retention-boundary','9月14〜15日の元のオブジェクト監査は保存契約外で復元不能と明記する'),
      choice('future-object','将来はオブジェクトID・分類・操作結果をセッションと対応させ、保持と取得を試験する'),
      choice('borrow-next-day','翌日の同量の定例処理のオブジェクト監査を、欠落したセッションの取得内容にも適用する'),
    ],
    modelReflection:'SF3-91の認証と応答は対応するが、対象オブジェクトと分類は不明。9月14〜15日の元監査は復元不能であり、別監査や所有者の処理記録が残るか確認する。将来はobject_id・分類・操作結果をsession/requestへ対応させ、必要期間の保持と取得を試験する。後日の別セッションや応答量から欠落した取得内容を補わない。',
    rubric:{selections:['alternate-owner','retention-boundary','future-object'],reflection:true},
    explanation:{summary:'過去の限界を維持したまま、代替資料と将来の可視性を別々に計画します。',reasoning:['応答バイト数から機密性や対象物は分かりません。翌日の別セッションにも読み替えられません。','将来の収集設定で過去の保存契約外の記録は復元できません。代替資料の有無と将来の保持試験をそれぞれ記録します。'],next:'データ所有者と収集担当の役割を分け、保存期間、対応する識別子、正常試験と欠落検知を確認します。'},
  },
};

const p04=exits.p04;
p04.prompt += ' 比較用の検索式も提出してください。目的は、登録当日の2026-09-15 UTCに観測したuser-sync.exeとverify.exeの「端末」起動記録を抽出することです。2種類の実行をORで並べ、after/beforeで同じUTC日へ絞る方法を使えます。翌日・他のプロセス・通信は今回の抽出に含めません。採点は返る記録集合で行い、同じ集合になる別の式も受け入れます。引継ぎ本文には、調査本体で確認した翌日の実行も含めます。';
p04.rubric.query={
  expected:['p04-e02','p04-r01'],filters:{period:'all'},
  validation:{logs:[
    heldout('check-p04-1','端末','REVIEW-SRV-31',{at:'2026-09-15T00:00:00Z',process:'user-sync.exe',parent:'taskeng.exe',process_guid:'CHECK-TASK-START-31'}),
    heldout('check-p04-2','端末','REVIEW-SRV-42',{at:'2026-09-15T23:59:59Z',process:'verify.exe',parent:'taskeng.exe',process_guid:'CHECK-TASK-START-42'}),
    heldout('check-p04-3','端末','REVIEW-SRV-31',{at:'2026-09-14T23:59:59Z',process:'user-sync.exe',parent:'taskeng.exe',process_guid:'CHECK-TASK-START-33'}),
    heldout('check-p04-4','端末','REVIEW-SRV-42',{at:'2026-09-16T00:00:00Z',process:'verify.exe',parent:'taskeng.exe',process_guid:'CHECK-TASK-START-44'}),
    heldout('check-p04-5','端末','REVIEW-SRV-42',{at:'2026-09-08T08:47:23Z',period:'baseline',process:'user-sync.exe',parent:'taskeng.exe',process_guid:'CHECK-TASK-START-45'}),
    heldout('check-p04-6','端末','REVIEW-SRV-31',{at:'2026-09-15T04:03:19Z',process:'job.exe',parent:'taskeng.exe',process_guid:'CHECK-TASK-START-36'}),
    heldout('check-p04-7','通信','REVIEW-SRV-31',{at:'2026-09-15T08:47:29Z',process:'user-sync.exe',destination:'user-sync.example',process_guid:'CHECK-TASK-START-31'}),
    heldout('check-p04-8','端末','REVIEW-SRV-31',{at:'2026-09-15T08:42:17Z',process:'taskconfig.exe',parent:'cmd.exe',process_guid:'CHECK-TASK-CONFIG-31'})
  ],expected:['check-p04-1','check-p04-2']}
};
p04.explanation.sampleQuery='source:端末 after:2026-09-15 before:2026-09-15 process:user-sync.exe OR source:端末 after:2026-09-15 before:2026-09-15 process:verify.exe';
p04.explanation.reasoning.push('比較用抽出では2種類のプロセスをORで含め、各枝にsourceとUTC日付条件を指定する。after/beforeはその日を含むので、独立標本の00:00:00と23:59:59も対象になる。翌日の再起動は本体の引継ぎ根拠だが、登録当日という抽出目的には含めない。');
p04.modelReflection += ' 比較用抽出は9月15日UTCのuser-sync.exeとverify.exeの端末起動に限定する。検索式の各OR枝にsourceと日付を置き、翌日の実行は引継ぎ本文の別の根拠として扱う。';
for(const exit of Object.values(exits))exit.prompt += ' この成果物の本文・検索日付・資料の時刻はUTCを基準にします。';
module.exports=exits;
