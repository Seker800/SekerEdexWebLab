# Architecture

## System boundary

The system treats live target sites and frozen reference screenshots as external evidence. A scenario defines exactly one target source, the replica URL, viewport, readiness condition, visual threshold, retry limit, and paths that a repair agent may edit.

## Components

### Configuration

Loads and validates the run contract before any browser or agent process starts. Invalid or unsafe contracts fail early.

### Browser collector

Captures normalized screenshots and browser diagnostics for live targets and replicas. Frozen screenshot targets bypass browser collection and are copied into the immutable run evidence. The collector does not compare images or edit code.

### Visual comparator

Consumes two captured PNG files and writes a diff image plus numeric metrics. It has no browser or agent dependency.

The optional hotspot diagnostic composites both images over the product's black background and ranks fixed-size cells by visible difference. It is used to prioritize repairs when a reference PNG contains transparency. It is explicitly diagnostic-only: the judge continues to use the untouched PNGs and frozen acceptance threshold.

### Judge

Applies the frozen threshold to comparator metrics and browser diagnostics. It returns a typed verdict.

### Codex adapter

Receives a bounded repair request and invokes `codex exec` with a JSON output schema. When the contract declares source evidence, the request identifies the canonical repository, exact revision, verified local checkout, source port guide and module entry points. The repair prompt orders source inspection before screenshot calibration. The adapter cannot change the frozen run contract or target evidence.

### Orchestrator

Runs a finite state machine:

```text
capture -> compare -> judge -> passed
                         |
                         +-> repair -> validate -> capture
                         |
                         +-> failed/blocked
```

The orchestrator owns attempt limits and artifact directories. Components communicate through typed values and files.

## Dependency direction

```text
cli -> orchestrator -> ports
                    -> domain

adapters/browser -> ports
adapters/codex   -> ports
comparison       -> domain
judge            -> domain
```

Domain types do not import Playwright, filesystem, child processes, or image libraries.

## Artifact layout

```text
artifacts/runs/<run-id>/
  contract.json
  target.png
  target-browser.json
  attempts/<n>/
    replica.png
    diff.png
    metrics.json
    browser.json
    verdict.json
    repair.json
  final-report.json
```

## Trust boundaries

- Target pages are untrusted browser content.
- Scenario configuration is trusted project configuration and is schema validated.
- Codex output is untrusted until schema validation and deterministic verification pass.
- The frozen contract and target screenshot are hash checked after every repair.
- Shell arguments are passed through process argument arrays, not shell interpolation.
- Live repair is opt in and operates inside a Git repository.

## Extension seams

Future collectors and judges implement stable ports:

- interaction trace collector;
- accessibility tree comparator;
- network contract comparator;
- responsive layout judge;
- authenticated storage state provider;
- target crawler and state graph builder.

## Product implementation

`apps/clone` is the first product built through this workflow. Its UI modules own terminal commands, telemetry adapters, the startup state machine, the sound deck and the upstream asset adapter. The presentation layer consumes those modules rather than embedding behavior in CSS selectors.

The startup state machine emits observable `edex:boot-phase` events. The sound deck emits `edex:sound` events before playback. These events let browser verification prove that the experiential sequence occurred without coupling the verifier to timing implementation details.

Original eDEX assets live under `apps/clone/public` and are loaded through `edex-assets.ts` and `audio-deck.ts`. Their provenance is checked against the exact screenshot-era checkout first and the later v2.2.8 checkout when an asset is unchanged or unavailable in the earlier source. The implementation must prefer these source assets over visually similar replacements.

### Source-driven browser port

The eDEX replica is a browser port of the application code at commit `66ba190`, the repository revision containing the exact frozen screenshot and the direct child of v2.2.0. Upstream module DOM, CSS measurements, bundled assets, labels and sequencing at that revision are the primary specification. The v2.2.8 checkout is a secondary implementation reference. Browser-facing adapters supply deterministic terminal data, telemetry, filesystem entries, geolocation and audio activation where the original calls Electron or Node APIs.

The adaptation boundary is intentionally narrow:

```text
frozen eDEX source
  -> source DOM / CSS / assets / timing
  -> browser adapters for Electron and host data
  -> deterministic runtime snapshot
  -> regional screenshot and behavior gates
```

Visual modules should be ported one at a time and verified against their canonical crop before the next module changes. Screenshot tracing may tune runtime state, but it must not replace source structure that can be read directly. Shared corrections belong in tokens, upstream adapters or module styles rather than coordinate exceptions spread across the application.

The scenario contract carries this provenance in `sourceEvidence`. Because it is frozen into every run artifact, each autonomous repair attempt receives the same source revision and entry points. `npm run replicate:repair` starts the replica server and executes this bounded source-first loop without requiring a separately managed development server.

`docs/SOURCE_PORT_MAP.md` records the upstream class, stylesheet and asset used by each local browser module. Keep that map current when a module boundary or source dependency changes.

`scripts/verify-app.ts` performs startup, sound, browser interaction, responsive and error checks and captures each important startup state. `scripts/verify-replication.ts` runs the frozen eDEX reference through the same orchestrator and visual judge used for other scenarios. Numeric pixel comparison is supporting evidence because large shared dark regions can hide obvious component differences; a separate qualitative visual verdict is required.
