# 変更履歴 / Changelog

## v0.8.2 — 2026-10-28

- 起動前の静的な概要・所要時間、JavaScript無効時の案内とオフラインHTMLへのリンク、OGPを追加。
- 自由記述の模範例に、代替説明や観測の限界を振り返る任意チェックリストを追加。チェック状態は保存・採点せず、既存の自己比較と進捗を維持。
- SPL・KQL・Sigmaの対応例と、ATT&CK・PEAK・TaHiTIへの橋渡しを日英で追加。
- Chromiumで生成HTMLの初期表示、日英表示、狭い画面、キーボード操作、JavaScript無効時の案内を確かめるスモークテストを追加。
- READMEに全章の主題・課題ID一覧を追加し、英語の表現と句読法、版情報、変更履歴、PR受付方針を整理。生成HTMLとJavaScriptソースの言語統計上の区別を明示。

- Adds a static course overview, study times, no-JavaScript guidance, an offline HTML link, and Open Graph metadata.
- Adds optional self-review checklists beside free-text examples. Checklist selections are not saved or graded; existing review confirmation and progress remain compatible.
- Adds bilingual SPL, KQL, and Sigma examples and connections to ATT&CK, PEAK, and TaHiTI.
- Adds Chromium smoke tests for generated HTML: startup, Japanese and English, a narrow viewport, keyboard interaction, and no-JavaScript guidance.
- Adds chapter and lesson-ID tables, polishes English wording and punctuation, aligns version information, and clarifies release history and contribution practices. Distinguishes generated HTML from JavaScript source in language statistics.

## v0.8.1 — 2026-10-28

- 初回表示をブラウザの最優先言語から選択。日本語は日本語、それ以外はEnglishで表示し、Languageメニューで保存した選択を優先します。
- Opens in Japanese when it is the browser's preferred language, and in English otherwise. A saved choice from the Language menu takes precedence.

## v0.8.0 — 2026-10-28

- A03・F01・F03に各2問、計6問の任意小体験を追加。イベント時刻と取込時刻、同一実行の集約と重複再送、ログ改善後の確認を扱う。
- 小体験の回答・完了を本編と成果物から分離し、旧進捗の有効な完了を維持。
- C03で同一ハッシュの保管痕跡と実行・後続活動の違いを明確化。
- I06・P03・P04・C01・F01・C05・G02に、未採点の折りたたみ「実務では」を追加。

- Adds two optional follow-up questions each to A03, F01, and F03: event versus ingestion time, execution grouping and duplicate delivery, and checks after logging improvements.
- Saves optional answers and completion separately from investigations and deliverables, preserving valid completion from older progress.
- Clarifies the distinction between stored objects with a matching hash and execution or subsequent activity in C03.
- Adds ungraded, collapsible “In practice” notes to I06, P03, P04, C01, F01, C05, and G02.

## v0.7.0 — 2026-10-28

- A01に資産台帳・収集資料から調査へ進む任意案内とUTC/JSTの営業日確認を追加。既存のログとチェックリストを維持。
- G02の後に任意卒業演習X01を追加。本編38問とは別枠で、証拠の構成・検索の再現・自己比較を確認。
- 既存の学習順・進捗形式・日英表示を維持し、画面上部にpackage.jsonの版を表示。

- Added optional A01 inventory and collection-filter entry guidance with a UTC/JST business-date check, preserving the original corpus and checklist.
- Added one optional independent capstone X01 after G02, separate from 38 main lessons, using structural evidence checks, reproducible queries, and self-review.
- Kept existing route, progress schemas, and bilingual operation; displayed the package version in the top header.

## v0.6.0 — 2026-10-27

本体v0.6を基にした、GitHubでの初回公開版です。

- 操作チュートリアル1問、本編38問、調査後の成果物9ステップを収録。
- 第2部の共通ログと別評価ログをJSTの営業日に整合。調査期間と固定評価範囲に時間帯を明示し、日付欄ではJST／UTCを選択可能。
- `sensor:` 検索、センサーによる追跡・集計・比較、CSVのsensor列に対応。
- 旧進捗の手動日付はUTCの意味を維持。証拠とメモを保持して現在の基準で再確認し、検索式や自由記述内の時刻は自動変換しない。
- 日本語・EnglishのLanguageメニュー、教材・ヒント・解説・画面表示の英語訳を追加。ログ原文・採点条件・進捗は共通。
- 日英README、操作ガイド、学習マップ、開発・公開手順を追加。
- キャラクター・横長イラストはREADMEに掲載。学習用HTMLへは組み込まない。
- GitHub Pagesとオフライン用HTMLを同じビルドから生成。

This is the first GitHub release, based on application v0.6.

- Includes one interface tutorial, 38 main lessons, and nine follow-up deliverable steps.
- Aligns shared and separate evaluation logs with JST business days. Investigation and assessment scopes show their time zone, with JST/UTC selection for date fields.
- Adds `sensor:` queries, sensor pivots, aggregation, comparison, and a CSV sensor column.
- Preserves the UTC meaning of manual dates from older progress. Evidence and notes are retained and reassessed; times within saved queries and free text are not converted automatically.
- Adds a Japanese/English Language menu and English lessons, hints, explanations, and interface text. Raw logs, grading criteria, and progress remain shared.
- Adds bilingual READMEs, user and curriculum guides, and development and publishing instructions.
- Places the character and illustrations in the README only.
- Builds GitHub Pages and offline HTML from the same source.
