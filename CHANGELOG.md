# 変更履歴 / Changelog

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
