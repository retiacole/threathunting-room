# 変更への参加 / Contributing

## 日本語

教材の誤りの報告、操作性の改善、翻訳、課題の提案を歓迎します。Issueで内容を相談するか、変更を加えたフォークからPull Requestを送ってください。変更はメンテナーが確認して取り込みます。

不具合の報告には、課題名、手順、入力した検索式、期待した結果、実際の結果、ブラウザ名とアプリの版を記載してください。実組織のログや個人情報は含めず、教材のデータで再現できる例を使ってください。

ソースの変更は `src/` で行い、配布HTMLはビルドで生成します。[開発ガイド](docs/DEVELOPMENT.md)に従って、関連する自動テストと実ブラウザの操作を確認してください。画面上の言語を追加・変更するときは、ログの値・ID・採点・保存データまで書き換えないようにします。

### Pull Requestの進め方

1. フォークから作業ブランチを作り、ひとつの目的に絞って変更します。大きな課題追加や保存形式の変更は、先にIssueで目的と互換性の方針を相談してください。小さな修正は直接PRにできます。
2. ソースと関連テストを修正し、必要な日英文書・翻訳を更新します。変更の理由が分かるコミット名を付け、無関係な整理を混ぜないでください。
3. `npm test`、`npm run build`、`npm run check:release` を実行します。画面や操作を変えた場合は `npm run test:browser` と関連する手動操作も確認してください。ブラウザテストの準備は[開発ガイド](docs/DEVELOPMENT.md)にあります。生成HTML5ファイルをビルド結果と揃えてPRへ含めます。
4. PRテンプレートに、変更前後の動作、学習上の目的、実行した確認、未確認事項、進捗互換性への影響を記載します。メンテナーが確認し、必要に応じて修正を相談してから取り込みます。

リリース時の版番号はメンテナーが揃えます。`package.json`、日英README、`CONTRACT.md`、版を記載したガイドと`CHANGELOG.md`を同じリリースに合わせ、各リリースの変更を履歴に残します。公開済みの履歴は保持し、以後の変更を追跡できる単位で追加します。PRをまとめて取り込む場合も、PR本文と変更履歴に目的・確認結果を残します。

GitHubの言語統計では、ビルドで生成する5つのHTMLだけを生成物として扱い、編集対象のJavaScript/CJSソースは集計対象にします。生成物はリポジトリに含め、通常の差分レビューではソースとテストを先に確認します。

課題や採点を変える場合は、正当な業務、反証、観測不足の扱いも説明してください。保存キーや課題IDなど、既存の進捗との互換性に影響する変更には移行方法とテストを添えてください。画像はREADMEの紹介用に置き、学習用HTMLへ組み込まない方針です。

脆弱性や機密性のある報告は[SECURITY.md](SECURITY.md)の連絡先へお願いします。提供する変更は、このプロジェクトの[MIT License](LICENSE)で配布できるものにしてください。

## English

Reports of lesson errors, usability improvements, translations, and exercise ideas are welcome. Open an issue to discuss a change, or submit a pull request from your fork. The maintainer reviews changes before merging them.

For bug reports, include the lesson, reproduction steps, query entered, expected and actual results, browser, and app version. Use the included synthetic data, and leave out real organizational logs and personal information.

Edit the source in `src/` and generate the distribution HTML through the build. Follow the [development guide](docs/DEVELOPMENT.md), run relevant tests, and check affected interactions in a real browser. When adding or changing a display language, preserve raw log values, identifiers, grading, and saved progress.

### Pull request workflow

1. Create a branch in your fork and keep the change focused on one purpose. Discuss major lesson additions or save-format changes in an issue first, including the compatibility plan. Small fixes can go straight to a pull request.
2. Update the source, relevant tests, and any affected Japanese and English documentation or translations. Use commit messages that explain the change, and keep unrelated cleanup separate.
3. Run `npm test`, `npm run build`, and `npm run check:release`. For interface or interaction changes, also run `npm run test:browser` and check the affected interactions manually. See the [development guide](docs/DEVELOPMENT.md) for browser-test setup. Include all five generated HTML files so they match the source.
4. Use the PR template to describe the behavior before and after the change, its learning purpose, checks performed, anything still unverified, and effects on saved progress. The maintainer reviews the PR and may request revisions before merging.

The maintainer coordinates release versions across `package.json`, both READMEs, `CONTRACT.md`, versioned guides, and `CHANGELOG.md`. Every release should have a changelog entry. Keep published history intact and add future changes in traceable units. If a PR is squash-merged, preserve its purpose and validation in the PR description and changelog.

For GitHub language statistics, only the five built HTML distributions are marked as generated. Authored JavaScript and CJS files remain included. Generated files stay in the repository; reviewers should start with the source and tests.

For changes to lessons or grading, explain how legitimate activity, counter-evidence, and visibility gaps are handled. Changes affecting saved progress, including storage keys and task identifiers, need a migration approach and tests. Artwork belongs in the README introduction and must stay outside the learning HTML.

Use the contact in [SECURITY.md](SECURITY.md) for vulnerabilities or confidential reports. Contributions must be suitable for distribution under the project's [MIT License](LICENSE).
