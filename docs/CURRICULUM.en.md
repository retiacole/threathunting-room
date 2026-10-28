# Learning map (v0.8.1)

[README](../README.en.md) · [日本語](CURRICULUM.md) · [User guide](USER_GUIDE.en.md)

ThreatHunting-room practices a sequence of **hypothesis → investigation → evidence → conclusion and limitations → next action**. The goal extends beyond finding suspicious records: it includes comparison with normal business activity, counter-evidence, and gaps in visibility.


The course contains 38 main lessons, a separate interface tutorial and optional capstone X01, and nine follow-up deliverable steps. A03, F01 and F03 have two optional follow-up questions each, six in total; they do not change the main lesson count or completion criteria.

## Suggested route

Start with the interface tutorial, then follow the route below to progress from investigation tools to planning your own hunt. Japanese chapter names are included so you can find them in the application.

**Foundations (入門) → A → B → Guided hunts (練習) → E → C → Field practice (実践) → D → Linux → G**

Chapters can be selected freely. You do not need to finish every task in one sitting. Return to the tutorial or foundations when an operation is unfamiliar, and use hints and explanations to review your reasoning.

| Section | What you practice |
| --- | --- |
| Interface tutorial | Navigation, searching, record details, evidence, answers, and reflection |
| Part 1: Foundations (入門) | Search, hypotheses and data, aggregation, comparison, following related records, and reporting |
| Part 1: Guided hunts (練習) | Test a supplied hypothesis using suitable logs and evidence |
| Part 1: Field practice (実践) | Connect multiple clues and explain conclusions and limitations |
| Part 2, A: Visibility inventory | Identify what is observable and what is missing |
| Part 2, B: Baselines | Compare with ordinary activity and examine rare but legitimate behavior |
| Part 2, C: Hypothesis origins | Develop hypotheses from threat reports, ATT&CK techniques, past incidents, critical assets, and detection gaps |
| Part 2, D: Expanding an investigation | Follow related records and decide whether activities belong to the same incident |
| Part 2, E: Hunts without findings | Distinguish no supporting evidence from insufficient visibility, and record the value and limits of the investigation |
| Part 2, L: Linux | Analyze synthetic authentication, privilege, and scheduled-execution logs through the interface |
| Part 2, G: Planning the next hunt | Turn findings into new hypotheses, priorities, and a hunt plan |

Part 1 uses independent scenarios. Part 2 uses the shared environment of a fictional company. Its assets and normal activities recur across tasks, while each task has a fixed assessment scope. An asset appearing in the inventory does not mean that all the required logs are available.

## Turn findings into deliverables

Some guided and field tasks continue into a deliverable such as a detection condition, handoff, or visibility improvement request. Investigation completion and deliverable completion are recorded separately.

You can export a hunt record organized into hypothesis, origin, logs used, query, findings, limitations, and next action. Chapters using the shared environment also support a first-hunt plan that brings together visibility findings and candidate hypotheses. Treat unfinished sections as work in progress, distinct from completed findings.

Free-text writing supports reflection against model examples. It is not automatically assessed for meaning by an AI, and it does not establish that a plan is suitable for a real organization.

## Optional follow-up questions and “In practice”

After completing the A03 investigation, or both the F01/F03 investigation and deliverable, use “Try a little more” to open materials and two questions. Their answers and completion are recorded separately from the main work. Incorrect or unanswered questions do not revoke completed investigations or block another task or review. Older progress files remain supported.

| Existing task | What the optional questions cover |
| --- | --- |
| A03: Records interrupted during a comparison period | “Separate event time from ingestion time”: compare both timestamps in a separate delayed-delivery example; distinguish the order of activity from the order it became visible |
| F01: Turn external intelligence into a local question | “Group records from the same execution into one candidate”: group five records into two investigation candidates by endpoint and execution ID; do not count duplicate delivery as new activity |
| F03: Investigate using the records that remain | “Test improved visibility with a separate later session”: read what later test records reveal after logging improvements; collecting new records does not restore missing historical data |

C03 clarifies the distinction between stored objects with the same hash and execution or subsequent activity. Ungraded, collapsible “In practice” notes appear in the I06, C01, C05 and G02 explanations and the P03, P04 and F01 deliverable explanations. They briefly discuss finding the right person to ask, reconsidering a question when evidence changes, outstanding questions after a handoff, and the scope of CTI or detection candidates. No organizational workflow or responsibility-transfer task is added; the experience remains centered on investigating logs and judging evidence.

## Where this fits in the room series

This tool moves from reading logs and traffic toward asking and investigating your own questions. Experience with the series through SOCroom provides useful context, but completing every exercise in the other tools is not a prerequisite.

| Tool | Skills to revisit |
| --- | --- |
| [Linuxroom](https://github.com/retiacole/linuxroom) | Basic commands for files, searching, and aggregation |
| [SOCroom-easy](https://github.com/retiacole/socroom-easy) | Reading timestamps, accounts, and outcomes, and performing basic investigation operations |
| [Logroom](https://github.com/retiacole/logroom) | Searching, aggregating, and correlating logs with Linux-style commands |
| [pcaproom-easy](https://github.com/retiacole/pcaproom-easy) | Interpreting packets, protocols, and traffic flows |
| [SOCroom](https://github.com/retiacole/socroom) | Investigation, judgment, and reporting using multiple sources of information |

ThreatHunting-room itself does not execute commands. It also does not directly import progress or investigation results from the other room applications. Apply the operations and reasoning you learned to a new investigation instead.

## After G02: optional capstone X01

The recommended main route and 38-lesson total are unchanged. X01 is a separate optional lesson: choose a starting point in a new three-asset dataset, then independently form a hypothesis, compare, search, consider counterevidence, describe limits and propose next actions. No fixed investigative sequence or correct hypothesis is prescribed. Review criteria and multiple examples are available on request.

Submit 4–8 annotated records covering both periods, at least two sources, and context/counterevidence/gap roles; a reproducible query; targets, period, conclusion, limits and next actions; and self-comparison of the current hypothesis and reflection. Automated checks cover structure and reproducibility, not meaning or conclusion correctness. Continuing or reviewing the main course remains available.
