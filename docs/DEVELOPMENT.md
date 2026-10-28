# 開発ガイド / Development

[日本語 README](../README.md) · [English README](../README.en.md) · [公開手順 / Publishing](PUBLISHING.md)

## 日本語

Node.js 20以上でビルドとテストを実行します。ビルドとNode.jsのテストには追加パッケージは不要です。ブラウザテストには開発専用のPlaywrightとChromiumを使います。配布HTMLにこれらは含まれず、演習を利用する人にはNode.jsもインストールも必要ありません。

```sh
npm test
npm run build
npm run check:release
```

実ブラウザのスモークテストは次で実行します。初回の依存関係・ブラウザの取得にはネットワーク接続が必要ですが、テスト対象の教材は `file://` で開きます。

```sh
npm ci
npx playwright install chromium
npm run build
npm run test:browser
```

Linuxでブラウザ用のシステムライブラリも必要な場合は `npx playwright install --with-deps chromium` を使います。詳しくは[Playwright公式の導入手順](https://playwright.dev/docs/intro)を参照してください。`test:browser` は生成済みHTMLを検証するため、ソース変更後は先にビルドしてください。

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
| `tests/browser/`、`playwright.config.cjs` | Chromiumで配布HTMLを開くスモークテスト |
| `CONTRACT.md` | 教材データとエンジンの契約 |
| `scripts/` | 公開用ビルドと静的検査 |
| `docs/images/` | README専用のイラスト |

READMEの画像はアプリへ埋め込みません。HTMLは外部サービスへ接続せず、教材・スタイル・処理を単一ファイルに含めます。生ログ、ID、採点対象、進捗形式の変更は、移行テストと一緒に扱ってください。

### 検査の範囲

公開用の静的検査は、配布5ファイルの一致、インラインコードとJSONの構文、課題ID、外部依存や通信処理の混入、イラストの混入、一部のローカルパスを確認します。架空の `C:/Users/analyst` のようなWindowsパスは、macOSの個人用パスと区別します。

本体の操作テストはNode.jsのVMと最小DOMを使います。ブラウザスモークテストはChromiumで、日英の初期表示、PC幅と390px幅の入口、Tab/Enterでのチュートリアル起動、検索、詳細ダイアログのEscape操作、JavaScript無効時の概要とダウンロード案内を確認します。また、起動からこの操作までのJavaScript例外と外部HTTP(S)要求を検出します。全画面・全操作のレイアウトやアクセシビリティ、ファイル保存・読み込み、ストレージ制限、他のブラウザは別途確認します。静的検査は個人情報の完全検出や英訳の網羅性を保証しません。

GitHub Actionsの `Tests` は `main` へのpushとPull Requestで、Node.jsテスト、ビルド、配布ファイルの更新漏れ、静的検査、ブラウザスモークテストを実行します。失敗時のスクリーンショットとトレースは7日間保存します。ローカルの `test-results/` はGitに含めません。公開前の確認項目は[公開手順](PUBLISHING.md)を参照してください。

### 今後の本体更新を取り込むとき

本体開発側で版を確定してから、同じ時点の `src/`、`tests/`、`build.cjs`、`CONTRACT.md` を取り込みます。公開用READMEや `scripts/` を開発中の旧ファイルで上書きしないでください。本体が未配置なら、ビルドとテストはエラーで停止します。仮のHTMLやテスト成功表示は作りません。

課題数・版番号・言語対応・保存互換性を、確定版に合わせてドキュメントと再照合します。新しい課題に必要な英訳は辞書へ追加します。言語切り替え後もログ原文・フォーム値・進捗・採点が変わらないことを確認してください。

## English

Use Node.js 20 or later. The build and Node.js tests need no extra packages. Browser tests use Playwright and Chromium as development tools; neither is included in the standalone HTML. Learners only need a browser.

For browser tests, run `npm ci`, `npx playwright install chromium`, `npm run build`, and `npm run test:browser`. On Linux, use `npx playwright install --with-deps chromium` if system libraries are missing. Installation requires network access; the tests open the generated HTML through `file://`. Rebuild after changing source files. See the [official Playwright setup guide](https://playwright.dev/docs/intro).

Run `npm test`, `npm run build`, then `npm run check:release`. The build wrapper runs the application's `build.cjs` in a temporary directory, validates the result, and writes five identical standalone HTML files: `dist/index.html`, `index.html`, `threathunting-room.html`, `docs/index.html`, and `docs/threathunting-room.html`. It also creates `docs/.nojekyll`.

Course data lives in `src/content-*.cjs`; synthetic assets and logs live in `src/environment.cjs`. `src/catalog.cjs` combines the course, and `src/public-data.cjs` manages public IDs and migration aliases. `src/timezone-data.cjs` converts authored JST wall-clock values to UTC. `src/i18n.js` and the English JSON dictionaries provide display-language switching. The engine handles analysis, grading, and progress validation. View modules, the controller, tutorial, and reports provide the interface. See `CONTRACT.md` for the data contract.

Keep illustrations in the README. Do not add them to the application. Keep the app self-contained and offline. Changes to raw records, IDs, grading, or saved progress need matching migration checks.

Release checks cover byte parity, script/JSON syntax, task IDs, external dependencies, common network APIs, illustrations, and some local paths. They intentionally allow fictional Windows paths. They do not replace a personal-data audit or translation review. Application tests use a Node.js VM and minimal DOM.

Chromium smoke tests cover Japanese and English startup, desktop and 390px-wide entry screens, starting the tutorial with Tab/Enter, searching, dismissing log details with Escape, and the overview and download instructions with JavaScript disabled. They also detect JavaScript exceptions and external HTTP(S) requests during these interactions. Other screens, complete accessibility coverage, downloads, imports, storage restrictions, and other browsers still need separate checks.

The `Tests` GitHub Actions workflow runs Node.js tests, builds, checks for stale distribution files, validates the release, and runs browser smoke tests on pushes and pull requests to `main`. Failure screenshots and traces are retained for seven days. Local `test-results/` files are ignored by Git.

When the application is being updated, wait for a finalized source snapshot. Import `src/`, `tests/`, `build.cjs`, and `CONTRACT.md` from that same snapshot, without overwriting the publication documentation or scripts. Missing application files cause a clear failure, not a placeholder build. Reconcile the version, course counts, language support, and save compatibility after the import, then update the translation dictionaries and verify language switching with the new content.
