# Architecture

## System boundary

The system treats live target sites and frozen reference screenshots as external evidence. A scenario defines exactly one target source, the replica URL, viewport, readiness condition, visual threshold, retry limit, and paths that a repair agent may edit.

## Components

### Configuration

Loads and validates the run contract before any browser or agent process starts. Invalid or unsafe contracts fail early.

### Browser collector

Captures viewport-bounded screenshots and browser diagnostics for live targets and replicas. Diagnostics retain the browser version and normalized locale, timezone, motion, color and scale settings needed to reproduce a capture. Frozen screenshot targets bypass browser collection and are copied into the immutable run evidence. The collector does not compare images or edit code.

### Visual comparator

Consumes two captured PNG files and writes a diff image plus numeric metrics. It has no browser or agent dependency.

The optional hotspot diagnostic composites both images over the product's black background and ranks fixed-size cells by visible difference. It is used to prioritize repairs when a reference PNG contains transparency. It is explicitly diagnostic-only: the judge continues to use the untouched PNGs and frozen acceptance threshold.

Application verification records two complementary comparisons. The frozen formal metric keeps the scenario gate stable with Pixelmatch's antialias suppression. A diagnostic perceptual metric uses a stricter color threshold and includes antialiased pixels, so thin glyphs, one-pixel frames, ENCOM satellites and other details that remain obvious to a person cannot disappear from repair prioritization. A candidate that only improves the formal metric while regressing the perceptual metric requires direct visual evidence before acceptance.

The autonomous eDEX repair command loads its perceptual comparison profile from the same frozen scenario contract. A candidate must improve the whole-screen score without exceeding the declared regional regression allowance. The frozen regression scenario keeps its formal profile, while application verification enforces both formal and perceptual whole-screen and regional budgets.

### Judge

Applies the frozen threshold to comparator metrics and browser diagnostics. It returns a typed verdict.

### Codex adapter

Receives a bounded repair request and invokes `codex exec` with a JSON output schema. When the contract declares source evidence, the controller verifies the checkout revision and required paths before the request identifies the canonical repository, source port guide and module entry points. The repair prompt orders source inspection before screenshot calibration. Codex runs with workspace-write roots derived from `allowedPaths`; source checkouts, controller code and run evidence remain read-only to the repair process.

### Orchestrator

Runs a finite state machine:

```text
capture -> compare -> judge -> passed
                         |
                         +-> checkpoint -> repair -> validate -> candidate capture
                                                          |              |
                                                   improved: keep   flat/worse: rollback
                         |
                         +-> failed/blocked
```

The orchestrator owns attempt limits and artifact directories. Components communicate through typed values and files.

Every live repair is transactional over the contract's allowed paths. The controller requires a clean Git worktree, restricts Codex's writable sandbox roots, and restores the complete Git worktree plus newly created untracked files when a repair is rejected or fails. It captures and judges the candidate immediately after validation, and accepts it only when browser diagnostics remain clean, dimensions match, the visual difference ratio strictly decreases, and no named region exceeds its regression allowance. Equal, worse, locally regressive, malformed or failed candidates restore the baseline before another attempt. Candidate screenshots, metrics, verdicts and the accept/reject decision remain in the run artifacts.

Before each repair, the orchestrator hashes every existing run artifact. It verifies the complete file manifest before writing trusted repair output or capturing a candidate, so a repair cannot rewrite earlier evidence or add forged evidence files. Contract validation rejects repair roots that overlap controller, schema, contract, reference or artifact paths.

Rejected candidate summaries, paths and measured score changes are included in later repair requests as regression counterexamples. This prevents the agent from repeating a plausible source change that deterministic capture has already disproved.

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
    candidate/
      replica.png
      diff.png
      metrics.json
      browser.json
      verdict.json
      decision.json
  final-report.json
