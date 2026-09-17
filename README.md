# SekerEdexWebLab

An evidence driven loop for observing a target web page, comparing a replica, and optionally asking Codex for a bounded repair.

## Visual target

The planned replica experience follows the visual language of [eDEX-UI 2.2](https://github.com/GitSquared/edex-ui) with its default `tron` theme, the `neofetch` terminal scene, and the QWERTY on-screen keyboard. See `docs/VISUAL_NORTH_STAR.md` for the palette, layout, typography, motion, component grammar, and visual acceptance rules.

The replica is built from the frozen eDEX-UI v2.2.8 source. Its renderer DOM, CSS, fonts, icons, globe, boot log, sounds and timing are ported first; browser adapters replace Electron and host APIs; screenshots then verify the exact runtime state. This source-driven workflow is faster and more reliable than reconstructing source-available components from pixels alone. The module-by-module lookup table is in `docs/SOURCE_PORT_MAP.md`.

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
npm run assets:verify
npm run verify
```

The demo starts a local target and replica, captures both with Chromium, and writes a passing report under `artifacts/runs/`.

The product MVP lives in `apps/clone`. Start it with `npm run app:dev`, open the printed URL, leave sound enabled and click **Initialize system**. The startup streams the original boot log, plays the upstream eDEX sound cues at the source mixing levels, displays the title sequence, expands the empty terminal, shows the `Welcome back` greeting, unfolds the keyboard rows, initializes the terminal and filesystem, then reveals the source module sequence. Use **REBOOT** to replay it and **SOUND ON/OFF** to control audio.

`npm run upstream:sync` checks out the exact eDEX-UI `v2.2.8` commit into `.cache/upstream/edex-ui-v2.2.8` and verifies the commit plus the renderer files used by the port. Run it once on a new machine and whenever the cache is removed. Visual repair reads this frozen source before consulting the screenshot.

Run `npm run app:verify` to exercise startup phases, boot sound order and source volumes, audio asset loading, the six left and three right boot modules, replay and skip controls, sound mute, terminal input, the on-screen keyboard, terminal tabs, required layout regions, responsive behavior and browser error gates. It also captures every important startup state and records a directional pixel comparison against the frozen eDEX-UI 2.2 screenshot.

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

`replicate:repair` owns the Vite server, captures the current replica, compares it with the frozen reference, and asks Codex for up to three bounded repairs against its stricter 4% improvement target. Each repair prompt requires Codex to inspect the original v2.2.8 implementation first. The controller limits edits to `apps/clone`, runs type checking, unit tests and the production build after every change, then captures again. It leaves accepted source changes in the working tree for review. Run `npm run verify` after the loop for the slower startup, audio, interaction and 7% regression gate.

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

## Current boundary

Version 0.1 verifies the startup and sound sequence, core interactions, two responsive viewports, completed deck appearance and browser errors. The terminal and telemetry are safe browser simulations. Authenticated sessions, route crawling, network contract comparison and real host telemetry remain extension points.
