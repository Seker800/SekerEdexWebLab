# SekerEdexWebLab

An evidence driven loop for observing a target web page, comparing a replica, and optionally asking Codex for a bounded repair.

这是一个非官方、开源的 eDEX-UI Web 复刻实验。当前阶段以 eDEX-UI 2.2 默认
`tron` 主题、`neofetch` 场景和 QWERTY 屏幕键盘为唯一视觉基准，先完成可运行的高保真
控制台，再把文章、摄影和设计作品接入同一个工作台。

## Visual target

The planned replica experience follows the visual language of [eDEX-UI 2.2](https://github.com/GitSquared/edex-ui) with its default `tron` theme, the `neofetch` terminal scene, and the QWERTY on-screen keyboard. See `docs/VISUAL_NORTH_STAR.md` for the palette, layout, typography, motion, component grammar, and visual acceptance rules.

The replica is built first from the exact eDEX-UI source associated with the target screenshot. Git history proves the frozen image is `media/screenshot_default.png` from commit `66ba190`, immediately after the v2.2.0 tag; its SHA-256 matches byte for byte. The later v2.2.8 source remains a secondary reference for fixes and unchanged assets. Renderer DOM, CSS, fonts, icons, globe, boot log, sounds and timing are ported before browser adapters replace Electron and host APIs. The module-by-module lookup table is in `docs/SOURCE_PORT_MAP.md`.

## What works now

- schema validated scenario contracts;
- deterministic Chromium capture;
- immutable target capture per run;
- pixel comparison and diff images;
- console and page error gates;
- finite retry state machine;
- source-aware repair contracts that send a pinned upstream checkout and module entry points to Codex before screenshot evidence;
- opt in `codex exec` repair with structured output;
- clean Git and allowed path guards for live repair;
- controller executed validation commands after every repair;
- SHA-256 protection for the frozen contract and target screenshot;
- durable JSON reports and screenshots.

## Setup

```bash
npm install
npm run install:browsers
npm run upstream:sync
npm run check
npm test
npm run demo
npm run app:verify
npm run app:hotspots
npm run assets:verify
npm run verify
```

The demo starts a local target and replica, captures both with Chromium, and writes a passing report under `artifacts/runs/`.

The product MVP lives in `apps/clone`. Start it with `npm run app:dev`, open the printed URL, leave sound enabled and click **Initialize system**. The startup streams the original boot log, plays the upstream eDEX sound cues at the source mixing levels, displays the title sequence, expands the empty terminal, shows the `Welcome back` greeting, unfolds the keyboard rows, initializes the terminal and filesystem, then reveals the source module sequence. Use **REBOOT** to replay it and **SOUND ON/OFF** to control audio.

`npm run upstream:sync` checks out the exact screenshot commit into `.cache/upstream/edex-ui-visual-66ba190`, checks out v2.2.8 into `.cache/upstream/edex-ui-v2.2.8`, verifies both revisions and verifies the target screenshot hash against the upstream media file. Run it once on a new machine and whenever the cache is removed. Visual repair reads the exact screenshot source before consulting the later implementation reference.

Run `npm run app:verify` to exercise startup phases, boot sound order and source volumes, audio asset loading, the six left and three right boot modules, replay and skip controls, sound mute, terminal input, the on-screen keyboard, terminal tabs, required layout regions, responsive behavior and browser error gates. It also captures every important startup state and records a directional pixel comparison against the frozen eDEX-UI 2.2 screenshot.

After `app:verify`, run `npm run app:hotspots` to write `artifacts/app-verification/visible-hotspots.json`. This diagnostic composites both screenshots over black before ranking 64×64 cells, so transparent-black pixels in the upstream PNG do not displace visible component differences. It never changes target evidence, thresholds or the formal verdict.

Run `npm run assets:verify` to verify the SHA-256 manifest for the original audio, fonts, boot log, ENCOM globe, grid data and filesystem icon bundle.

Run `npm run verify` for the complete local gate: upstream asset integrity, type checking, unit tests, production build, boot and interaction checks, regional visual comparison, and the bounded replication workflow.

Run the full deterministic replication state machine with:

```bash
npm run replicate:verify
```

This starts the app, freezes the source screenshot into a run, captures the implementation at 1934×1094, applies the 7% regression threshold and browser error gates, and writes a complete report under `artifacts/runs/`.

## Run the source-first automatic repair loop

The eDEX contract includes the pinned upstream repository, exact commit, local checkout, source port guide and renderer entry points. Initialize the source and create a clean Git baseline, then run:

```bash
npm run upstream:sync
npm run replicate:repair
```

`replicate:repair` owns the Vite server, captures the current replica, compares it with the frozen reference, and asks Codex for up to three bounded repairs against its stricter 4% improvement target. Each repair prompt requires Codex to inspect the exact screenshot-era implementation first. Before each repair, the controller snapshots `apps/clone`; it then runs type checking, unit tests and the production build, captures the candidate, and keeps the change only when browser diagnostics are clean, dimensions still match, and the measured visual difference strictly decreases. Rejected candidates are restored automatically. Accepted source changes remain in the working tree for review. Run `npm run verify` after the loop for the slower startup, audio, interaction and 7% regression gate.

## Run a scenario

Create a contract based on `examples/demo.contract.json`, start the replica application, then run:

```bash
npm run run -- --config ./my-scenario.contract.json
```

The command returns:

- exit code `0` for `passed`;
- exit code `1` for deterministic verification failure;
- exit code `2` for a blocked run or invalid setup.

## Enable bounded Codex repair

Live repair requires a clean Git working tree and at least one `allowedPaths` entry:

```bash
npm run run -- --config ./my-scenario.contract.json --repair
```

The adapter runs `codex exec` without shell interpolation, requests output that conforms to `schemas/codex-repair-result.schema.json`, and checks the resulting Git paths before another verification attempt.

## Scenario contract

```json
{
  "scenarioId": "landing-page",
  "targetUrl": "https://target.example/page",
  "replicaUrl": "http://127.0.0.1:3000/page",
  "viewport": { "width": 1440, "height": 900 },
  "readySelector": "main",
  "maxDifferenceRatio": 0.015,
  "maxAttempts": 4,
  "allowedPaths": ["apps/clone/src"],
  "sourceEvidence": {
    "repositoryUrl": "https://github.com/example/reference-app.git",
    "revision": "0123456789abcdef",
    "localPath": ".cache/upstream/reference-app",
    "guidePath": "docs/SOURCE_PORT_MAP.md",
    "entryPaths": ["src/app.ts", "src/app.css"]
  },
  "validationCommands": [["npm", "run", "check"], ["npm", "test"]]
}
```

Read `NORTH_STAR.md` and `ARCHITECTURE.md` before extending the system.

原有产品与维护文档继续保留在 `docs/architecture.md`、`docs/visual-parity.md`、
`docs/technical-route.md` 和 `docs/maintainer-guide.md`。第三方源码和素材的固定版本、文件级
来源与许可证记录在 `THIRD_PARTY_NOTICES.md` 及资产清单中。

## Current boundary

Version 0.1 verifies the startup and sound sequence, core interactions, two responsive viewports, completed deck appearance and browser errors. The terminal and telemetry are safe browser simulations. Authenticated sessions, route crawling, network contract comparison and real host telemetry remain extension points.