```

## Trust boundaries

- Target pages are untrusted browser content.
- Scenario configuration is trusted project configuration and is schema validated.
- Codex output is untrusted until schema validation and deterministic verification pass.
- The frozen contract and target screenshot are hash checked after every repair.
- Shell arguments are passed through process argument arrays, not shell interpolation.
- Live repair is opt in and operates inside a Git repository.
- Automated repair can write application source and repository Markdown content only. Canonical evidence, upstream assets, hash manifests, licenses, gate configuration, judges and orchestration remain outside its writable roots.
- `gate:verify` binds the reference screenshot, source revision, asset manifest, visual ceilings and repair roots to the reviewed canonical policy. CODEOWNERS and protected branch settings provide the repository-level approval boundary for policy changes.

## Extension seams

Future collectors and judges implement stable ports:

- interaction trace collector;
- accessibility tree comparator;
- network contract comparator;
- responsive layout judge;
- authenticated storage state provider;
- target crawler and state graph builder.

## Product implementation

`apps/clone` is the first product built through this workflow. `CommandDeckController` receives typed intents from physical keyboard, on-screen keyboard, pointer and filesystem adapters and exposes immutable snapshots to the DOM presentation layer. It also owns the active document selection; the Markdown reader and disposable image viewer consume typed file previews without introducing a second navigation state. Its UI modules own terminal commands, telemetry adapters, the startup state machine, the sound deck and the upstream asset adapter. A shared disposable registry owns listeners and renderer lifecycles; the scheduler owns continuing sampling and frame callbacks.

Runtime blog documents and media are repository files collected into a validated typed manifest by the Vite content plugin. YAML parsing, schema validation, path-collision checks and local-reference validation happen at the build boundary, so the browser receives content data and hashed media URLs without shipping the frontmatter parser. Discovery rejects symbolic links and non-regular filesystem entries; Vite 7 create, update and delete events invalidate the virtual manifest. A typed, deeply immutable content tree preserves the repository hierarchy and is mounted separately from the canonical eDEX snapshot. The virtual filesystem only projects this tree into the sandbox and maps typed document and media nodes to project-owned `markdown` and `image` icon semantics; the presentation layer never guesses content type from a filename extension. Filesystem clicks, terminal navigation, relative Markdown links and static-hosting-safe hash locations converge on one controller state and history policy; non-content directories are carried in typed browser history state, while article-local anchors are resolved inside the reader without competing for the global hash route. Markdown bodies remain synchronous so the reader and terminal `cat` command observe the same file; future lazy loading must be introduced behind an asynchronous content-repository port for both consumers. Documents and media mount as interchangeable views inside one `FullscreenContentOverlay`. That adapter alone owns viewport coverage, command-deck isolation, the shared close control, Escape handling and teardown; the document and media renderers own only type-specific presentation and navigation. Media sequence, zoom, dismissal and browser history stay inside the same typed content route. Media reveal effects live behind a disposable renderer adapter: VFX-JS owns WebGL and codec resources, the shared runtime scheduler owns frame cadence and visibility pausing, and the viewer owns only reveal state and a tile-based fallback.

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

Source evidence is grouped by visible module as well as shared shell files. The repair adapter uses the current diff to select the highest-impact module and requires its complete upstream class, stylesheet and asset entry set to be read before editing. This keeps source discovery deterministic and prevents a repair from falling back to screenshot inference because a relevant upstream file was omitted from the prompt.

The scenario also declares canonical comparison regions. Every repair attempt writes a separate diff and metrics file for each region, sorts those regions by mismatched pixel count, and supplies the evidence to the repair adapter. The agent therefore chooses between system, terminal, network, filesystem and keyboard work using measured impact rather than scanning the full-screen diff by eye.

Candidate recapture repeats the same regional comparisons and stores each region's pixel delta in the transactional decision. Small whole-screen changes can therefore be attributed to a concrete module without being confused with run-to-run animation variance elsewhere on the screen.

`docs/SOURCE_PORT_MAP.md` records the upstream class, stylesheet and asset used by each local browser module. Keep that map current when a module boundary or source dependency changes.

`scripts/verify-app.ts` performs startup, sound, browser interaction, responsive and error checks, captures each important startup state, and records both formal and antialias-aware perceptual comparisons. `scripts/verify-replication.ts` runs the frozen eDEX reference through the same orchestrator and visual judge used for other scenarios. Numeric pixel comparison is supporting evidence because large shared dark regions can hide obvious component differences; a separate qualitative visual verdict is required.
