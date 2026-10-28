# From the course to real-world hunting

[English README](../README.en.md) · [日本語](PRACTICE_BRIDGE.md)

This guide maps the detection candidate from F01 to real query formats. It does not make a course query ready for production. `docview.exe` is a fictional document application. You still need to map fields, check collection coverage, and compare legitimate activity.

## The F01 question and its fields

First ask whether PowerShell started from a document application. Correlate that execution with network activity in a separate step.

```text
source:端末 parent:docview.exe process:powershell.exe
```

| Course | Splunk training schema | Defender XDR | Sigma Windows process-creation logs |
| --- | --- | --- | --- |
| `source:端末` | `sourcetype="threathunting:process"` | `ProcessCreated` in `DeviceProcessEvents` | `category: process_creation` / `product: windows` |
| `parent` | `parent` (basename only) | `InitiatingProcessFileName` | `ParentImage` (full path) |
| `process` | `process` (basename only) | `FileName` | `Image` (full path) |
| `host` | `host` | `DeviceName`; use `DeviceId` for stable device correlation | Backend-specific device field |
| `process_guid` | Collected and extracted `process_guid` | No direct equivalence to the course GUID | Depends on the log and pipeline |

This is an author-provided mapping. The Splunk fields are assumptions for this example, not fields guaranteed to exist. Identifiers with similar names in different products need not identify the same execution. Check the [Defender DeviceProcessEvents reference](https://learn.microsoft.com/en-us/defender-xdr/advanced-hunting-deviceprocessevents-table) and [Sigma taxonomy](https://sigmahq.io/sigma-specification/specification/sigma-appendix-taxonomy.html).

## SPL and KQL examples

Select the same devices and period in both products. For F01's current period, use `2026-09-14T00:00:00Z` inclusive to `2026-09-17T00:00:00Z` exclusive. Search the baseline separately, from September 7 inclusive to September 10 exclusive, in UTC. The F01 deliverable is graded against course samples from both periods. Check the search time picker and display timezone; use the actual investigation period for real data.

This SPL assumes process-creation records in a training index named `threathunting`, with the fields above already extracted. Set the time range in the search interface. This example shows the parent-child conditions only; add a `host` filter to match the investigation scope.

```spl
index=threathunting sourcetype="threathunting:process" parent="docview.exe" process="powershell.exe"
| table _time host parent process process_guid
```

The adjacent field-value expressions are AND conditions. Check operators, NULL handling, and case sensitivity instead of treating the course's `field:value` syntax as a mechanical translation. [Splunk search reference](https://help.splunk.com/en/splunk-enterprise/spl-search-reference/9.1/search-commands/search)

The KQL example targets Microsoft Defender XDR. It requires the relevant Defender for Endpoint collection and access to the table. An arbitrary Microsoft Sentinel table will not necessarily have these columns. Select the time range in the query interface. This example searches all available devices; add a filter such as `DeviceId` to match the investigation scope.

```kusto
DeviceProcessEvents
| where ActionType == "ProcessCreated"
| where InitiatingProcessFileName =~ "docview.exe" and FileName =~ "powershell.exe"
| project Timestamp, DeviceId, DeviceName, InitiatingProcessFileName, FileName, ProcessId, ProcessCreationTime
```

`=~` compares strings without case sensitivity. A name match still needs context, including script contents and approved work. [Microsoft string operators](https://learn.microsoft.com/en-us/kusto/query/datatypes-string-operators?view=microsoft-fabric)

## Expressing the candidate in Sigma

This is a rule fragment. It matches the end of a full path, so a field containing only a basename will not match as intended. Choose a backend and conversion pipeline, map the actual fields, add the required rule metadata, and validate the result. Set the period and targets in the destination system. [Sigma log sources](https://sigmahq.io/docs/basics/log-sources.html), [modifiers](https://sigmahq.io/docs/basics/modifiers.html), and [pipelines](https://sigmahq.io/docs/digging-deeper/pipelines.html)

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

All three examples extract parent-child execution candidates only. For network correlation, use the product's execution identifier together with the device. If only a PID is available, account for creation time and PID reuse. A matching device, name, and nearby timestamp do not establish the same execution. Evaluate legitimate scheduled work, telemetry gaps, renamed executables, and other parent applications; record candidate counts and exception scope. These examples have not been executed and validated as detection rules in the target products.

## Describing behavior with ATT&CK

[MITRE ATT&CK T1059.001: PowerShell](https://attack.mitre.org/techniques/T1059/001/) provides a reference for command and script execution through PowerShell. This is a way to discuss behavior, not a finding of abuse or compromise whenever `powershell.exe` appears. The query also does not cover every implementation of that technique.

Review the parent application, account, script provenance and contents, and subsequent activity. Do not label a connection as command and control or exfiltration when its purpose is unknown. Report the ATT&CK reference, observed facts, and unverified interpretations separately.

## Learning connections to PEAK and TaHiTI

This table is the author's learning crosswalk. The course does not implement or certify every step, organizational approval process, or maturity criterion in either methodology.

| Course practice | PEAK perspective | TaHiTI phase |
| --- | --- | --- |
| Visibility in A, hypotheses in C, and priorities and plans in G | Prepare: define scope and usable data | Initiate: establish a reason and scope for the hunt |
| Baselines in B, expansion in D, and log correlation in L | Execute: investigate through comparison, queries, and evidence | Hunt: investigate and document |
| Detection candidates, handoffs, visibility improvements, and the next plan in G | Act: share findings and make improvements | Finalize: organize outcomes and follow-up improvements |

PEAK brings Knowledge into every phase. In C01, external intelligence helps form a local question, while knowledge of legitimate work helps reassess candidates. [Splunk's PEAK introduction](https://www.splunk.com/en_us/blog/security/peak-threat-hunting-framework.html)

TaHiTI integrates threat intelligence into the starting point and context of a hunt. C01's external information, G02's deferred questions, and unresolved points in a closure record can inform later investigations. [Official TaHiTI methodology v1.0](https://www.nvb.nl/media/rygbrwew/def-tahiti-threat-hunting-methodology.pdf)
