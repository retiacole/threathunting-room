<p align="center">
  <img src="docs/images/threathunting-room-banner.png" width="960" alt="The ThreatHunting-room ranger examines footprints with a lantern and magnifying glass in a moonlit forest">
</p>

# ThreatHunting-room v0.8.1

[日本語](README.md) · [English](README.en.md)

<img src="docs/images/threathunting-room-character.png" align="right" width="120" alt="The ThreatHunting-room ranger wearing a green hood and carrying a lantern and magnifying glass">

**Form a hypothesis. Follow the traces. Turn evidence into action.**<br>
*仮説を立てる。痕跡を探す。根拠を次の行動へつなげる。*

[Play Now](https://retiacole.github.io/threathunting-room/) · [Download a single HTML file](https://retiacole.github.io/threathunting-room/threathunting-room.html)

**Practice threat hunting, from forming a hypothesis to explaining your findings, entirely in your browser.**

Start by asking what suspicious activity might look like in an environment. Select relevant logs, search and summarize records, and compare what you find. Keep evidence that supports your hypothesis alongside counter-evidence, legitimate business explanations, and gaps in visibility.

The aim is to explain what you know, what remains uncertain, and what to do next. An interactive tutorial introduces the interface before you move on to the investigations.

<br clear="right">

The app runs as a single HTML file. No installation, administrator access, server, or API key is required. Once downloaded, it works offline in a browser with JavaScript enabled. If your organization restricts local HTML files, use a delivery method approved by your organization.

The app and documentation were created with the help of AI (OpenAI Codex). The maintainer, retiacole, reviews, corrects, and updates the content.

## Get started

1. [Open the app](https://retiacole.github.io/threathunting-room/), or save and open the [offline HTML file](https://retiacole.github.io/threathunting-room/threathunting-room.html). If the download link opens the app, use your browser's option to save the linked file.
2. Begin with the interface tutorial to try searching, inspecting records, recording evidence, and answering questions.
3. Read the investigation request, then search, aggregate, and compare relevant logs.
4. Add evidence and its role to the hunt notes, then review your answers or report.
5. Export your progress JSON and hunt records at useful stopping points.

You can also use **Download raw file** on [threathunting-room.html](threathunting-room.html) in the repository. See the [user guide](docs/USER_GUIDE.en.md) for detailed instructions.

The initial display uses Japanese when it is your browser's first language preference, and English otherwise. A choice made in the header's **Language** menu takes precedence on later visits. Lessons, hints, and explanations switch together. Progress and your input are shared across languages. Raw logs, identifiers, and query values stay unchanged.

## What you will practice

The course includes **38 main lessons, one interface tutorial, one optional capstone, and nine follow-up deliverable steps**. Part 2 uses a shared environment with 15 endpoints and five servers.

A03, F01 and F03 each offer **two optional follow-up questions, six in total**, after the investigation and any deliverable are complete. They do not change the main lesson count or completion criteria, and you can leave them to continue with another task. Collapsible “In practice” notes in selected explanations are ungraded reading about taking findings into real-world follow-up.

- **Connect hypotheses to data:** decide what to investigate and which logs can answer the question.
- **Compare against normal activity:** explore counts, unusual activity, process relationships, and timelines.
- **Distinguish evidence roles:** organize support, counter-evidence, background, and visibility gaps rather than drawing conclusions from supporting records alone.
- **Explain scope and limitations:** distinguish a lack of observed activity from a lack of suitable logs.
- **Choose the next action:** prepare hunt records, detection conditions, handoffs, visibility improvements, and plans for the next hunt.

See the [curriculum guide](docs/CURRICULUM.en.md) for the structure and suggested route. You can choose chapters without completing every earlier lesson.

## Where it fits in the room series

Use this as a next step after practicing log reading in [SOCroom-easy](https://github.com/retiacole/socroom-easy), log searches and aggregation in [Logroom](https://github.com/retiacole/logroom), and investigation and reporting in [SOCroom](https://github.com/retiacole/socroom). ThreatHunting-room focuses on starting an investigation from a hypothesis.

Completing every other room is not a prerequisite. Start with the tutorial and introductory lessons, and revisit [Linuxroom](https://github.com/retiacole/linuxroom) or [pcaproom-easy](https://github.com/retiacole/pcaproom-easy) when you need more practice with commands or network traffic.

## Scope and limitations

ThreatHunting-room is an **educational simulation** using fictional environments and synthetic logs. It does not fully reproduce a real SIEM, EDR, or Linux system. Search syntax, displays, assessment, and investigation workflows are simplified for learning and do not behave exactly like their real-world counterparts.

The app does not monitor real endpoints, execute operating-system commands, or attack external networks. The Linux topics also use on-screen log analysis. You do not need to enter real organizational logs or credentials.

Structured answers and evidence are checked against lesson criteria. Free-text responses are used for comparison with examples and self-review, not AI semantic grading. The single HTML file includes lesson data and assessment logic, so it is not designed to keep answers secret for an examination.

## Saving and privacy

Progress is stored in your browser. There is no account registration or progress upload to a server. Changing browsers or locations, or clearing browser data, may make saved progress unavailable. **Keep a separate progress JSON backup.** Use export and import to move progress between the hosted app and a local HTML file.

Progress JSON, hunt records, plans, and CSV exports may contain notes or investigation details you entered. Review these files before attaching them to a public issue or sharing them. See [security and data handling](SECURITY.md).

## Documentation

- [User guide](docs/USER_GUIDE.en.md) — interface, searches, evidence, saving, importing, and exports
- [Curriculum guide](docs/CURRICULUM.en.md) — topics, learning route, and related rooms
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

## v0.8.0: try a little more after the investigation

A03 covers event time and ingestion time; F01 groups records by endpoint and execution ID while accounting for duplicate delivery; F03 examines test records collected after logging improvements. “Try a little more” opens a short set of materials and two questions with answer feedback. A03 requires investigation completion; F01 and F03 require both investigation and deliverable completion. Answers and completion are saved separately from the main work, and incorrect answers do not revoke earlier completion.

C03 clarifies the distinction between stored objects with a matching hash and execution or subsequent activity. Short “In practice” notes appear in I06, P03, P04, C01, F01, C05 and G02. They help separate observed facts from remaining questions without simulating or grading an organization's ownership and handoff procedures. Existing investigation and deliverable completion is preserved when importing older progress.

## Entry support and an optional independent hunt

A01 has optional guidance from the asset roster to collection records and then relevant telemetry, plus a quick UTC/JST check for the same event and a Japanese business date. Its 1,470 records and existing checklist are unchanged.

After G02, **one optional capstone X01 is tracked separately from the 38 main lessons**. Choose a starting point from a new three-asset dataset and develop a hypothesis, comparison, counterevidence, limits and next actions. Submit 4–8 annotated records and a query that retrieves them across both periods. Completion checks submission structure, reproducibility and self-comparison with review examples. It does not certify the meaning of prose or evidence roles. Continue freely from the learning map; existing progress JSON remains supported.

The top header displays the version from package.json, shared by online/offline builds and both languages.
