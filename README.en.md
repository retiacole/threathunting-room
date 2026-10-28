<p align="center">
  <img src="docs/images/threathunting-room-banner.png" width="960" alt="The ThreatHunting-room ranger examines footprints with a lantern and magnifying glass in a moonlit forest">
</p>

# ThreatHunting-room v0.8.2

[日本語](README.md) · [English](README.en.md)

<img src="docs/images/threathunting-room-character.png" align="right" width="120" alt="The ThreatHunting-room ranger wearing a green hood and carrying a lantern and magnifying glass">

**Form a hypothesis. Follow the traces. Turn evidence into action.**<br>
*仮説を立てる。痕跡を探す。根拠を次の行動へつなげる。*

[Start learning](https://retiacole.github.io/threathunting-room/) · [Download a single HTML file](https://retiacole.github.io/threathunting-room/threathunting-room.html)

**Practice threat hunting, from forming a hypothesis to explaining your findings, entirely in your browser.**

Start by asking what suspicious activity might look like in an environment. Select relevant logs, search and summarize records, and compare what you find. Keep evidence that supports your hypothesis alongside counter-evidence, legitimate business explanations, and gaps in visibility.

The aim is to explain what you know, what remains uncertain, and what to do next. An interactive tutorial introduces the interface before you move on to the investigations.

<br clear="right">

The app is written in JavaScript and runs as a single HTML file. No installation, administrator access, server, or API key is required. Once downloaded, it works offline in a browser with JavaScript enabled. If your organization restricts local HTML files, use a delivery method approved by your organization.

The app and documentation were created with the help of AI (OpenAI Codex). The maintainer, retiacole, reviews, corrects, and updates the content.

## Get started

1. [Open the app](https://retiacole.github.io/threathunting-room/), or save and open the [offline HTML file](https://retiacole.github.io/threathunting-room/threathunting-room.html). If the download link opens the app, use your browser's option to save the linked file.
2. Start with the interactive tutorial to try searching, inspecting records, recording evidence, and answering questions.
3. Read the investigation request, then search, aggregate, and compare relevant logs.
4. Add records to your hunt notes and explain how each one supports, challenges, or adds context to your hypothesis. Then review your answers or report.
5. Export your progress as JSON and save your hunt records when you finish a session.

You can also use **Download raw file** on [threathunting-room.html](threathunting-room.html) in the repository. See the [user guide](docs/USER_GUIDE.en.md) for detailed instructions.

On your first visit, the app opens in Japanese if Japanese is your browser's preferred language; otherwise, it opens in English. Use the **Language** menu at the top to switch languages. The app remembers your choice for future visits. Lessons, hints, and explanations switch together, while your progress, answers, raw logs, identifiers, and query values stay unchanged.

## What you will practice

The course includes **38 main lessons, one interactive tutorial, one optional capstone, and nine follow-up activities** for turning findings into reports, detection candidates, and other deliverables. Part 2 uses a shared environment with 15 endpoints and five servers.

A03, F01, and F03 each offer **two optional follow-up questions, six in total**. They become available after the investigation in A03, and after both the investigation and deliverable in F01 and F03. You can skip them and continue to another lesson without affecting your progress. The collapsible “In practice” sections explain how to follow up on your findings at work. They are optional and ungraded.

- **Connect hypotheses to data:** decide what to investigate and which logs can answer the question.
- **Compare against normal activity:** explore counts, unusual activity, process relationships, and timelines.
- **Distinguish evidence roles:** organize support, counter-evidence, background, and visibility gaps rather than drawing conclusions from supporting records alone.
- **Explain scope and limitations:** distinguish a lack of observed activity from a lack of suitable logs.
- **Choose the next action:** prepare hunt records, detection conditions, handoffs, visibility improvements, and plans for the next hunt.

The letter in each lesson ID identifies its chapter. I, P, and F make up Part 1; A, B, C, D, E, L, and G make up Part 2.

| Chapter and lesson IDs | Topic | What you practice |
| --- | --- | --- |
| T (`tutorial`) | Interactive tutorial | Searching, inspecting records, recording evidence, and answering questions |
| I01–I06 | Introduction | Investigation tools, hypotheses and data, aggregation, comparison, and reporting |
| P01–P06 | Practice | Testing a supplied hypothesis against logs and evidence |
| F01–F03 | Fieldwork | Connecting clues and turning findings into deliverables |
| A01–A04 | Visibility inventory | Checking available logs and gaps in coverage |
| B01–B03 | Baseline | Comparing normal activity with unusual but legitimate activity |
| C01–C05 | Forming hypotheses | Turning threat intelligence, ATT&CK techniques, and other starting points into testable questions |
| D01–D03 | Expanding and narrowing the investigation | Checking other endpoints and deciding whether activity belongs to the same incident |
| E01–E03 | When a hunt finds no supporting evidence | Distinguishing an unsupported hypothesis from insufficient visibility |
| L01–L03 | Linux hunts | Connecting authentication, privilege, and scheduled-execution records |
| G01–G02 | Planning the next hunt | Setting priorities and planning the next hunt |
| X01 (optional) | Independent capstone | Choosing a starting point and explaining a hypothesis, comparisons, counter-evidence, limits, and next actions |

See the [curriculum guide](docs/CURRICULUM.en.md) for a suggested learning path. You can choose chapters without completing every earlier lesson. A01 includes an optional walkthrough of the asset inventory, collection coverage, and relevant logs, plus a short exercise on UTC/JST and Japanese business days.

After G02, you can try X01: an independent hunt tracked separately from the 38 main lessons. Choose a starting point from a new dataset covering three assets, then submit 4–8 annotated records and a query that retrieves them across both periods. To mark the exercise complete, the app checks your submission's structure, whether the query reproduces the evidence, and whether you have reviewed your work against the examples. It does not judge the accuracy of your written conclusions or evidence classifications.

## Where it fits in the room series

Use this as a next step after practicing log reading in [SOCroom-easy](https://github.com/retiacole/socroom-easy), log searches and aggregation in [Logroom](https://github.com/retiacole/logroom), and investigation and reporting in [SOCroom](https://github.com/retiacole/socroom). ThreatHunting-room focuses on starting an investigation from a hypothesis.

Completing every other room is not a prerequisite. Start with the tutorial and introductory lessons, and revisit [Linuxroom](https://github.com/retiacole/linuxroom) or [pcaproom-easy](https://github.com/retiacole/pcaproom-easy) when you need more practice with commands or network traffic.

## Scope and limitations

ThreatHunting-room is an **educational simulation** using fictional environments and synthetic logs. It does not fully reproduce a real SIEM, EDR, or Linux system. Search syntax, displays, assessment, and investigation workflows are simplified for learning and do not behave exactly like their real-world counterparts.

The app does not monitor real endpoints, execute operating-system commands, or attack external networks. The Linux topics also use on-screen log analysis. You do not need to enter real organizational logs or credentials.

Structured answers and evidence are checked against lesson criteria. For free-text responses, you compare your work with examples and reflect on the differences; the meaning of your writing is not graded automatically. Optional checklists beside the examples prompt you to consider alternative explanations, gaps in visibility, evidence, and next actions. Checklist selections are neither saved nor graded. Use the comparison confirmation button to record that you have reviewed your answer. The single HTML file includes lesson data and assessment logic, so it cannot keep answers hidden for an exam.

## Saving and privacy

Progress is stored in your browser. There is no account registration or progress upload to a server. Saved progress may be unavailable if you switch browsers, open the app at a different address or file location, or clear browser data. **Keep a separate progress JSON backup.** Use export and import to move progress between the hosted app and a local HTML file.

Progress JSON, hunt records, plans, and CSV exports may contain notes or investigation details you entered. Review these files before attaching them to a public issue or sharing them. See [security and data handling](SECURITY.md).

## What changed in v0.8.2

- The page shows a course overview and estimated study times before JavaScript starts, with clearer no-JavaScript guidance, an offline HTML link, and sharing metadata.
- Optional self-review checklists appear beside free-text examples.
- [Connecting lessons to real tools](docs/PRACTICE_BRIDGE.en.md) shows how a lesson query maps to SPL, KQL, and Sigma, and relates the course to ATT&CK, PEAK, and TaHiTI.
- Browser smoke tests check startup, language selection, and keyboard interaction. Chapter references, version information, and contribution guidance are also clearer.

See the [changelog](CHANGELOG.md) for earlier releases, including initial language selection in v0.8.1 and optional follow-up exercises in v0.8.0. The version shown at the top of the app comes from `package.json` and is the same in the hosted and offline files and both languages.

## Documentation

- [User guide](docs/USER_GUIDE.en.md) — interface, searches, evidence, saving, importing, and exports
- [Curriculum guide](docs/CURRICULUM.en.md) — topics, learning route, and related rooms
- [Connecting lessons to real tools](docs/PRACTICE_BRIDGE.en.md) — SPL, KQL, and Sigma examples, ATT&CK, and hunting methods
- [Development guide](docs/DEVELOPMENT.md) — source layout, builds, tests, and standalone HTML
- [Publishing guide](docs/PUBLISHING.md) — GitHub Pages, downloadable files, and release checks
- [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Security and data handling](SECURITY.md)

## Report a problem or suggest an improvement

Open an issue with the lesson name, reproduction steps, expected result, actual result, and browser name. Suggestions and fixes are welcome through issues and pull requests. Use the included synthetic data to reproduce problems, and leave out personal information and real organizational logs.

## License

[MIT License](LICENSE). You may use, modify, and redistribute the project while retaining the copyright and license notice. External reference materials remain the property of their respective rights holders.

<p align="center">
  <img src="docs/images/threathunting-room-ending.png" width="100%" alt="The six room-series companions, including the green-hooded ranger, walk toward a distant castle">
</p>
