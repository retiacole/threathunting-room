# 教材から実務への橋渡し

[日本語 README](../README.md) · [English](PRACTICE_BRIDGE.en.md)

このガイドは、F01で作る検知候補を実際の検索構文へ移すための対応例です。教材の検索式をそのまま本番へ移植できるという意味ではありません。`docview.exe` は架空の文書アプリ名です。製品に合わせたフィールド対応、収集範囲、良性例との比較が必要です。

## F01の問いとフィールド対応

「文書アプリを親とするPowerShell起動はあるか」を先に調べ、その実行に対応する通信を別途照合します。

```text
source:端末 parent:docview.exe process:powershell.exe
```

| 教材 | Splunkの演習用スキーマ | Defender XDR | SigmaのWindowsプロセス作成ログ |
| --- | --- | --- | --- |
| `source:端末` | `sourcetype="threathunting:process"` | `DeviceProcessEvents` の `ProcessCreated` | `category: process_creation` / `product: windows` |
| `parent` | `parent`（ファイル名のみ） | `InitiatingProcessFileName` | `ParentImage`（フルパス） |
| `process` | `process`（ファイル名のみ） | `FileName` | `Image`（フルパス） |
| `host` | `host` | `DeviceName` / 安定した照合には `DeviceId` | バックエンドの端末フィールド |
| `process_guid` | 収集・抽出した `process_guid` | 教材GUIDとの直接互換はない | ログと変換処理による |

これは作者による対応例です。Splunkの `parent` / `process` は標準で存在するとの仮定ではなく、以下の例のために正規化した項目です。製品間で同じ名前のIDが同じ実行を表すとは限りません。Defenderの列の意味は [DeviceProcessEventsの公式仕様](https://learn.microsoft.com/en-us/defender-xdr/advanced-hunting-deviceprocessevents-table)、Sigmaのフィールドは [公式Taxonomy](https://sigmahq.io/sigma-specification/specification/sigma-appendix-taxonomy.html) で確認してください。

## SPLとKQLの例

比較前に両製品の対象端末と期間をそろえます。F01の今回の期間なら、UTCで `2026-09-14T00:00:00Z` 以上、`2026-09-17T00:00:00Z` 未満です。比較用期間はUTCで9月7日以上、9月10日未満として別に検索します。F01成果物の採点は両期間の収録標本を使います。製品の時刻選択や表示タイムゾーンを確認し、実データでは調査対象の期間に置き換えてください。

Splunkでは `threathunting` という演習用インデックスにプロセス作成記録を取り込み、上表のフィールドを抽出済みと仮定します。時間範囲は検索画面で設定します。この例は親子実行の条件だけを示すため、実際の調査範囲に合わせて `host` の絞り込み条件を追加します。

```spl
index=threathunting sourcetype="threathunting:process" parent="docview.exe" process="powershell.exe"
| table _time host parent process process_guid
```

フィールドと値の組を空白で並べるこの例はAND条件です。教材の `field:value` を文字どおり置換するのではなく、対象製品の演算子・NULL・大文字小文字の扱いも確かめます。[Splunk公式 search リファレンス](https://help.splunk.com/en/splunk-enterprise/spl-search-reference/9.1/search-commands/search)

KQLの例はMicrosoft Defender XDR用です。必要なDefender for Endpointの収集が有効で、テーブルを参照できることが前提です。Microsoft Sentinelの任意のテーブルに同じ列があるとは限りません。時間範囲は検索画面で指定します。この例は利用可能な全端末を対象とするため、実際の調査範囲に合わせて `DeviceId` などの絞り込みを追加します。

```kusto
DeviceProcessEvents
| where ActionType == "ProcessCreated"
| where InitiatingProcessFileName =~ "docview.exe" and FileName =~ "powershell.exe"
| project Timestamp, DeviceId, DeviceName, InitiatingProcessFileName, FileName, ProcessId, ProcessCreationTime
```

`=~` は大文字小文字を区別しない等値比較です。名前の一致だけで攻撃と判断せず、スクリプト内容や業務条件を読みます。[Microsoft公式 文字列演算子](https://learn.microsoft.com/en-us/kusto/query/datatypes-string-operators?view=microsoft-fabric)

## Sigmaで候補条件を表す

次はルールの抜粋です。フルパス末尾を比較するので、単なるファイル名だけのログへ適用すると期待どおりには一致しません。バックエンドと変換パイプラインを選び、実フィールドへ対応付け、必要なメタデータを含むルールにして検証します。期間と対象は変換先で指定します。[Sigma公式 Log Sources](https://sigmahq.io/docs/basics/log-sources.html)・[Modifiers](https://sigmahq.io/docs/basics/modifiers.html)・[Pipelines](https://sigmahq.io/docs/digging-deeper/pipelines.html)

```yaml
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    ParentImage|endswith: '\docview.exe'
    Image|endswith: '\powershell.exe'
  condition: selection
```

いずれの例も、親子実行の候補だけを抽出します。ネットワーク記録と結合する際は、製品の実行識別子と端末を照合し、PIDしかない場合は生成時刻・PID再利用も考慮します。同じ端末、同じ名前、近い時刻だけでは同一実行と断定できません。良性の定例処理、収集漏れ、名称変更や別アプリを使った実行を含めて評価し、候補数と例外の範囲を記録します。ここでの例は各製品上で実行検証済みの検知ルールではありません。

## ATT&CKで共有する観点

PowerShellのコマンド・スクリプト実行は [MITRE ATT&CK T1059.001: PowerShell](https://attack.mitre.org/techniques/T1059/001/) を参照して整理できます。これは行動を議論するための対応で、`powershell.exe` を見ただけで悪用や侵害を認定するものではありません。この式がT1059.001の全実装を検知することも意味しません。

文書アプリ、実行者、スクリプトの来歴・内容、後続活動を照合します。通信が見えても、その目的が未確認ならC2や流出の技法を決めつけません。ATT&CKのID、観測した事実、未確認の解釈を分けて報告します。

## PEAK / TaHiTIとの学習上の対応

以下は作者による学習用の対応表です。教材は両手法の全工程、組織の承認手順、成熟度を再現・認定しません。

| 教材で練習すること | PEAKで振り返る観点 | TaHiTIで振り返る段階 |
| --- | --- | --- |
| Aの可視性、Cの問い、Gの優先順位・計画 | Prepare：対象と使えるデータを定める | Initiate：調査を始める理由と範囲 |
| Bの通常比較、Dの展開、Lのログ照合など | Execute：比較・検索・証拠による検証 | Hunt：調べて記録する |
| 成果物の検知候補・引継ぎ・可視性改善、Gの次の計画 | Act：知見を共有して改善へつなぐ | Finalize：結果と次の改善を整理する |

PEAKは各段階でKnowledgeを使います。C01で外部情報を自環境の問いに変え、通常業務の知識で候補を見直す練習も、この観点で振り返れます。[Splunk公式 PEAK紹介](https://www.splunk.com/en_us/blog/security/peak-threat-hunting-framework.html)

TaHiTIは脅威情報をハントの起点と調査の文脈に取り込みます。C01の外部情報、G02の見送った問い、終了時に残す未確認事項を、継続的な調査の材料にします。[TaHiTI公式方法論 v1.0](https://www.nvb.nl/media/rygbrwew/def-tahiti-threat-hunting-methodology.pdf)
