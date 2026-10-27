# User guide

[README](../README.en.md) · [日本語](USER_GUIDE.md) · [Learning map](CURRICULUM.en.md)

ThreatHunting-room uses a fictional environment and synthetic logs to practice forming and testing hypotheses. It does not operate real endpoints, networks, or security products. The **Language** menu switches the interface and lessons between Japanese and English. Japanese labels below also help you find controls when following the guide in Japanese mode. Switching languages preserves progress, raw records, and your input. Data values used in queries, including some log-source names, may remain in Japanese.

## Getting started

Use **Play Now** in the README, or save the offline HTML and open it in a browser with JavaScript enabled. The downloaded HTML works on its own: no installation, web server, or API key is required.

With no existing progress, the interface tutorial opens first. Complete the highlighted action to continue. **操作場所を表示** returns to the relevant control, and **中断して教材一覧へ** pauses the tutorial and returns to the learning map. Resume from the map, or open the tutorial through **ガイド** in the header.

## Investigation workflow

1. **Read the brief.** Identify the environment, time range, hypothesis, and available logs.
2. **Explore the records.** Search, aggregate, compare with a baseline, and inspect the timeline. When following an endpoint or identifier, also check the time and collection source.
3. **Record evidence.** Add relevant records to the hunt notebook and choose their role in relation to the hypothesis.
4. **State a conclusion.** Complete the requested answers and reasoning, then select **証拠と回答を確認する** to review your work. Hints and retries do not reduce your score.
5. **Choose a next action.** Where a task includes a follow-up deliverable, turn the findings into a detection condition, handoff, or visibility improvement request.

Evidence roles help distinguish the reasons for keeping a record.

| Role | Purpose |
| --- | --- |
| 支持 — Support | Supports the fact or hypothesis being investigated |
| 反証 — Counter-evidence | Supports an alternative explanation, such as legitimate business activity |
| 背景 — Context | Provides a baseline, an asset's role, or other context needed for judgment |
| 観測不足 — Visibility gap | Shows why a conclusion is limited, such as stopped collection or missing coverage |

Confirming legitimate activity, finding no support within the investigation scope, and lacking enough records to decide are different conclusions. Zero search results do not prove that an activity never occurred.

## Searching

The search field uses a simplified language specific to this learning tool. It does not execute KQL, SPL, or operating-system commands.

| Example | Meaning |
| --- | --- |
| `process:powershell.exe parent:docview.exe` | Match both conditions; whitespace means AND |
| `destination:updates.example OR destination:portal.example` | Match either condition; use uppercase OR |
| `sensor:edge-flow` | Restrict records to a particular sensor |
| `-process:powershell.exe` | Exclude a condition |
| `"multiple words"` | Treat the quoted text as one search term |
| `after:2026-09-14 before:2026-09-16` | Match an inclusive range of UTC dates |

AND is evaluated before OR. Parentheses for grouping are not supported. Log-source, endpoint, period, and other filters selected in the interface apply to every OR branch. Date conditions written inside the query apply only to their own OR group. See **検索の書き方** in the application for the complete syntax.

Aggregation and the timeline inherit the active exploration filters. Comparison uses its own scope. A submitted query is also evaluated against the fixed scope shown beside its submission field, separately from the central exploration view. **探索中の式をコピー** copies the query expression only, so check the submission scope as well.

### UTC and JST

Raw log timestamps, CSV timestamps, and the query operators `after:` and `before:` use UTC. **JSTを併記** additionally displays Japan Standard Time; it does not change the dates used by query operators. Check the UTC/JST label beside date fields and report periods.

In Part 2, investigation periods and fixed evaluation scopes follow JST business days. The date controls let you choose JST or UTC. Manually entered dates from older progress files retain their UTC meaning; times inside saved queries and notes are not automatically converted. Review them against the current scope labels.

JST is nine hours ahead of UTC. For example, September 15 in JST runs from September 14 at 15:00 UTC up to, but not including, September 15 at 15:00 UTC. The same calendar date in different time zones can select different records.

## Assessment and reflection

The application checks structured answers, required log sources, evidence and its roles, and required operations. Adding many unrelated records does not make an answer correct.

Tasks that accept a query assess the set of matching records rather than requiring one exact query string. Detection-condition tasks also use a separate evaluation dataset to expose missed and extra matches. Precision and recall describe the supplied learning samples, not production performance.

**The meaning of free text and the quality of a report are not automatically graded.** Compare your writing with the model example and review your reasoning. Repeat that comparison after editing your answer. The single HTML includes assessment criteria, so it is not an examination system designed to hide answers.

## Saving, loading, and exporting

| Control | File or action | Purpose |
| --- | --- | --- |
| 保存 in the header | Progress JSON | Back up progress or move it to another browser or release |
| 読込 in the header | Load a progress JSON | Replace matching task states and resume |
| 報告を保存 | Hunt report text | Review the hypothesis, origin, logs used, query, findings, limitations, and next action |
| Plan export | Hunt plan text | Organize visibility, baselines, candidate hypotheses, and priorities |
| CSV export | Search results | Examine records in a local CSV-capable analysis tool |

Progress is also saved automatically to the browser's localStorage. Availability depends on the browser and organizational settings. Keep a progress JSON before clearing browser data, moving to another browser, or switching between a local HTML and the hosted application.

Loading replaces matching task states with those in the file and recalculates completion using the current assessment rules. Save your current progress first if you want to preserve it. A task completed in an older release may need another review after revisions.

Reports, plans, and CSV files are not backups from which progress can be restored. There is no direct import into other room applications. CSV values can contain commas and quotation marks; use a CSV-aware reader rather than splitting text on commas.

**この課題をやり直す** resets the selected task. Export any progress or reports you want to keep beforehand.

## Scope and limitations

The synthetic logs are selected learning samples. They do not represent every event or the incidence of activity in a real environment. The Linux chapter also analyzes logs through the interface; it does not execute operating-system commands, a terminal, pipelines, or network operations.

You do not need to paste real organizational logs or secrets into the application. When reporting a problem, use the task name, steps, browser name, and a reproduction based on the supplied synthetic data.
