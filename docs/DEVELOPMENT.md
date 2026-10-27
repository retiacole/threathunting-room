# 開発ガイド / Development

[日本語 README](../README.md) · [English README](../README.en.md) · [公開手順 / Publishing](PUBLISHING.md)

## 日本語

Node.js 18以上でビルドとテストを実行します。追加パッケージのインストールは不要です。演習を利用する人にはNode.jsは必要ありません。

```sh
npm test
npm run build
npm run check:release
```

`npm test` は `tests/*.test.cjs` をNode.jsのテストランナーで実行します。`npm run build` は、本体の `build.cjs` を一時出力先で実行し、生成HTMLの基本構成を検査してから、次の5ファイルへ同じ内容を保存します。

| ファイル | 用途 |
| --- | --- |
| `dist/index.html` | 本体ビルドの標準配布物 |
| `index.html` | リポジトリから直接取得する単一HTML |
| `threathunting-room.html` | 名前付きのオフライン配布物・Release添付用 |
| `docs/index.html` | GitHub Pagesの入口 |
| `docs/threathunting-room.html` | Pagesから取得するオフライン配布物 |

`docs/.nojekyll` も生成します。`TH_OUTPUT_DIR` の環境設定にかかわらず、この公開用ビルドは上記の場所に出力します。本体単体の検証では `node build.cjs` と `TH_OUTPUT_DIR` を引き続き利用できます。

### ソースの構成

| 場所 | 内容 |
| --- | --- |
| `src/content-*.cjs` | 課題、ヒント、解説、成果物ステップ |
| `src/environment.cjs` | 架空の資産と合成ログ |
| `src/timezone-data.cjs` | 作者用の日本時間を配布用UTCへ変換 |
| `src/i18n.js`、`src/i18n-*.en.json` | 表示言語の切り替えと英語辞書 |
| `src/catalog.cjs` | 教材と共通データの統合 |
| `src/public-data.cjs` | 配布用IDと旧進捗の対応付け |
| `src/engine.js` | 検索、集計、比較、採点、進捗の検証 |
| `src/*views.js`、`src/app.js` | 表示、操作、状態管理 |
| `src/tutorial.js`、`src/reports.js` | 操作ガイド、持ち帰り用の出力 |
| `src/shell.html`、`src/style.css` | 単一HTMLの雛形、画面のスタイル |
| `tests/` | 本体の自動テストと移行用データ |
| `CONTRACT.md` | 教材データとエンジンの契約 |
| `scripts/` | 公開用ビルドと静的検査 |
| `docs/images/` | README専用のイラスト |

READMEの画像はアプリへ埋め込みません。HTMLは外部サービスへ接続せず、教材・スタイル・処理を単一ファイルに含めます。生ログ、ID、採点対象、進捗形式の変更は、移行テストと一緒に扱ってください。

### 検査の範囲

公開用の静的検査は、配布5ファイルの一致、インラインコードとJSONの構文、課題ID、外部依存や通信処理の混入、イラストの混入、一部のローカルパスを確認します。架空の `C:/Users/analyst` のようなWindowsパスは、macOSの個人用パスと区別します。

本体の操作テストはNode.jsのVMと最小DOMを使います。実ブラウザのレイアウト、フォーカス、ファイル保存、読み込み、ストレージ制限は別途確認します。静的検査は個人情報の完全検出や英訳の網羅性を保証しません。公開前の確認項目は[公開手順](PUBLISHING.md)を参照してください。

### 今後の本体更新を取り込むとき

本体開発側で版を確定してから、同じ時点の `src/`、`tests/`、`build.cjs`、`CONTRACT.md` を取り込みます。公開用READMEや `scripts/` を開発中の旧ファイルで上書きしないでください。本体が未配置なら、ビルドとテストはエラーで停止します。仮のHTMLやテスト成功表示は作りません。

課題数・版番号・言語対応・保存互換性を、確定版に合わせてドキュメントと再照合します。新しい課題に必要な英訳は辞書へ追加します。言語切り替え後もログ原文・フォーム値・進捗・採点が変わらないことを確認してください。

## English

Use Node.js 18 or later. No extra packages are needed. Learners only need a browser.

Run `npm test`, `npm run build`, then `npm run check:release`. The build wrapper runs the application's `build.cjs` in a temporary directory, validates the result, and writes five identical standalone HTML files: `dist/index.html`, `index.html`, `threathunting-room.html`, `docs/index.html`, and `docs/threathunting-room.html`. It also creates `docs/.nojekyll`.

Course data lives in `src/content-*.cjs`; synthetic assets and logs live in `src/environment.cjs`. `src/catalog.cjs` combines the course, and `src/public-data.cjs` manages public IDs and migration aliases. `src/timezone-data.cjs` converts authored JST wall-clock values to UTC. `src/i18n.js` and the English JSON dictionaries provide display-language switching. The engine handles analysis, grading, and progress validation. View modules, the controller, tutorial, and reports provide the interface. See `CONTRACT.md` for the data contract.

Keep illustrations in the README. Do not add them to the application. Keep the app self-contained and offline. Changes to raw records, IDs, grading, or saved progress need matching migration checks.

Release checks cover byte parity, script/JSON syntax, task IDs, external dependencies, common network APIs, illustrations, and some local paths. They intentionally allow fictional Windows paths. They do not replace a personal-data audit, translation review, or real-browser checks. Application tests use a Node.js VM and minimal DOM; verify layout, focus, downloads, imports, and storage separately in browsers.

When the application is being updated, wait for a finalized source snapshot. Import `src/`, `tests/`, `build.cjs`, and `CONTRACT.md` from that same snapshot, without overwriting the publication documentation or scripts. Missing application files cause a clear failure, not a placeholder build. Reconcile the version, course counts, language support, and save compatibility after the import, then update the translation dictionaries and verify language switching with the new content.
