# North Star

## Purpose

SekerEdexWebLab turns a target web experience into a reviewable sequence of evidence, specifications, implementation attempts, counterexamples, and verified results.

## Product direction

The product uses [GitSquared/eDEX-UI](https://github.com/GitSquared/edex-ui), specifically eDEX-UI 2.2 with the default `tron` theme and QWERTY on-screen keyboard, as its primary visual reference. The intended experience is a fullscreen, functional science-fiction command interface inspired by TRON: Legacy: terminal-first, telemetry-rich, dark, precise, and suitable for sustained real use.

The binding visual contract is documented in `docs/VISUAL_NORTH_STAR.md`.

## Success statement

Given frozen target evidence, a replica URL, and a bounded scenario, the system can:

1. capture a live target or freeze a reference screenshot, then capture the replica under declared browser conditions;
2. compare them using deterministic rules;
3. produce a durable, machine readable report;
4. ask Codex for a bounded repair when verification fails;
5. repeat within configured limits;
6. finish as `passed`, `failed`, or `blocked` with evidence.

## Invariants

- Evidence is immutable within a run.
- Acceptance thresholds are fixed before a repair attempt starts.
- The judge does not accept natural language claims as proof.
- Pixel similarity alone cannot approve an experience; startup, sound, interaction, structure and qualitative visual evidence are independent gates.
- Existing upstream assets are reused directly before creating substitutes.
- Every repair is bounded by allowed paths, attempts, commands, and time.
- A passing run is reproducible from committed configuration.
- Human review remains possible because inputs, changes, commands, and results are retained.

## Reconstruction order

For a source-available target such as eDEX-UI, implementation evidence has a strict order:

1. frozen upstream source at the declared version supplies DOM structure, CSS geometry, assets, text, animation timing and behavior;
2. a small browser adapter replaces Electron and Node APIs while preserving the upstream presentation contract;
3. the canonical screenshot fixes runtime-dependent state such as terminal output, telemetry samples, network connections and camera position;
4. deterministic captures, region diffs and qualitative review decide whether the browser result matches.

Screenshot-only inference is reserved for information absent from the source or produced at runtime. A repair must not redraw an upstream asset or invent a parallel component when the frozen source already contains the required implementation.

## Initial scope

The first release supports deterministic visual comparison from a live URL or frozen screenshot, one or more viewports, structured run reports, and an opt in Codex repair adapter. The first product implementation is a browser-based eDEX command deck using the eDEX-UI 2.2 `tron` visual language, source startup sequence, original audio cues, SVG icons and ENCOM globe.

Interaction graphs, network contract comparison, authenticated sessions, and automatic site crawling are later capabilities built on the same contracts.
