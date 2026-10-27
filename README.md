<p align="center">
  <img src="docs/images/threathunting-room-banner.png" width="960" alt="月明かりの森で、ランタンと虫眼鏡を使って足跡を調べるThreatHunting-roomのキャラクター">
</p>

# ThreatHunting-room v0.6

[日本語](README.md) · [English](README.en.md)

<img src="docs/images/threathunting-room-character.png" align="right" width="120" alt="緑のフードを着て、ランタンと虫眼鏡を持つThreatHunting-roomのキャラクター">

**仮説を立てる。痕跡を探す。根拠を次の行動へつなげる。**<br>
*Form a hypothesis. Follow the traces. Turn evidence into action.*

[すぐにやってみる](https://retiacole.github.io/threathunting-room/) · [HTML 1個をダウンロード](https://retiacole.github.io/threathunting-room/threathunting-room.html)

**ブラウザだけで、脅威ハンティングの考え方と調査の進め方を練習する教材です。**

「この環境で、不審な動きが起きているとしたら？」という仮説から、必要なログを選び、検索・集計・比較を行います。見つけた記録を証拠として残し、仮説を支持するものだけでなく、反証や通常業務の説明、観測できていない範囲も確かめます。

調査の答えだけでなく、どこまで分かったのか、何が分からないのか、次に何をするのかを整理する練習です。操作チュートリアルから始め、ログの読み方に慣れながら進められます。

<br clear="right">

教材は単独のHTMLファイルで動作します。ソフトウェアのインストール、管理者権限、サーバー、APIキーは不要です。HTMLをあらかじめ入手すれば、JavaScriptを実行できるブラウザでオフラインでも使えます。ローカルHTMLの実行が制限されている環境では、組織が許可した配信方法を利用してください。

アプリとドキュメントの制作には、AI（OpenAI Codex）を活用しています。内容の確認・修正・更新は、メンテナーのretiacoleが行います。

## はじめる

1. [ブラウザで開く](https://retiacole.github.io/threathunting-room/)、または[オフライン用HTML](https://retiacole.github.io/threathunting-room/threathunting-room.html)を保存して開きます。ダウンロードリンクで画面が開く場合は、リンク先をファイルとして保存してください。
2. 初めての方は、操作チュートリアルで検索・ログ詳細・証拠の登録・回答を試します。
3. 調査依頼を読み、必要なログを検索・集計・比較します。
4. ハントノートに証拠とその役割を記録し、回答や報告を振り返ります。
5. 区切りのよいところで、進捗JSONやハント記録を書き出して保管します。

リポジトリの [threathunting-room.html](threathunting-room.html) を「Download raw file」で保存する方法もあります。操作の詳細は[利用ガイド](docs/USER_GUIDE.md)をご覧ください。

画面上部の **Language** メニューで、日本語・Englishを切り替えられます。課題・ヒント・解説も切り替わり、進捗や入力内容は共通です。調査するログ原文、識別子、検索式の値はそのまま保ちます。

## 学べること

**本編38問・操作チュートリアル1問・調査後の成果物9ステップ**を収録しています。第2部では、端末15台・サーバー5台の共通環境を調べます。

- **仮説とデータを結びつける**：何を確かめたいのか、そのためにどのログが必要なのかを考えます。
- **通常の状態と比べる**：件数、珍しい動き、親子プロセス、時系列などから調査の手がかりを探します。
- **証拠の役割を区別する**：支持・反証・背景・観測不足を整理し、都合のよい記録だけで結論を出さない練習をします。
- **調査の範囲と限界を説明する**：見つからなかった理由を、活動がないこととログが不足していることに分けて考えます。
- **次の行動へつなげる**：ハント記録、検知条件、引き継ぎ、可視性の改善、次のハント計画をまとめます。

詳しい構成と進め方は[学習マップ](docs/CURRICULUM.md)にまとめています。全章を順番どおり終える必要はありません。

## roomシリーズでの位置づけ

[SOCroom-easy](https://github.com/retiacole/socroom-easy)でログの読み方、[Logroom](https://github.com/retiacole/logroom)でログの検索・集計、[SOCroom](https://github.com/retiacole/socroom)で調査・判断・報告に慣れた後の発展教材として使えます。ここでは、自分から仮説を立てて調べる流れに重点を置きます。

ほかのroomをすべて終えることは前提ではありません。まず操作チュートリアルと入門から始め、必要に応じて[Linuxroom](https://github.com/retiacole/linuxroom)や[pcaproom-easy](https://github.com/retiacole/pcaproom-easy)にも戻って学べます。

## 教材の範囲

ThreatHunting-roomは、架空の環境と合成ログを使う**学習用シミュレーター**です。実際のSIEM・EDR・Linuxを完全に再現したものではなく、検索構文、表示、採点、調査手順には教材用の簡略化があります。実物と100%同じ動作にはなりません。

実端末を監視したり、OSコマンドを実行したり、外部ネットワークへ攻撃したりする機能はありません。Linuxの題材も画面上でログを読み解きます。実際の組織のログや認証情報を入力する必要はありません。

構造化した回答や証拠は教材の基準で確認します。自由記述はAIによる意味採点ではなく、模範例との比較と自分での振り返りに使います。単一HTMLには教材データと採点処理も入るため、解答を秘密にした試験のための仕組みではありません。

## 保存とプライバシー

進捗は利用中のブラウザに保存します。アカウント登録や、サーバーへの進捗送信はありません。ブラウザ・保存先の変更やデータ削除で進捗が見つからなくなることがあるため、**進捗JSONを別途保存**してください。Web版とローカルHTMLの間では、保存・読込を使って移します。

進捗JSON、ハント記録、計画書、CSVには入力したメモや調査内容が含まれる場合があります。公開Issueや第三者へ渡す前に内容を確認してください。詳しくは[セキュリティとデータの扱い](SECURITY.md)をご覧ください。

## ドキュメント

- [利用ガイド](docs/USER_GUIDE.md) — 画面の使い方、検索、証拠、保存・読込、書き出し
- [学習マップ](docs/CURRICULUM.md) — 題材、学習の進め方、ほかのroomとのつながり
- [開発ガイド](docs/DEVELOPMENT.md) — ソース、ビルド、自動テスト、配布HTML
- [公開手順](docs/PUBLISHING.md) — GitHub Pages、配布ファイル、公開前の確認
- [変更履歴](CHANGELOG.md)・[変更への参加](CONTRIBUTING.md)・[セキュリティとデータの扱い](SECURITY.md)

## 不具合の報告・改善提案

課題名、操作手順、期待した結果、実際の結果、ブラウザ名を添えてIssueを作成してください。提案や修正案はIssue・Pull Requestで受け付けます。実組織のログや個人情報を含めず、教材のデータで再現できる例をお願いします。

## ライセンス

[MIT License](LICENSE)。著作権表示とライセンス文を残したうえで、利用・改変・再配布できます。外部の参考資料はそれぞれの権利者に帰属します。

キャラクターとイラストはGitHubの紹介ページに掲載しています。学習用HTMLには組み込んでいません。

<p align="center">
  <img src="docs/images/threathunting-room-ending.png" width="100%" alt="緑のフードのハンターが加わり、城へ向かって歩くroomシリーズの6人の仲間たち">
</p>
