# 変更への参加 / Contributing

## 日本語

教材の誤りの報告、操作性の改善、翻訳、課題の提案を歓迎します。Issueで内容を相談するか、変更を加えたフォークからPull Requestを送ってください。変更はメンテナーが確認して取り込みます。

不具合の報告には、課題名、手順、入力した検索式、期待した結果、実際の結果、ブラウザ名とアプリの版を記載してください。実組織のログや個人情報は含めず、教材のデータで再現できる例を使ってください。

ソースの変更は `src/` で行い、配布HTMLはビルドで生成します。[開発ガイド](docs/DEVELOPMENT.md)に従って、関連する自動テストと実ブラウザの操作を確認してください。画面上の言語を追加・変更するときは、ログの値・ID・採点・保存データまで書き換えないようにします。

課題や採点を変える場合は、正当な業務、反証、観測不足の扱いも説明してください。保存キーや課題IDなど、既存の進捗との互換性に影響する変更には移行方法とテストを添えてください。画像はREADMEの紹介用に置き、学習用HTMLへ組み込まない方針です。

脆弱性や機密性のある報告は[SECURITY.md](SECURITY.md)の連絡先へお願いします。提供する変更は、このプロジェクトの[MIT License](LICENSE)で配布できるものにしてください。

## English

Reports of lesson errors, usability improvements, translations, and exercise ideas are welcome. Open an issue to discuss a change, or submit a pull request from your fork. The maintainer reviews changes before merging them.

For bug reports, include the lesson, reproduction steps, query entered, expected and actual results, browser, and app version. Use the included synthetic data, and leave out real organizational logs and personal information.

Edit the source in `src/` and generate the distribution HTML through the build. Follow the [development guide](docs/DEVELOPMENT.md), run relevant tests, and check affected interactions in a real browser. When adding or changing a display language, preserve raw log values, identifiers, grading, and saved progress.

For changes to lessons or grading, explain how legitimate activity, counter-evidence, and visibility gaps are handled. Changes affecting saved progress, including storage keys and task identifiers, need a migration approach and tests. Artwork belongs in the README introduction and must stay outside the learning HTML.

Use the contact in [SECURITY.md](SECURITY.md) for vulnerabilities or confidential reports. Contributions must be suitable for distribution under the project's [MIT License](LICENSE).
