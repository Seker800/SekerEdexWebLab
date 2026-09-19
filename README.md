<div align="center">

# SekerEdexWebLab

**A browser-native, source-driven port of the eDEX-UI command deck.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/Seker800/SekerEdexWebLab/actions/workflows/ci.yml/badge.svg)](https://github.com/Seker800/SekerEdexWebLab/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-8ab4b6.svg)](LICENSE)
[![Project status: Phase 0](https://img.shields.io/badge/status-Phase%200-8ab4b6.svg)](#project-status)

</div>

> [!IMPORTANT]
> SekerEdexWebLab is an unofficial browser port derived from GitSquared's
> [eDEX-UI](https://github.com/GitSquared/edex-ui). It is not maintained or endorsed by GitSquared or
> the upstream contributors.

![The upstream eDEX-UI 2.2 tron interface used as the project's frozen visual reference](references/edex-ui-v2.2.8/screenshot_default.png)

<p align="center"><sub>Frozen upstream visual reference — eDEX-UI 2.2, <code>tron</code>, <code>neofetch</code>, QWERTY. The browser port is measured against this image; this is not a screenshot of the port.</sub></p>

## About

SekerEdexWebLab brings the original eDEX-UI 2.2 interface to the browser while preserving its
full-screen command-deck experience: a central terminal, live panels, filesystem, globe, sound, and
on-screen keyboard sharing one session.

This repository contains both the browser application and the evidence-driven toolchain used to
reproduce it. The toolchain pins the upstream source, captures deterministic browser states, measures
regional visual differences, verifies interaction and audio behavior, and can run bounded Codex repair
attempts without weakening the acceptance gates.

## Highlights

- Source-driven port based on the exact eDEX-UI screenshot-era code.
- Deterministic Chromium capture with immutable target evidence.
- Startup, sound, terminal, keyboard, tab, mouse, and touch interaction checks.
- Regional pixel and perceptual comparison with durable reports and diff images.
- Finite repair state machine with clean-worktree and allowed-path guards.
- Fixed 1920×1080 desktop canvas with proportional scaling and a mobile fallback.
- Upstream provenance, copied-asset hashes, and license inventory checked in CI.

## Quick start

Requires Node.js 22 and npm.

```bash
git clone https://github.com/Seker800/SekerEdexWebLab.git
cd SekerEdexWebLab
npm install
npm run install:browsers
npm run upstream:sync
npm run app:dev
```

Open the printed local URL, keep sound enabled, and select **Initialize system**. Use **REBOOT** to
replay the startup sequence and **SOUND ON/OFF** to control audio.

## Verification

Run the complete local gate:

```bash
npm run verify
```

It verifies the locked gate policy, upstream asset integrity, type checking, unit tests, the production
build, demo workflow, startup and interaction behavior, Chromium and WebKit coverage, formal and
perceptual regional visual budgets, and the deterministic replication workflow.

Useful focused commands:

| Command | Purpose |
| --- | --- |
| `npm run gate:verify` | Verify canonical evidence, visual ceilings, asset manifest, and repair roots |
| `npm run app:verify` | Verify startup, audio, interactions, layouts, and browser errors |
| `npm run app:verify:webkit` | Verify core interactions, fixed-canvas geometry, mobile fallback, and browser errors in WebKit |
| `npm run app:hotspots` | Rank the most visible 64×64 difference regions |
| `npm run assets:verify` | Verify copied upstream assets and their SHA-256 manifest |
| `npm run replicate:verify` | Run the frozen visual replication state machine |
| `npm run replicate:repair` | Run up to three guarded, source-first repair attempts |

Reports and screenshots are written under `artifacts/` and are intentionally excluded from releases.

## How it fits together

```text
Pinned upstream source + frozen screenshot
                    │
                    ▼
      Browser application in apps/clone
                    │
             deterministic capture
                    │
                    ▼
    comparison ──► verdict ──► durable report
                       │
                       └──► bounded repair (opt in)
```

Browser observation, comparison, verdicts, and source modification remain separate process boundaries.
Codex may propose a repair, but only executable gates decide whether a scenario passes.

Read [NORTH_STAR.md](NORTH_STAR.md), [ARCHITECTURE.md](ARCHITECTURE.md), and
[the visual north star](docs/VISUAL_NORTH_STAR.md) before extending the system. The module-by-module
upstream lookup table lives in [docs/SOURCE_PORT_MAP.md](docs/SOURCE_PORT_MAP.md).

## Source and provenance

The original application was created by [GitSquared](https://github.com/GitSquared) and released under
GPLv3. The canonical interface source for this port is commit
[`66ba190`](https://github.com/GitSquared/edex-ui/commit/66ba190ee5369523195c4012d0a798fbe4d43391),
immediately after the `v2.2.0` tag. The later
[`v2.2.8`](https://github.com/GitSquared/edex-ui/releases/tag/v2.2.8) release is only a secondary
implementation and asset reference.

See [NOTICE.md](NOTICE.md) for authorship and third-party credits, and
[apps/clone/UPSTREAM_ASSETS.md](apps/clone/UPSTREAM_ASSETS.md) for the file-level copied-asset inventory.

## Project status

Version 0.1 is a Phase 0 feasibility build. It verifies the startup and sound sequence, core
interactions, desktop and mobile viewports, completed deck appearance, and browser error gates. The
terminal and telemetry currently use safe browser simulations.

Authenticated sessions, route crawling, network contract comparison, and real host telemetry remain
future extension points. This project does not claim to be a drop-in replacement for the original
desktop application.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing the source;
the project requires provenance checks and deterministic visual gates in addition to ordinary tests.

## License

SekerEdexWebLab is distributed under the [GNU General Public License v3.0](LICENSE), matching the
original eDEX-UI project. Copyright in upstream code and assets remains with the respective authors, and
third-party materials retain the notices documented in [NOTICE.md](NOTICE.md).
