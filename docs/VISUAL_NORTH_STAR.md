# Visual North Star: eDEX-UI 2.2 `tron`

## Canonical reference

The primary style reference is [GitSquared/eDEX-UI](https://github.com/GitSquared/edex-ui), using the screenshot described by the project as:

> `neofetch` on eDEX-UI 2.2 with the default `tron` theme and QWERTY keyboard.

Reference locations in the upstream repository:

- `README.md` → `media/screenshot_default.png`
- `src/assets/themes/tron.json`
- `src/assets/css/main_shell.css`
- `src/assets/css/mod_column.css`
- `src/assets/css/keyboard.css`

The original project describes itself as a fullscreen terminal emulator and system monitor with a science-fiction computer interface. It cites TRON: Legacy effects, especially the Board Room sequence, and combines that visual direction with practical daily usability.

## Intended feeling

The interface should feel like an operational command surface:

- fullscreen and immersive;
- dense with live, structured information;
- precise, technical, and calm;
- terminal-first;
- optimized for glanceable status and direct manipulation;
- futuristic while remaining readable during sustained use.

Every decorative element should reinforce information grouping, system state, navigation, or interaction feedback.

## Canonical palette

The initial tokens come directly from the upstream `tron.json` theme:

| Token | Value | Use |
|---|---:|---|
| `tron.signal` | `#AACFD1` | Primary text, borders, telemetry, cursor and active markers |
| `tron.void` | `#000000` | Fullscreen base and globe base |
| `tron.surface` | `#05080D` | Terminal and panel surface |
| `tron.muted` | `#262828` | Secondary structures and inactive detail |
| `tron.selection` | `rgba(170, 207, 209, 0.30)` | Selection and translucent emphasis |
| `tron.border` | `rgba(170, 207, 209, 0.50)` | Default panel and divider stroke |

Color usage is intentionally restrained. The blue-grey signal color carries text, geometry, charts, controls, and active feedback over near-black surfaces. Additional semantic colors require a concrete system state such as warning, failure, or success.

## Composition

The canonical desktop composition is a three-column command deck with a lower interaction area:

1. a dominant terminal in the center;
2. a narrow telemetry column on the left;
3. a narrow telemetry or network column on the right;
4. a filesystem or contextual information region beneath the terminal;
5. a large QWERTY touch keyboard across the lower portion;
6. persistent frame labels and status indicators around the edges.

Useful upstream proportions:

| Region | Upstream reference |
|---|---:|
| Central terminal width | `65%` |
| Central terminal height | `60.3%` |
| Left telemetry column | `17%` |
| Right telemetry column | `17%` |
| Keyboard width | `55.5vw` |

These values establish the initial desktop ratio. Responsive implementations should preserve the dominance of the terminal, the symmetry of the side telemetry, and the keyboard's role as a major control surface.

## Geometry and component grammar

The interface uses a consistent construction language:

- thin luminous strokes over black surfaces;
- low-opacity borders for resting panels;
- brighter fills and inverted text for active controls;
- angled or skewed terminal tabs;
- clipped, augmented, or instrument-like panel corners;
- dense grid alignment;
- compact labels attached directly to panel frames;
- graphs, rings, bars, maps and numeric telemetry as first-class content;
- repeated line weights and spacing intervals;
- limited depth, with hierarchy created by brightness and structure.

Terminal tabs use a skewed silhouette in the upstream implementation. The active tab fills with the signal color and switches to dark text. Keyboard keys use transparent resting surfaces and fill with the signal color when active.

## Terminal scene

The first canonical screen should reproduce the visual structure of the referenced `neofetch` scene:

- large central terminal;
- visible command prompt and monospaced output;
- a `neofetch`-style system summary with a graphic or system mark;
- terminal tabs across the top edge;
- readable output at fullscreen distance;
- telemetry panels remaining active around the terminal;
- QWERTY keyboard visible in the lower command deck.

The terminal must behave like the primary workspace rather than a decorative code texture.

## Telemetry

Panels should present coherent system information such as:

- CPU and memory activity;
- process or task activity;
- storage and filesystem context;
- upload and download rates;
- connection or network state;
- time, host, session and environment metadata.

Telemetry should use restrained animation, stable scales, short labels and numeric values that remain readable. Fake values used during prototyping must be centralized behind a data adapter so real sources can replace them cleanly.

## Keyboard and interaction

The QWERTY keyboard is part of the reference silhouette and interaction model:

- five compact rows;
- centered key labels;
- wider modifier, Enter and Space keys;
- signal-color fill on press;
- immediate keyboard, mouse and touch feedback;
- clear Shift, Caps Lock and function states;
- geometry aligned with the terminal and lower frame.

Keyboard feedback should remain fast and deterministic. Visual state must follow actual interaction state.

## Motion and effects

The upstream interface uses short staged fades, width reveals, brightness changes and roughly half-second transitions. Our motion language should use:

- staged panel activation;
- rapid key flashes;
- short tab and selection transitions;
- smoothly updating telemetry;
- restrained cursor, scan and connection activity;
- reduced-motion behavior that keeps all information available.

Bloom, glow, scanlines, noise and chromatic effects should remain subtle enough to preserve text contrast and screenshot stability.

## Startup and sound contract

The startup is part of the reference experience and must be verified as product behavior rather than treated as optional decoration. The browser implementation uses a user gesture gate so audio can start reliably, then follows the upstream sequence:

1. stream the original `boot_log.txt` into a fullscreen boot console;
2. play the original `granted.wav` transition cue;
3. reveal the `eDEX-UI` title with fill, frame and glitch phases while `theme.wav` plays;
4. open the terminal with `expand.wav`;
5. reveal the filesystem and QWERTY keyboard with `keyboard.wav`;
6. stagger the side panels with `panels.wav`, then start the globe with `scan.wav`.

The interface must expose sound on/off and replay controls. Keyboard input, terminal output, folders and other actions use the corresponding upstream cues. Verification must observe the boot phases and sound events, confirm the audio files load, and capture the gate, boot log, title, reveal and completed deck.

## Original asset policy

When the exact screenshot-era source or the verified later eDEX-UI source contains the required asset, use that asset directly and retain its provenance. This applies to WAV cues, boot log text, filesystem SVG paths, the ENCOM globe implementation and its grid data. Do not replace an available upstream asset with a hand drawn approximation.

Custom assets are allowed only when the product needs an element that has no upstream equivalent. They must follow the same palette and geometry and must not be presented as source accurate.

## Fidelity method

This project has source access, so the canonical workflow is source-driven rather than screenshot-only:

- read commit `66ba190` (the exact screenshot source, with v2.2.0 application code) before changing a visual region;
- consult v2.2.8 only for later fixes or assets and verify that target-facing behavior is unchanged;
- port the original hierarchy and measurements, then adapt only unavailable Electron or host APIs;
- freeze runtime values needed to reproduce the canonical screenshot;
- compare the whole screen and the system, terminal, network, filesystem and keyboard regions independently;
- inspect a side-by-side or signal overlay after every material change;
- retain a change only when behavior remains correct and the qualitative result improves.

The screenshot remains binding for the exact captured state. It resolves details that source alone cannot determine, including random memory ordering, live network traces, connection pins, globe rotation, current time and filesystem contents.

## Responsive behavior

Desktop fullscreen is the canonical presentation. Every non-mobile desktop viewport preserves the complete 1920×1080
composition and scales it uniformly into a centered 16:9 stage. Letterboxing is expected when the viewport aspect ratio
differs from 16:9; desktop aspect ratio alone must never hide, reorder, stretch or resize individual regions. Supported
desktop viewports receive reference screenshots and geometry checks that verify the same normalized system, terminal,
network, filesystem and keyboard bounds.

The mobile fallback is a dedicated two-surface workbench rather than a scaled desktop deck. Portrait phones and
coarse-pointer landscape devices retain terminal and filesystem views, session tabs, sound, reboot, terminal history
and native-keyboard input; desktop telemetry and the on-screen QWERTY keyboard are removed from that constrained
surface. The two mobile surfaces reuse the desktop filesystem controller and current working directory, and the file
surface keeps direct parent, home, disk and content-opening paths. Mobile acceptance requires safe-area and
dynamic-viewport support, 44px touch targets, an input font that does not trigger iOS focus zoom, command submission
through a touch context, shared terminal/filesystem navigation, and output without horizontal clipping.

## Acceptance criteria

A screen satisfies this visual direction when:

- its first impression is a fullscreen TRON-inspired operational terminal;
- the `#AACFD1` signal system and near-black surfaces dominate the palette;
- the terminal is the primary visual and functional region;
- side telemetry and the lower keyboard form a coherent command deck;
- panel borders, spacing, tabs and key states follow one geometric system;
- live data and interaction feedback remain legible;
- the full boot, title, reveal and sound sequence is present and replayable;
- upstream icons, sounds and globe assets are used where available;
- automated screenshots pass the scenario-specific visual threshold;
- a qualitative side by side review reaches at least 90/100 and records remaining differences;
- the browser console and page error gates remain clean.

## Scope relationship

This reference governs visual language, composition, density, interaction feedback and motion. Product features and data sources are specified separately in scenario contracts and future product requirements. The browser implementation should preserve the upstream structure through maintainable modules and shared tokens, with browser adapters at Electron and host-data boundaries.

## Source status

The upstream eDEX-UI repository is archived and read-only. It is retained here as a stable reference for the eDEX-UI 2.2 visual language and component behavior.
