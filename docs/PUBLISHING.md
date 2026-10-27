# GitHubへの公開 / Publishing on GitHub

[日本語 README](../README.md) · [English README](../README.en.md) · [開発ガイド / Development](DEVELOPMENT.md)

## 公開する構成

公開先は `retiacole/threathunting-room`、ブラウザ版は `https://retiacole.github.io/threathunting-room/` を想定しています。この文書やビルドコマンドだけで、リポジトリ作成・push・Pages設定・Release作成は実行されません。

本体の更新が完了した同じ版のソースとテストを取り込み、Languageメニューと翻訳の統合を終えてから公開します。作業用の親フォルダー、レビュー記録、個人用の進捗JSON、元プロジェクトの `.git`、古い配布HTMLは含めません。

## 1. 本体と文書を確定する

1. 確定版の `src/`、`tests/`、`build.cjs`、`CONTRACT.md` を配置します。作業中の本体を直接編集したり、途中版の一部だけを取り込んだりしません。
2. README・操作ガイド・学習マップを、新版の機能・課題数・対応言語・保存互換性と照合します。英語のREADMEがあることと、本体が英語対応済みであることは別です。
3. 本体の版番号が決まったら、Releaseのタグと変更履歴をその版に合わせます。準備用の仮番号で公開しません。
4. 添付イラストは `docs/images/` に配置し、日本語・英語READMEからだけ参照します。

## 2. ローカルで確認する

```sh
npm test
npm run build
npm run check:release
```

次も確認します。

- オフラインの `file://` で、チュートリアル・検索・採点・保存JSONの書き出しと読み込みが動く。
- 日本語と英語を切り替えても、入力途中の内容・ログ・採点・進捗が変わらない。設問・ヒント・解説の翻訳漏れを確認する。
- PC幅と狭い画面で操作でき、イラストがアプリ内に表示されない。
- 新旧の進捗を読み込み、移行で変わる項目が文書の説明と一致する。
- 公開ファイル、テスト用データ、画像メタデータに、意図しない個人名・メール・ローカルパス・実組織データ・認証情報がない。
- READMEの画像と相対リンクが正しく、公開後のURLと一致する。現時点の自動検査結果だけで、手動確認まで完了したことにしない。

## 3. 新しい履歴を作る

最終的な公開フォルダーだけを対象に、新規リポジトリを初期化します。既存プロジェクトのGit履歴はコピーしません。

```sh
git init -b main
git config --local user.name retiacole
git config --local user.email culture_epic_13@icloud.com
git config --local user.useConfigOnly true
git add .
git diff --cached --stat
git diff --cached --check
git commit -m "Publish ThreatHunting-room"
git show -s --format=fuller HEAD
```

最後の表示で作成者・コミッターが意図した名前とメールになっていることを確認します。このメールはコミット情報として公開されます。GitHub側に同名リポジトリが存在する場合は、その内容を先に確認し、削除やforce pushで置き換えないでください。

## 4. Pagesとオフライン版を公開する

GitHubに公開リポジトリ `retiacole/threathunting-room` を用意し、確認済みの `main` をpushします。日本語と英語を併記したAbout欄、ブラウザ版のURLを設定します。

Pagesの公開元は **Settings → Pages → Deploy from a branch → main → /docs** とします。`docs/.nojekyll` を含め、生成済みのHTMLを配信します。この構成のために独自のワークフローは追加しません。設定の詳細は[GitHub公式の公開元の説明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)を参照してください。

実際の版番号でReleaseを作成し、ルートの `threathunting-room.html` を添付します。READMEでReleaseの「最新版ダウンロード」リンクを使う場合は、添付ファイル名と一致させます。Pagesの名前付きHTMLを保存しても同じオフライン版になります。

公開後、ブラウザ版を実際に開き、Releaseから取得したHTMLがローカルの配布物と同じSHA-256であることを確認します。プロフィールREADMEへの「すぐにやってみる / Play Now」と学習順の追加は、公開先を確認してから反映します。

## English

The intended repository is `retiacole/threathunting-room`, with Pages at `https://retiacole.github.io/threathunting-room/`. Build scripts do not create repositories, push commits, or publish releases.

Wait for the application update to be finalized. Import one consistent source-and-test snapshot, finish language-menu integration and translations, reconcile the documentation, then run the three commands above. Check offline operation, save migration, language switching, layout, and the absence of illustrations in the app. Review text files, fixtures, image metadata, and eventual commit metadata for unintended personal information.

Create a fresh Git history for the final publication folder, using the repo-local identity shown above. Do not copy an earlier `.git` directory or include staging/review files. Check an existing repository before publishing; do not delete it or force-push over it as part of these instructions.

Publish the validated `main` branch. Configure Pages to deploy from `main` and `/docs`, including `.nojekyll`; see the [official GitHub Pages instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). Attach `threathunting-room.html` to a release tagged with the actual application version. Verify the live site and downloaded file before enabling profile links. An English README alone does not mean the application is available in English.
