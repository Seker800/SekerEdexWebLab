# eDEX-UI source port map

The visual source of truth is GitSquared/eDEX-UI commit `66ba190ee5369523195c4012d0a798fbe4d43391`, whose `media/screenshot_default.png` is byte-for-byte identical to the frozen target. Its parent is the `v2.2.0` tag at commit `ba987432c11fcd833bc7d79511bdfdb58273140b`; the screenshot commit changes the media evidence, so its application code is the exact v2.2.0 code that produced the target. Use this checkout before changing a visible module. Port its implementation first, adapt its Electron 4 or host boundary second, and use the screenshot for runtime values and acceptance.

Run `npm run upstream:sync` to create the exact visual checkout at `.cache/upstream/edex-ui-visual-66ba190` and the later v2.2.8 implementation reference at `.cache/upstream/edex-ui-v2.2.8`. The command verifies both commits and proves that the upstream screenshot and frozen target share SHA-256 `c72ddbab1fc89c9ceb35ab18e864084f603861ba629ec72bd072ea9015173ef4`. Agents must read the visual checkout first. Use v2.2.8 only for later fixes or assets after confirming that the target-facing behavior did not change.

`specs/edex-command-deck.contract.json` exposes the exact screenshot checkout, commit, guide and entry files as machine-readable `sourceEvidence`. `npm run replicate:repair` passes that evidence to every Codex repair attempt before the screenshot and diff paths. `references/edex-ui-v2.2.8/provenance.json` records why the legacy reference directory name differs from the recovered source version.

Read `docs/VISUAL_REGRESSION_CORPUS.md` before editing. It records source-plausible changes that deterministic Chromium capture has already rejected, including exact legacy xterm rendering and literal Electron-era CSS values that score worse in the browser port.

| Feature | Upstream source | Browser port or evidence |
|---|---|---|
| Startup log and timing | `src/_renderer.js`, `src/assets/misc/boot_log.txt`, `main_shell.css` | `apps/clone/src/boot-sequence.ts`, `apps/clone/public/boot_log.txt`; preserves the kernel-line concatenation, canonical `squared` greeting and emphasis, greeting fade, keyboard hold and 500 ms panel cadence |
| Startup title and glitch | `src/assets/css/boot_screen.css`, upstream medium-font registration | `apps/clone/src/styles.css` boot selectors and source-equivalent boot font face; canonical outline/framed bounds are gated by `verify-app.ts` |
| Startup audio | `src/classes/audiofx.class.js`, `locationGlobe.class.js`, `src/assets/audio/*.wav` | `apps/clone/src/audio-deck.ts`, `apps/clone/public/audio`; the globe scan cue follows the fifth panel cue, matching the source globe's 2 s construction delay plus 500 ms `init` callback |
| Theme colors and fonts | `src/assets/themes/tron.json`, renderer theme loader, `src/assets/fonts` | CSS tokens and `apps/clone/public/fonts` |
| Desktop geometry | `src/assets/css/main.css`, `main_shell.css`, module CSS | `apps/clone/src/styles.css` and canonical region bounds in `scripts/verify-app.ts`; the global ruler uses the source `1.02vh` title metric and keeps browser-only controls outside its flex flow |
| Clock and system metadata | `clock.class.js`, `sysinfo.class.js`, `mod_clock.css`, `mod_sysinfo.css` | system markup in `main.ts`; frozen date/time in `canonical-runtime.ts` and `main.ts`; source-effective clock and hardware value baselines |
| CPU, RAM and process list | corresponding classes plus `mod_sysinfo.css`, `mod_cpuinfo.css`, `mod_ramwatcher.css`, `mod_toplist.css` | semantic system-information headings, source label/value contrast, telemetry adapter, canonical traces, 440-point RAM map, independently measured heading/core/summary baselines, and source-effective process table type metrics |
| Terminal and neofetch scene | terminal class, `main_shell.css`, canonical capture | `terminal-model.ts` owns deterministic command output, while `terminal-session.ts` owns the five independent browser sessions, history, completion, current directory and filesystem-command boundary; terminal markup and styles preserve the captured shell output, both Powerline prompt segments, xterm-equivalent status/footer metrics, the exact palette raster and output baseline |
| Network globe | `locationGlobe.class.js`, `encom-globe.js`, `grid.json`, `mod_globe.css` | `edex-assets.ts`, the exact screenshot-era ENCOM bundle and grid, source-order live constellation creation, source 2 s construction and 4 s endpoint update timing, canonical camera, seed, four independently calibrated peer pins, six-satellite static snapshot and frozen shared `TextureAnimator` phase, plus source-effective heading, status-value, coordinate typography and cold-start canvas placement; diagnostic layer isolation uses the same ENCOM canvas |
| Traffic chart | `conninfo.class.js`, `mod_conninfo.css`, canonical capture | telemetry adapter, canonical network traces, independently anchored source headings/totals and source-effective chart geometry |
| Filesystem | `filesystem.class.js`, `filesystem.css`, `main.css` title/scrollbar rules, `file-icons.json` | `filesystem-model.ts` retains the canonical screenshot snapshot; `browser-filesystem.ts` provides the bounded navigable tree consumed by `terminal-session.ts`; filesystem markup, source SVG subset, source categories, title underline, item geometry, Electron 4 effective label width, scroll viewport clipping and scrollbar compatibility layer remain shared |
| Keyboard | `keyboard.class.js`, `keyboard.css`, `src/assets/kb_layouts/en-US.json` | frozen `public/keyboard/en-US.json`, typed `keyboard-layout.ts` adapter, keyboard markup and `keyboard-feedback.ts`; all 65 source keys, control sequences and modifier commands, original arrow SVG paths, physical keydown/keyup illumination, source release blink, two-piece Enter overlap, and independently verified special-key optical placement for current Chromium |

## Evidence that belongs to the screenshot

The screenshot supplies values the repository cannot reproduce by itself: clock time, live telemetry samples, process rows, terminal contents, directory contents, active network peers, randomized memory ordering, globe rotation, constellation state, and graph histories. Store these values in `canonical-runtime.ts` or a domain adapter. Do not encode them as decorative CSS.

## Verification

- `npm run assets:verify` protects the frozen upstream files with SHA-256 hashes.
- `npm run app:verify` checks source structures, startup states, sound events, interactions, region bounds and image differences.
- `npm run replicate:verify` runs the bounded capture and comparison state machine.
- `npm run verify` executes the complete local gate.
