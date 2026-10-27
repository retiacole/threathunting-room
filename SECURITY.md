# セキュリティとデータの扱い / Security and data handling

## 日本語

ThreatHunting-roomは、架空の環境と合成ログを使うブラウザ教材です。実端末の監視、実ネットワークの調査、OSコマンドの実行には使いません。演習に実際の認証情報や組織のログを入力する必要はありません。

### ブラウザ内のデータ

- 学習の進捗、解答、証拠、メモなどをブラウザのlocalStorageへ保存します。
- アプリは進捗を外部サーバーへ送信せず、分析用のアクセス追跡コードを組み込みません。
- GitHub Pagesで開くときはHTMLを取得するために通信します。外部の参考資料やGitHubのリンクを開いたときも通信が発生します。配布HTMLを入手した後の演習はオフラインで利用できます。
- ブラウザの保存制限やデータ削除に備え、アプリの「保存」で進捗JSONを保管してください。CSVやハント記録は進捗を復元するためのファイルではありません。
- 進捗を読み込む前に、現在の進捗を保存してください。読込によって同じ課題の状態が置き換わる場合があります。

書き出したファイルには、利用者が入力した内容が含まれる場合があります。共有端末のダウンロードフォルダーや、Issueへ添付するファイルにも注意してください。教材の模擬データのみで学習できます。

### 脆弱性の連絡

個人情報や機密情報を含む報告は、公開Issueへ投稿しないでください。[culture_epic_13@icloud.com](mailto:culture_epic_13@icloud.com)（retiacole）へ、影響する版、再現手順、予想される影響をお知らせください。実際の組織のログ、パスワード、アクセストークンは送らないでください。

教材内容の誤り、画面の不具合、改善提案は、合成データによる再現例とともに通常のIssueへ投稿できます。

## English

ThreatHunting-room is a browser learning tool using fictional environments and synthetic logs. It is not used to monitor real endpoints, investigate live networks, or run operating-system commands. Real credentials and organizational logs are not needed for the exercises.

### Data in your browser

- Progress, answers, evidence, and notes are stored in browser localStorage.
- The app does not upload progress to an external server or include analytics tracking code.
- Opening the hosted app requires a network request to GitHub Pages. Following external reference or GitHub links also makes network requests. After obtaining the standalone HTML, you can complete the exercises offline.
- Use the app's **保存** (Save) button to keep a progress JSON backup in case browser storage is restricted or cleared. CSV exports and hunt records cannot restore progress.
- Save current progress before importing a backup. Importing can replace the saved state of matching lessons.

Exported files may include text entered by the learner. Check files in shared download folders and attachments before sharing them. The exercises can be completed using only the included synthetic data.

### Reporting a vulnerability

Do not post personal or confidential information in a public issue. Contact retiacole at [culture_epic_13@icloud.com](mailto:culture_epic_13@icloud.com) with the affected version, reproduction steps, and expected impact. Do not send real organizational logs, passwords, or access tokens.

Content errors, interface bugs, and suggestions can be reported in a normal issue using examples based on the synthetic data.
