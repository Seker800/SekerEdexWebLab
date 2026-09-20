import "./styles.css";
import { AudioDeck } from "./audio-deck.js";
import { completeBootImmediately, runBootSequence, type BootElements } from "./boot-sequence.js";
import { canonicalCpuTraces, canonicalEdexVersion, canonicalGlobeConstellation, canonicalMemoryPointStates, canonicalNetworkConnectionLocations, canonicalNetworkTraces, canonicalSatelliteAnimationAdvanceMs, type MemoryPointState } from "./canonical-runtime.js";
import { initializeEdexGlobe, loadEdexIcons, renderFileIcon, type EdexGlobeHandle, type EdexGlobeLayers } from "./edex-assets.js";
import { canonicalFileEntries } from "./filesystem-model.js";
import { bindPhysicalKeyboardFeedback, bindPointerKeyboardFeedback, bindPointerKeyRepeat, keyboardKeysForEvent } from "./keyboard-feedback.js";
import { loadKeyboardLayout, resolveKeyboardCommand } from "./keyboard-layout.js";
import { CommandDeckController, type TerminalFeedback } from "./command-deck-controller.js";
import { neofetchText } from "./terminal-model.js";
import { createTelemetrySnapshot, sparklinePoints } from "./telemetry.js";
import { documentVisibilitySource, RuntimeScheduler } from "./runtime-scheduler.js";
import { DisposableRegistry } from "./disposable-registry.js";
import { createSandboxFilesystem } from "./browser-filesystem.js";
import { ImageViewer } from "./image-viewer.js";
import { FullscreenContentOverlay } from "./fullscreen-content-overlay.js";
import { contentManifest } from "virtual:content-manifest";
import { buildContentTree } from "./content/content-tree.js";
import { contentDirname } from "./content/content-model.js";
import { contentHash, parseContentHash } from "./content/content-location.js";
import { renderContentMarkdown } from "./content/markdown-renderer.js";

const arrowIcons: Record<string, string> = {
  "↑": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-opacity="1" d="m12.00004 7.99999 4.99996 5h-2.99996v4.00001h-4v-4.00001h-3z"/><path stroke-linejoin="round" fill-opacity=".65" d="m4 3h16c1.1046 0 1-.10457 1 1v16c0 1.1046.1046 1-1 1h-16c-1.10457 0-1 .1046-1-1v-16c0-1.10457-.10457-1 1-1zm0 1v16h16v-16z"/></svg>',
  "←": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-opacity="1" d="m7.500015 12.499975 5-4.99996v2.99996h4.00001v4h-4.00001v3z"/><path stroke-linejoin="round" fill-opacity=".65" d="m4 3h16c1.1046 0 1-.10457 1 1v16c0 1.1046.1046 1-1 1h-16c-1.10457 0-1 .1046-1-1v-16c0-1.10457-.10457-1 1-1zm0 1v16h16v-16z"/></svg>',
  "↓": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-opacity="1" d="m12 17-4.99996-5h2.99996v-4.00001h4v4.00001h3z"/><path stroke-linejoin="round" fill-opacity=".65" d="m4 3h16c1.1046 0 1-.10457 1 1v16c0 1.1046.1046 1-1 1h-16c-1.10457 0-1 .1046-1-1v-16c0-1.10457-.10457-1 1-1zm0 1v16h16v-16z"/></svg>',
  "→": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-opacity="1" d="m16.500025 12.500015-5 4.99996v-2.99996h-4.00001v-4h4.00001v-3z"/><path stroke-linejoin="round" fill-opacity=".65" d="m4 3h16c1.1046 0 1-.10457 1 1v16c0 1.1046.1046 1-1 1h-16c-1.10457 0-1 .1046-1-1v-16c0-1.10457-.10457-1 1-1zm0 1v16h16v-16z"/></svg>'
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root is missing");
const lifecycle = new DisposableRegistry();
const searchParams = new URLSearchParams(window.location.search);
const staticMode = searchParams.has("static");
if (staticMode) document.documentElement.dataset.staticMode = "";
const [edexIcons, keyboardRows] = await Promise.all([loadEdexIcons(), loadKeyboardLayout()]);
const keyboardKeys = new Map(keyboardRows.flat().map((key) => [key.key, key]));

app.innerHTML = `
  <section class="boot-overlay" id="boot-overlay" data-phase="gate" aria-label="System startup">
    <div class="boot-gate">
      <p class="boot-gate__eyebrow">eDEX-UI v${canonicalEdexVersion}</p>
      <p class="boot-gate__source">Unofficial browser port · original by <a href="https://github.com/GitSquared/edex-ui" target="_blank" rel="noreferrer">GitSquared</a></p>
      <div class="boot-gate__actions">
        <button type="button" id="initialize-system">Initialize system</button>
        <button type="button" id="gate-sound-toggle">Sound: on</button>
      </div>
    </div>
    <pre class="boot-log" id="boot-log" aria-live="polite"></pre>
    <div class="boot-title" id="boot-title"><h1 data-text="eDEX-UI">eDEX-UI</h1></div>
    <button class="boot-skip" id="boot-skip" type="button" hidden>Skip intro</button>
  </section>
  <div class="canvas-stage">
  <main class="command-deck" id="command-deck" data-boot-phase="gate">
    <div class="global-line global-line--left"><span>PANEL</span><span>SYSTEM</span></div>
    <div class="global-line global-line--center"><span>TERMINAL</span><span class="deck-controls"><button type="button" id="reboot-system">REBOOT</button><button type="button" id="sound-toggle">SOUND ON</button></span><span>MAIN SHELL</span></div>
    <div class="global-line global-line--right"><span>PANEL</span><span>NETWORK</span></div>

    <aside class="panel system-panel" aria-label="System telemetry">
      <section class="clock-block" data-boot-module>
        <time id="deck-clock"><span>2</span><span>0</span><em>:</em><span>2</span><span>7</span><em>:</em><span>4</span><span>6</span></time>
        <div class="clock-meta" data-boot-module>
          <div><h1 id="deck-year">2019</h1><h2 id="deck-date">APR 29</h2></div>
          <div><h1>UPTIME</h1><h2>1:09:51</h2></div>
          <div><h1>TYPE</h1><h2>linux</h2></div>
          <div><h1>POWER</h1><h2>CHARGE</h2></div>
        </div>
      </section>
      <section class="data-block machine-id" data-boot-module>
        <header><span>MANUFACTURER</span><span>MODEL</span><span>CHASSIS</span></header>
        <p><b>ASUSTeK COMPUTER</b><b>G551JK</b><b>Notebook</b></p>
      </section>
      <section class="data-block cpu-block" data-boot-module>
        <header><span>CPU USAGE <i class="telemetry-source" id="telemetry-source">SIMULATED</i></span><small>Intel® Core™ i5-4200H</small></header>
        <div class="cpu-core-row"><div class="cpu-core-label"><b># 1 - 2</b><span id="cpu-a">Avg. 56%</span></div><svg viewBox="0 0 280 64" preserveAspectRatio="none"><polyline id="cpu-line-a-secondary" points="" /><polyline id="cpu-line-a" points="" /></svg></div>
        <div class="cpu-core-row"><div class="cpu-core-label"><b># 3 - 4</b><span id="cpu-b">Avg. 48%</span></div><svg viewBox="0 0 280 64" preserveAspectRatio="none"><polyline id="cpu-line-b-secondary" points="" /><polyline id="cpu-line-b" points="" /></svg></div>
        <div class="quad-metrics"><span>TEMP<b id="temp">62°C</b></span><span>MIN<b>2.94GHz</b></span><span>MAX<b>2.99GHz</b></span><span>TASKS<b id="tasks">257</b></span></div>
      </section>
      <section class="data-block memory-block" data-boot-module>
        <header><span>MEMORY</span><small id="memory-label">USING 62% OF 16 GB</small></header>
        <div class="memory-grid" id="memory-grid" aria-hidden="true"></div>
        <div class="memory-swap"><span>SWAP</span><progress id="memory-meter" max="100" value="1.5"></progress><em>0.2 GiB</em></div>
      </section>
      <section class="data-block process-block" data-boot-module>
        <header><span>TOP PROCESSES</span><small>PID | NAME | CPU | MEM</small></header>
        <ol>
          <li><span>5636 edex-ui</span><b>10.3%</b><em>2%</em></li>
          <li><span>2404 gnome-shell</span><b>5.4%</b><em>4%</em></li>
          <li><span>1137 edex-ui</span><b>4.1%</b><em>1.4%</em></li>
          <li><span>2316 Xorg</span><b>4%</b><em>0.8%</em></li>
          <li><span>567 edex-ui</span><b>2.8%</b><em>1.4%</em></li>
        </ol>
      </section>
    </aside>

    <section class="panel terminal-panel" aria-label="Main terminal">
      <h1 class="terminal-greeting">Welcome back, <em>squared</em></h1>
      <nav class="terminal-tabs" role="tablist" aria-label="Terminal sessions">
        <button class="active" type="button" role="tab" aria-controls="terminal-output"><span>MAIN SHELL</span></button><button type="button" role="tab" aria-controls="terminal-output"><span>EMPTY</span></button><button type="button" role="tab" aria-controls="terminal-output"><span>EMPTY</span></button><button type="button" role="tab" aria-controls="terminal-output"><span>EMPTY</span></button><button type="button" role="tab" aria-controls="terminal-output"><span>EMPTY</span></button>
      </nav>
      <div class="terminal-runtime" id="terminal-runtime">
        <div class="terminal-status"><span>Welcome to eDEX-UI v${canonicalEdexVersion} - Electron v4.1.4</span></div>
        <span class="terminal-times"><span id="terminal-time">SESSION // READY</span><span id="terminal-time-secondary"></span></span>
        <div class="terminal-output" id="terminal-output" role="log" aria-live="polite"></div>
        <form class="terminal-prompt" id="terminal-form">
          <label class="terminal-powerline" for="terminal-input"><span>~/.c/</span><strong>eDEX-UI</strong><span class="terminal-powerline__chevron"> ❯</span></label>
          <span class="terminal-editor">
            <input id="terminal-input" autocomplete="off" spellcheck="false" aria-label="Terminal command" />
            <span class="cursor" aria-hidden="true"></span>
          </span>
        </form>
        <div class="terminal-footer"><span>TYPE <b>HELP</b> FOR COMMANDS</span><span id="latency">381ms</span><span id="terminal-footer-time">lun. 29 avril 2019 20:27:29 CEST</span></div>
      </div>
    </section>

    <aside class="panel network-panel" aria-label="Network telemetry">
      <section class="data-block network-status" data-boot-module>
        <header><span>NETWORK STATUS</span><small>Interface: tun0</small></header>
        <div><span>STATE<b>ONLINE</b></span><span>IPv4<b>194.187.249.35</b></span><span>PING<b id="ping">16ms</b></span></div>
      </section>
      <section class="data-block world-view" data-boot-module>
        <header><span>WORLD VIEW</span><small>GLOBAL NETWORK MAP</small></header>
        <div class="world-coordinates"><span>ENDPOINT LAT/LON</span><small>-42.8987, 1.2674</small></div>
        <div class="globe" id="edex-globe" aria-label="Original eDEX network globe"><span>INITIALIZING GLOBE</span></div>
      </section>
      <section class="data-block traffic-block" data-boot-module>
        <header><span>NETWORK TRAFFIC</span><small>UP / DOWN, MB/S</small></header>
        <div class="traffic-total"><span>TOTAL</span><small id="traffic-label">1.20 UP · 4.80 DOWN</small></div>
        <svg viewBox="0 0 280 197" preserveAspectRatio="none" class="traffic-chart">
          <g class="chart-grid"><path d="M0 7H280M0 38H280M0 69H280M0 101H280M0 131H280M0 162H280M0 196H280M0 0V197M70 0V197M140 0V197M210 0V197M280 0V197" /></g>
          <g><polyline id="net-line-a" points=""/><polyline id="net-line-b" points=""/><polyline id="net-line-c" points=""/><polyline id="net-line-d" points=""/></g>
          <g class="chart-labels"><text x="276" y="13">0.21</text><text x="276" y="98">0.00</text><text x="276" y="112">0.00</text><text x="276" y="193">-0.21</text></g>
        </svg>
      </section>
    </aside>

    <section class="panel filesystem-panel" aria-label="Filesystem">
      <header class="section-label"><span>FILESYSTEM</span><small>/home/squared/.config/eDEX-UI</small></header>
      <div class="file-grid">
        ${canonicalFileEntries.map(({ icon, name, category }) => `<button type="button" data-icon="${icon}" data-category="${category}"><b>${renderFileIcon(edexIcons, icon)}</b><span>${name}</span></button>`).join("")}
      </div>
      <div class="filesystem-source-scrollbar" aria-hidden="true"></div>
      <footer><span>Mount /home/squared used 71%</span><progress class="storage-meter" value="71" max="100"></progress></footer>
    </section>

    <section class="keyboard-panel" aria-label="On-screen QWERTY keyboard">
      ${keyboardRows.map((row, rowIndex) => `<div class="key-row key-row-${rowIndex}">${row.map(({ key, label, shift: shiftedLabel, alt, altShift, fn }) => {
        const specialClass = key === "SPACE" ? " key--space" : key === "ENTER" ? " key--enter-upper" : key === "ENTER_LOWER" ? " key--enter-lower" : "";
        const keyContent = key === "SPACE" ? "" : arrowIcons[key] ?? `<span class="key-alt-shift">${escapeHtml(altShift ?? "")}</span><span class="key-fn">${escapeHtml(fn ?? "")}</span><span class="key-alt">${escapeHtml(alt ?? "")}</span><span class="key-shift">${escapeHtml(shiftedLabel ?? "")}</span><span class="key-main">${escapeHtml(label)}</span>`;
        return `<button type="button" class="key${specialClass}" data-key="${key}"${shiftedLabel ? ` data-shift="${escapeHtml(shiftedLabel)}"` : ""}>${keyContent}</button>`;
      }).join("")}</div>`).join("")}
    </section>
  </main>
  <section class="content-overlay" id="content-overlay" role="dialog" aria-modal="true" aria-label="Content browser" hidden>
    <button class="content-overlay__close" type="button" id="content-overlay-close" aria-label="Close content browser">RETURN TO DECK</button>
    <div class="content-overlay__viewport" id="content-overlay-viewport">
      <article class="content-reader" id="content-reader" data-content-view="document" hidden aria-labelledby="content-reader-title">
        <header>
          <div><small id="content-reader-meta"></small><h1 id="content-reader-title"></h1><p id="content-reader-summary"></p><div id="content-reader-tags"></div></div>
        </header>
        <div class="content-reader__body" id="content-reader-body" tabindex="0" aria-label="Article body"></div>
      </article>
    </div>
  </section>
  </div>
`;

const output = document.querySelector<HTMLDivElement>("#terminal-output")!;
const input = document.querySelector<HTMLInputElement>("#terminal-input")!;
const form = document.querySelector<HTMLFormElement>("#terminal-form")!;
const fileGrid = document.querySelector<HTMLDivElement>(".file-grid")!;
const filesystemTitle = document.querySelector<HTMLElement>(".filesystem-panel .section-label small")!;
const promptPrefix = document.querySelector<HTMLElement>(".terminal-prompt .terminal-powerline > span:first-child")!;
const promptDirectory = document.querySelector<HTMLElement>(".terminal-prompt .terminal-powerline > strong")!;
const terminalTabs = [...document.querySelectorAll<HTMLButtonElement>(".terminal-tabs button")];
const commandDeckElement = document.querySelector<HTMLElement>("#command-deck")!;
const contentOverlayElement = document.querySelector<HTMLElement>("#content-overlay")!;
const contentOverlayViewport = document.querySelector<HTMLElement>("#content-overlay-viewport")!;
const contentOverlayClose = document.querySelector<HTMLButtonElement>("#content-overlay-close")!;
const contentReader = document.querySelector<HTMLElement>("#content-reader")!;
const contentReaderTitle = document.querySelector<HTMLElement>("#content-reader-title")!;
const contentReaderMeta = document.querySelector<HTMLElement>("#content-reader-meta")!;
const contentReaderSummary = document.querySelector<HTMLElement>("#content-reader-summary")!;
const contentReaderTags = document.querySelector<HTMLElement>("#content-reader-tags")!;
const contentReaderBody = document.querySelector<HTMLElement>("#content-reader-body")!;
const audioDeck = new AudioDeck();
lifecycle.add(() => audioDeck.dispose());
const runtimeScheduler = staticMode ? undefined : new RuntimeScheduler(documentVisibilitySource(document));
if (runtimeScheduler) lifecycle.add(() => runtimeScheduler.dispose());
lifecycle.listen<PageTransitionEvent>(window, "pagehide", () => lifecycle.dispose(), { once: true });
const staticGlobeAngle = searchParams.has("globeAngle") ? Number(searchParams.get("globeAngle")) : 6.26;
const staticGlobeSeed = searchParams.has("globeSeed") ? Number(searchParams.get("globeSeed")) : 0x1f87_2855;
const staticGlobeLayerMode = searchParams.get("globeLayers") ?? "all";
const staticGlobeLayers: EdexGlobeLayers = staticMode && staticGlobeLayerMode !== "all" ? {
  satellites: staticGlobeLayerMode === "satellites",
  localEndpoint: staticGlobeLayerMode === "pins" || staticGlobeLayerMode === "local",
  connections: staticGlobeLayerMode === "pins" || staticGlobeLayerMode === "connections"
} : { satellites: true, localEndpoint: true, connections: true };
const globeContainer = document.querySelector<HTMLElement>("#edex-globe")!;
let globeInitialization: Promise<EdexGlobeHandle | null> | undefined;
let globeHandle: EdexGlobeHandle | null = null;
const globeAbortController = new AbortController();
lifecycle.add(() => {
  globeAbortController.abort();
  globeHandle?.dispose();
});
const initializeRuntimeGlobe = (speed = 1): Promise<EdexGlobeHandle | null> => {
  globeInitialization ??= initializeEdexGlobe(globeContainer, {
    animate: true,
    connectionLocations: canonicalNetworkConnectionLocations,
    layers: staticGlobeLayers,
    sourceTimingScale: speed,
    runAnimation: (callback) => runtimeScheduler?.eachFrame(callback) ?? (() => undefined),
    signal: globeAbortController.signal
  }).then((handle) => {
    globeHandle = handle;
    return handle;
  });
  return globeInitialization;
};
if (staticMode) {
  globeHandle = await initializeEdexGlobe(globeContainer, {
    animate: false,
    fixedCameraAngle: staticGlobeAngle,
    fixedRandomSeed: staticGlobeSeed,
    connectionLocations: canonicalNetworkConnectionLocations,
    layers: staticGlobeLayers,
    constellationLocations: canonicalGlobeConstellation,
    fixedSatelliteAnimationAdvanceMs: canonicalSatelliteAnimationAdvanceMs,
    signal: globeAbortController.signal
  });
} else {
  lifecycle.listen<CustomEvent<{ speed?: number }>>(document, "edex:module-runtime-start", (event) => {
    const speed = (event as CustomEvent<{ speed?: number }>).detail.speed ?? 1;
    void initializeRuntimeGlobe(speed).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    });
  });
}
const contentTree = buildContentTree(contentManifest.entries);
const browserFilesystem = createSandboxFilesystem({
  contentEntries: staticMode ? [] : contentManifest.entries,
  startInContent: !staticMode
});
const commandDeck = new CommandDeckController(browserFilesystem);
let lastContentHash = "";
const contentOverlay = new FullscreenContentOverlay(
  contentOverlayElement,
  contentOverlayViewport,
  commandDeckElement,
  contentOverlayClose,
  () => {
    commandDeck.dispatch({ type: "close-content" });
    renderSessionChrome();
    syncLocationToDeck();
    audioDeck.play("denied");
    input.focus();
  }
);
contentOverlay.register("document", contentReader);
lifecycle.add(() => contentOverlay.dispose());
const imageViewer = new ImageViewer(contentOverlay, {
  now: () => performance.now(),
  runAnimation: (callback) => runtimeScheduler?.eachFrame(callback) ?? (() => undefined)
}, {
  onOpen: () => audioDeck.play("expand"),
  onAction: (action) => audioDeck.play(action === "previous" || action === "next" ? "folder" : "stdin"),
  onSelectionChange: (entry, description) => {
    if (entry.contentPath) writeContentLocation(entry.contentPath, "push", description);
  }
});
lifecycle.add(() => imageViewer.dispose());
let pendingImageOpen: (() => void) | undefined;

function renderTerminal(): void {
  output.innerHTML = commandDeck.snapshot().current.entries.map((entry) => {
    const content = renderTerminalText(entry.text).replace(
      "■ ■ ■ ■ ■ ■ ■ ■",
      `<span class="neofetch-swatches" aria-label="terminal color palette">${Array.from({ length: 8 }, () => "<i></i>").join("")}</span>`
    ).replace(
      "~/.c/eDEX-UI ❯ neofetch",
      `<span class="terminal-powerline"><span>~/.c/</span><strong>eDEX-UI</strong><span class="terminal-powerline__chevron"> ❯</span></span>  <span class="terminal-command-name">neofetch</span>`
    );
    return `<pre class="terminal-entry terminal-entry--${entry.kind}">${content}</pre>`;
  }).join("");
  output.scrollTop = output.scrollHeight;
}

const neofetchAnsiLabels = [
  "OS", "Model", "Kernel", "Uptime", "Packages", "Shell", "Resolution", "DE",
  "WM", "WM Theme", "Theme", "Icons", "Terminal", "CPU", "GPU", "Memory"
];

function renderTerminalText(value: string): string {
  const escaped = escapeHtml(value);
  if (value !== neofetchText) return escaped;

  const withAnsiIdentity = escaped
    .replace("squared@batcore-home", '<span class="neofetch-ansi-blue">squared@batcore-home</span>')
    .replace("-------------------", '<span class="neofetch-ansi-blue">-------------------</span>');

  return neofetchAnsiLabels.reduce(
    (content, label) => content.replace(`${label}:`, `<span class="neofetch-ansi-blue">${label}:</span>`),
    withAnsiIdentity
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

function setInputValue(value: string, cursor = value.length): void {
  input.value = value;
  input.setSelectionRange(cursor, cursor);
  commandDeck.dispatch({ type: "set-draft", value });
}

function insertAtCursor(value: string): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.setRangeText(value, start, end, "end");
  commandDeck.dispatch({ type: "set-draft", value: input.value });
}

function renderFilesystem(): void {
  const snapshot = commandDeck.snapshot();
  const filesystemEntries = snapshot.filesystem.entries;
  filesystemTitle.textContent = snapshot.current.filesystemView === "disks"
    ? "Showing available block devices"
    : snapshot.current.cwd;
  fileGrid.innerHTML = filesystemEntries.map(({ icon, name, category }) =>
    `<button type="button" data-file-name="${escapeHtml(name)}" data-icon="${icon}" data-category="${category}"><b>${renderFileIcon(edexIcons, icon)}</b><span>${escapeHtml(name)}</span></button>`
  ).join("");
}

function renderPrompt(): void {
  const { current: { cwd }, filesystem: { canonicalRoot, root } } = commandDeck.snapshot();
  if (cwd === canonicalRoot || cwd.startsWith(`${canonicalRoot}/`)) {
    const suffix = cwd === canonicalRoot ? "" : `/${cwd.slice(canonicalRoot.length + 1)}`;
    promptPrefix.textContent = "~/.c/";
    promptDirectory.textContent = `eDEX-UI${suffix}`;
    return;
  }
  promptPrefix.textContent = "~/";
  promptDirectory.textContent = cwd === root ? "" : cwd.slice(root.length + 1);
}

function renderSessionChrome(): void {
  const snapshot = commandDeck.snapshot();
  terminalTabs.forEach((tab, index) => {
    const state = snapshot.tabs[index]!;
    const active = state.active;
    tab.querySelector("span")!.textContent = active && snapshot.content?.preview?.kind === "document" ? "ARTICLE" : state.label;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  renderPrompt();
  renderFilesystem();
  renderContent();
}

function renderContent(): void {
  const entry = commandDeck.snapshot().content;
  const preview = entry?.preview;
  if (!entry || preview?.kind !== "document") {
    if (contentOverlay.isActive("document")) contentOverlay.close({ notify: false });
    return;
  }
  contentReaderTitle.textContent = preview.title;
  contentReaderMeta.textContent = [preview.publishedAt, entry.path].filter(Boolean).join(" // ");
  contentReaderSummary.textContent = preview.summary;
  contentReaderTags.replaceChildren(...(preview.tags ?? []).map((tag) => {
    const element = document.createElement("span");
    element.textContent = tag;
    return element;
  }));
  contentReaderBody.innerHTML = renderContentMarkdown(preview.markdown.replace(/^#\s+.+\n+/, ""), {
    documentPath: preview.contentPath,
    tree: contentTree
  });
  contentOverlay.open("document", { focus: false });
  contentReaderBody.scrollTop = 0;
}

function currentContentDirectory(): string | undefined {
  const snapshot = commandDeck.snapshot();
  const cwd = snapshot.current.cwd;
  return cwd === snapshot.filesystem.contentRoot ? "" : cwd.startsWith(`${snapshot.filesystem.contentRoot}/`)
    ? cwd.slice(snapshot.filesystem.contentRoot.length + 1)
    : undefined;
}

type ContentHistoryMode = "push" | "replace";

interface DeckHistoryState {
  readonly contentPath?: string;
  readonly filesystemPath?: string;
  readonly imageDescription?: { readonly alt: string; readonly caption?: string };
}

function deckHistoryState(relativePath: string | undefined, imageDescription?: { alt: string; caption?: string }): DeckHistoryState {
  return relativePath === undefined
    ? { filesystemPath: commandDeck.snapshot().current.cwd }
    : { contentPath: relativePath, ...(imageDescription && { imageDescription: { ...imageDescription } }) };
}

function hasHistoryState(value: unknown, expected: DeckHistoryState): boolean {
  if (typeof value !== "object" || value === null) return false;
  const current = value as Record<string, unknown>;
  return current.contentPath === expected.contentPath
    && current.filesystemPath === expected.filesystemPath
    && JSON.stringify(current.imageDescription) === JSON.stringify(expected.imageDescription);
}

function historyFilesystemPath(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const path = (value as Record<string, unknown>).filesystemPath;
  return typeof path === "string" ? path : undefined;
}

function historyImageDescription(value: unknown, relativePath: string): { alt: string; caption?: string } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const state = value as Record<string, unknown>;
  if (state.contentPath !== relativePath || typeof state.imageDescription !== "object" || state.imageDescription === null) return undefined;
  const description = state.imageDescription as Record<string, unknown>;
  if (typeof description.alt !== "string" || description.alt === "") return undefined;
  return {
    alt: description.alt,
    ...(typeof description.caption === "string" && { caption: description.caption })
  };
}

function writeContentLocation(
  relativePath: string | undefined,
  mode: ContentHistoryMode = "push",
  imageDescription?: { alt: string; caption?: string }
): void {
  if (staticMode) return;
  const nextHash = relativePath === undefined ? "" : contentHash(relativePath);
  const nextState = deckHistoryState(relativePath, imageDescription);
  if (window.location.hash === nextHash && hasHistoryState(window.history.state, nextState)) {
    lastContentHash = nextHash;
    return;
  }
  lastContentHash = nextHash;
  const nextUrl = nextHash === "" ? `${window.location.pathname}${window.location.search}` : nextHash;
  if (mode === "replace") window.history.replaceState(nextState, "", nextUrl);
  else window.history.pushState(nextState, "", nextUrl);
}

function syncLocationToDeck(mode: ContentHistoryMode = "push"): void {
  writeContentLocation(currentContentDirectory(), mode);
}

function directoryImages(relativePath: string) {
  const directory = contentDirname(relativePath);
  const absoluteDirectory = directory === "" ? browserFilesystem.contentRoot : `${browserFilesystem.contentRoot}/${directory}`;
  return browserFilesystem.list(absoluteDirectory).filter((entry) => entry.preview?.kind === "image");
}

function openContentPath(relativePath: string, options: { render?: boolean; focus?: boolean; imageDescription?: { alt: string; caption?: string } } = {}): void {
  const result = commandDeck.dispatch({ type: "activate-content-path", relativePath }).filesystem!;
  if (result.kind !== "image") {
    pendingImageOpen = undefined;
    imageViewer.close({ notify: false });
  }
  if (result.kind === "missing") {
    commandDeck.dispatch({ type: "activate-content-path", relativePath: "" });
    writeContentLocation("", "replace");
  }
  if (options.render !== false) {
    renderTerminal();
    renderSessionChrome();
  }
  if (result.kind === "document" && options.focus !== false) contentOverlayClose.focus();
  if (result.kind === "image" && result.entry.contentPath) {
    const contentPath = result.entry.contentPath;
    const openImage = (): void => imageViewer.open(
      directoryImages(contentPath),
      result.entry.path,
      options.imageDescription
    );
    if (document.documentElement.dataset.bootPhase === "complete") {
      pendingImageOpen = undefined;
      openImage();
    } else {
      pendingImageOpen = openImage;
    }
  }
}

function restoreContentLocation(options: { render?: boolean; state?: unknown } = {}): void {
  if (staticMode) return;
  const historyState = options.state ?? window.history.state;
  const relativePath = parseContentHash(window.location.hash);
  if (relativePath === undefined) {
    const filesystemPath = historyFilesystemPath(historyState);
    if (filesystemPath) {
      const result = commandDeck.dispatch({ type: "activate-filesystem-path", path: filesystemPath }).filesystem;
      if (result?.kind === "navigated") {
        lastContentHash = "";
        pendingImageOpen = undefined;
        imageViewer.close({ notify: false });
        if (options.render !== false) {
          renderTerminal();
          renderSessionChrome();
        }
        return;
      }
    }
    lastContentHash = contentHash("");
    writeContentLocation("", "replace");
    openContentPath("", { ...(options.render !== undefined && { render: options.render }), focus: false });
    return;
  }
  lastContentHash = window.location.hash;
  const imageDescription = historyImageDescription(historyState, relativePath);
  openContentPath(relativePath, {
    ...(options.render !== undefined && { render: options.render }),
    focus: false,
    ...(imageDescription && { imageDescription })
  });
}

function switchSession(index: number): void {
  commandDeck.dispatch({ type: "set-draft", value: input.value });
  commandDeck.dispatch({ type: "activate-session", index });
  renderTerminal();
  renderSessionChrome();
  syncLocationToDeck();
  setInputValue(commandDeck.snapshot().current.draft);
  input.focus();
}

function switchAdjacentSession(direction: -1 | 1): void {
  commandDeck.dispatch({ type: "activate-adjacent-session", direction });
  renderTerminal();
  renderSessionChrome();
  syncLocationToDeck();
  setInputValue(commandDeck.snapshot().current.draft);
  input.focus();
}

function clearMomentaryModifiers(): void {
  commandDeck.dispatch({ type: "clear-momentary-modifiers" });
  for (const selector of ['[data-key^="SHIFT"]', '[data-key^="CTRL"]', '[data-key="ALT GR"]', '[data-key="FN"]']) {
    document.querySelectorAll(selector).forEach((node) => node.classList.remove("latched"));
  }
}

function applyTerminalControl(command: string): boolean {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  if (command === "\r") submitCommand();
  else if (command === "\u0001") input.setSelectionRange(0, 0);
  else if (command === "\u0002") input.setSelectionRange(Math.max(0, start - 1), Math.max(0, start - 1));
  else if (command === "\u0003" || command === "\u001b") setInputValue("");
  else if (command === "\u0004") {
    if (start !== end) input.setRangeText("", start, end, "end");
    else if (start < input.value.length) input.setRangeText("", start, start + 1, "end");
    commandDeck.dispatch({ type: "set-draft", value: input.value });
  }
  else if (command === "\u0005") input.setSelectionRange(input.value.length, input.value.length);
  else if (command === "\u0006") input.setSelectionRange(Math.min(input.value.length, end + 1), Math.min(input.value.length, end + 1));
  else if (command === "\u000c") { commandDeck.dispatch({ type: "clear-output" }); renderTerminal(); }
  else if (command === "\u0010") setInputValue(commandDeck.dispatch({ type: "history-previous", draft: input.value }).value ?? input.value);
  else if (command === "\u0015") {
    input.setRangeText("", 0, end, "end");
    commandDeck.dispatch({ type: "set-draft", value: input.value });
  }
  else if (command === "\u0017") {
    const wordStart = input.value.slice(0, start).search(/\S+\s*$/);
    if (wordStart >= 0) input.setRangeText("", wordStart, end, "end");
    commandDeck.dispatch({ type: "set-draft", value: input.value });
  }
  else if (/[^\u0020-\u007e]/.test(command)) audioDeck.play("denied");
  else return false;
  return true;
}

function physicalControlCommand(event: KeyboardEvent): string | undefined {
  if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return undefined;
  return ({
    a: "\u0001",
    b: "\u0002",
    c: "\u0003",
    d: "\u0004",
    e: "\u0005",
    f: "\u0006",
    l: "\u000c",
    p: "\u0010",
    u: "\u0015",
    w: "\u0017"
  } as Readonly<Record<string, string>>)[event.key.toLocaleLowerCase()];
}

function playFeedback(feedback: TerminalFeedback): void {
  if (feedback === "success") audioDeck.play("granted");
  else if (feedback === "info") audioDeck.play("info");
  else if (feedback === "error") audioDeck.play("error");
  else if (feedback === "denied") audioDeck.play("denied");
}

function submitCommand(): void {
  const feedback = commandDeck.dispatch({ type: "submit", value: input.value }).feedback ?? "silent";
  input.value = "";
  renderTerminal();
  renderSessionChrome();
  syncLocationToDeck();
  playFeedback(feedback);
}

lifecycle.listen<SubmitEvent>(form, "submit", (event) => {
  event.preventDefault();
  submitCommand();
});

lifecycle.listen<KeyboardEvent>(input, "keydown", (event) => {
  const sourceKey = keyboardKeysForEvent(event).length > 0;
  if (sourceKey) audioDeck.play("stdin");
  const controlCommand = physicalControlCommand(event);
  if (event.key === "Escape") {
    event.preventDefault();
    applyTerminalControl("\u001b");
  } else if (controlCommand !== undefined) {
    event.preventDefault();
    applyTerminalControl(controlCommand);
  } else if ((event.ctrlKey || event.metaKey) && event.key === "Tab") {
    event.preventDefault();
    const direction = event.shiftKey ? -1 : 1;
    switchAdjacentSession(direction);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setInputValue(commandDeck.dispatch({ type: "history-previous", draft: input.value }).value ?? input.value);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    setInputValue(commandDeck.dispatch({ type: "history-next" }).value ?? input.value);
  } else if (event.key === "Tab" && input.value.length > 0) {
    event.preventDefault();
    setInputValue(commandDeck.dispatch({ type: "complete", value: input.value }).value ?? input.value);
  } else if ((event.ctrlKey || event.metaKey) && /^[1-5]$/.test(event.key)) {
    event.preventDefault();
    switchSession(Number(event.key) - 1);
  }
});

lifecycle.listen<InputEvent>(input, "input", () => commandDeck.dispatch({ type: "set-draft", value: input.value }));
lifecycle.listen<MouseEvent>(output, "click", () => input.focus());
lifecycle.listen<MouseEvent>(contentReaderBody, "click", (event) => {
  const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[data-content-anchor]");
  if (anchor) {
    event.preventDefault();
    const anchorId = anchor.dataset.contentAnchor;
    const destination = Array.from(contentReaderBody.querySelectorAll<HTMLElement>("[id]"))
      .find((element) => element.id === anchorId);
    destination?.scrollIntoView({ block: "start" });
    destination?.focus({ preventScroll: true });
    return;
  }
  const target = (event.target as Element | null)?.closest<HTMLElement>("[data-content-path]");
  const relativePath = target?.dataset.contentPath;
  if (!relativePath) return;
  event.preventDefault();
  const image = target instanceof HTMLImageElement ? target : target.querySelector<HTMLImageElement>("img");
  const imageDescription = image?.alt ? { alt: image.alt } : undefined;
  writeContentLocation(relativePath, "push", imageDescription);
  openContentPath(relativePath, {
    ...(imageDescription && { imageDescription })
  });
});

const handleContentHashChange = (): void => {
  if (window.location.hash === lastContentHash) return;
  restoreContentLocation();
};
lifecycle.listen<PopStateEvent>(window, "popstate", (event) => restoreContentLocation({ state: event.state }));
lifecycle.listen<HashChangeEvent>(window, "hashchange", handleContentHashChange);

lifecycle.listen<KeyboardEvent>(document, "keydown", (event) => {
  if (document.documentElement.dataset.bootPhase !== "complete") return;
  if (document.activeElement === input || event.isComposing) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement) return;
  if (activeElement instanceof HTMLInputElement || (activeElement instanceof HTMLElement && activeElement.isContentEditable)) return;
  if (activeElement instanceof HTMLButtonElement && event.key === " ") return;
  input.focus();
  audioDeck.play("stdin");
}, { capture: true });

lifecycle.listen<KeyboardEvent>(document, "keydown", (event) => {
  if (event.code !== "CapsLock" || event.repeat) return;
  commandDeck.dispatch({ type: "toggle-modifier", modifier: "capsLock" });
  document.querySelector<HTMLButtonElement>('[data-key="CAPS"]')?.classList.toggle("latched", commandDeck.snapshot().modifiers.capsLock);
});

function activateOnScreenKey(button: HTMLButtonElement, playKeySound = true): void {
  const key = button.dataset.key!;
  if (playKeySound) audioDeck.play("stdin");
  if (key === "BACK") {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    if (start !== end) input.setRangeText("", start, end, "end");
    else if (start > 0) input.setRangeText("", start - 1, start, "end");
    commandDeck.dispatch({ type: "set-draft", value: input.value });
  }
  else if (key === "ENTER" || key === "ENTER_LOWER") submitCommand();
  else if (key === "SPACE") insertAtCursor(" ");
  else if (key === "CAPS") { commandDeck.dispatch({ type: "toggle-modifier", modifier: "capsLock" }); button.classList.toggle("latched", commandDeck.snapshot().modifiers.capsLock); }
  else if (key === "SHIFT" || key === "SHIFT_RIGHT") { commandDeck.dispatch({ type: "toggle-modifier", modifier: "shift" }); document.querySelectorAll('[data-key^="SHIFT"]').forEach((node) => node.classList.toggle("latched", commandDeck.snapshot().modifiers.shift)); }
  else if (key === "CTRL" || key === "CTRL_RIGHT") { commandDeck.dispatch({ type: "toggle-modifier", modifier: "ctrl" }); document.querySelectorAll('[data-key^="CTRL"]').forEach((node) => node.classList.toggle("latched", commandDeck.snapshot().modifiers.ctrl)); }
  else if (key === "ALT GR") { commandDeck.dispatch({ type: "toggle-modifier", modifier: "alt" }); button.classList.toggle("latched", commandDeck.snapshot().modifiers.alt); }
  else if (key === "FN") { commandDeck.dispatch({ type: "toggle-modifier", modifier: "fn" }); button.classList.toggle("latched", commandDeck.snapshot().modifiers.fn); }
  else if (key === "ESC") setInputValue("");
  else if (key === "TAB") {
    const modifiers = commandDeck.snapshot().modifiers;
    if (modifiers.ctrl) {
      const direction = modifiers.shift ? -1 : 1;
      switchAdjacentSession(direction);
      clearMomentaryModifiers();
    } else setInputValue(commandDeck.dispatch({ type: "complete", value: input.value }).value ?? input.value);
  }
  else if (key === "↑") setInputValue(commandDeck.dispatch({ type: "history-previous", draft: input.value }).value ?? input.value);
  else if (key === "↓") setInputValue(commandDeck.dispatch({ type: "history-next" }).value ?? input.value);
  else if (key === "←" || key === "→") {
    const current = input.selectionStart ?? input.value.length;
    const next = key === "←" ? Math.max(0, current - 1) : Math.min(input.value.length, current + 1);
    input.setSelectionRange(next, next);
  }
  else {
    const layoutKey = keyboardKeys.get(key);
    if (!layoutKey) return;
    const modifiers = commandDeck.snapshot().modifiers;
    if (modifiers.ctrl && /^[1-5]$/.test(key)) {
      switchSession(Number(key) - 1);
      clearMomentaryModifiers();
      return;
    }
    const command = resolveKeyboardCommand(layoutKey, modifiers);
    if (!applyTerminalControl(command)) insertAtCursor(command);
    clearMomentaryModifiers();
  }
  input.focus();
}

const nonRepeatingKeys = new Set(["CAPS", "SHIFT", "SHIFT_RIGHT", "CTRL", "CTRL_RIGHT", "ALT GR", "FN"]);
document.querySelectorAll<HTMLButtonElement>(".key").forEach((button) => {
  lifecycle.add(bindPointerKeyboardFeedback(button));
  lifecycle.listen<MouseEvent>(button, "click", () => activateOnScreenKey(button));
  if (!nonRepeatingKeys.has(button.dataset.key!)) {
    lifecycle.add(bindPointerKeyRepeat(button, () => activateOnScreenKey(button, false)));
  }
});
lifecycle.add(bindPhysicalKeyboardFeedback(document.querySelector(".keyboard-panel")!));

terminalTabs.forEach((button, index) => {
  lifecycle.listen<MouseEvent>(button, "click", () => {
    audioDeck.play("folder");
    switchSession(index);
  });
  lifecycle.listen<KeyboardEvent>(button, "keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const destination = event.key === "Home"
      ? 0
      : event.key === "End"
        ? terminalTabs.length - 1
        : (index + (event.key === "ArrowLeft" ? -1 : 1) + terminalTabs.length) % terminalTabs.length;
    audioDeck.play("folder");
    switchSession(destination);
  });
});

lifecycle.listen<MouseEvent>(fileGrid, "click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button[data-file-name]");
  if (!button) return;
  const result = commandDeck.dispatch({ type: "activate-filesystem-entry", name: button.dataset.fileName! }).filesystem!;
  if (result.kind === "insert") {
    const start = input.selectionStart ?? input.value.length;
    const separator = start > 0 && !/\s/.test(input.value[start - 1] ?? "") ? " " : "";
    insertAtCursor(`${separator}${result.value}`);
  }
  if (result.kind === "navigated" || result.kind === "show-disks") {
    renderTerminal();
    renderSessionChrome();
    syncLocationToDeck();
  }
  if (result.kind === "theme" || result.kind === "keyboard") renderTerminal();
  if (result.kind === "document") {
    renderSessionChrome();
    if (result.entry.contentPath) writeContentLocation(result.entry.contentPath);
    contentOverlayClose.focus();
  }
  if (result.kind === "image") {
    const images = result.entry.contentPath
      ? directoryImages(result.entry.contentPath)
      : commandDeck.snapshot().filesystem.entries.filter((entry) => entry.preview?.kind === "image");
    if (result.entry.contentPath) writeContentLocation(result.entry.contentPath);
    imageViewer.open(images, result.entry.path);
  }
  if (result.kind === "insert") audioDeck.play("folder");
  else if (result.kind !== "image") playFeedback(result.feedback);
  if (!["document", "image"].includes(result.kind)) input.focus();
});

function renderTelemetry(tick: number): void {
  const snapshot = createTelemetrySnapshot(tick);
  document.querySelector("#telemetry-source")!.textContent = snapshot.source.toUpperCase();
  if (staticMode) {
    document.querySelector("#cpu-line-a")!.setAttribute("points", canonicalCpuTraces.first);
    document.querySelector("#cpu-line-a-secondary")!.setAttribute("points", canonicalCpuTraces.firstSecondary);
    document.querySelector("#cpu-line-b")!.setAttribute("points", canonicalCpuTraces.second);
    document.querySelector("#cpu-line-b-secondary")!.setAttribute("points", canonicalCpuTraces.secondSecondary);
  } else {
    document.querySelector("#cpu-line-a")!.setAttribute("points", sparklinePoints(snapshot.historyA));
    document.querySelector("#cpu-line-a-secondary")!.setAttribute("points", sparklinePoints(snapshot.historyB));
    document.querySelector("#cpu-line-b")!.setAttribute("points", sparklinePoints(snapshot.historyB));
    document.querySelector("#cpu-line-b-secondary")!.setAttribute("points", sparklinePoints(snapshot.historyA));
  }
  if (staticMode) {
    document.querySelector("#net-line-a")!.setAttribute("points", canonicalNetworkTraces.outbound);
    document.querySelector("#net-line-c")!.setAttribute("points", canonicalNetworkTraces.inbound);
  } else {
    document.querySelector("#net-line-a")!.setAttribute("points", sparklinePoints(snapshot.historyA, 280, 82));
    document.querySelector("#net-line-b")!.setAttribute("points", sparklinePoints(snapshot.historyB, 280, 82));
    document.querySelector("#net-line-c")!.setAttribute("points", sparklinePoints([...snapshot.historyB].reverse(), 280, 82));
    document.querySelector("#net-line-d")!.setAttribute("points", sparklinePoints([...snapshot.historyA].reverse(), 280, 82));
  }
  document.querySelector("#cpu-a")!.textContent = staticMode ? "Avg. 55%" : `Avg. ${snapshot.cpu}%`;
  document.querySelector("#cpu-b")!.textContent = staticMode ? "Avg. 56%" : `Avg. ${Math.max(snapshot.cpu - 8, 0)}%`;
  document.querySelector("#temp")!.textContent = staticMode ? "62°C" : `${snapshot.temperature}°C`;
  document.querySelector("#tasks")!.textContent = staticMode ? "257" : String(snapshot.tasks);
  document.querySelector("#memory-label")!.textContent = staticMode ? "USING 3.4 OUT OF 7.7 GiB" : `USING ${snapshot.memory}% OF 16 GB`;
  (document.querySelector<HTMLProgressElement>("#memory-meter")!).value = staticMode ? 1.5 : 4;
  document.querySelector("#traffic-label")!.textContent = staticMode ? "158 MB OUT, 1.32 GB IN" : `${snapshot.upload.toFixed(2)} UP · ${snapshot.download.toFixed(2)} DOWN`;
  document.querySelector("#ping")!.textContent = staticMode ? "16ms" : `${14 + tick % 7}ms`;
  document.querySelector("#latency")!.textContent = staticMode ? "381ms" : `${34 + tick % 9}ms`;
}

function renderClock(): void {
  const setClockText = (value: string): void => {
    document.querySelector("#deck-clock")!.innerHTML = [...value].map((character) => character === ":" ? `<em>${character}</em>` : `<span>${character}</span>`).join("");
  };
  if (staticMode) {
    setClockText("20:27:46");
    document.querySelector("#deck-year")!.textContent = "2019";
    document.querySelector("#deck-date")!.textContent = "APR 29";
    document.querySelector("#terminal-time")!.textContent = "lun. 29 avril 20 lun. 29 avril 2019 20:27:05 CEST";
    document.querySelector("#terminal-time-secondary")!.textContent = "lun. 29 avril 2019 20:27:24 CEST";
    return;
  }
  const now = new Date();
  setClockText(now.toLocaleTimeString("en-GB", { hour12: false }));
  document.querySelector("#deck-year")!.textContent = String(now.getFullYear());
  document.querySelector("#deck-date")!.textContent = now.toLocaleDateString("en-GB", { month: "short", day: "numeric" }).toUpperCase();
  document.querySelector("#terminal-time")!.textContent = `${now.toISOString().slice(0, 19).replace("T", " ")} UTC`;
  document.querySelector("#terminal-time-secondary")!.textContent = "";
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex]!, items[index]!];
  }
  return items;
}

const memoryGrid = document.querySelector("#memory-grid")!;
const memoryPointStates: MemoryPointState[] = staticMode
  ? canonicalMemoryPointStates
  : seededShuffle(Array.from({ length: 440 }, (_, index) => index < 194 ? "active" : index < 344 ? "available" : "free"), 0x2ed2_0228);
memoryGrid.innerHTML = memoryPointStates.map((state) => `<i class="${state}"></i>`).join("");

if (!staticMode) restoreContentLocation({ render: false });
renderTerminal();
renderSessionChrome();
renderTelemetry(0);
renderClock();

if (!staticMode) {
  let tick = 0;
  runtimeScheduler!.every(1400, () => {
    tick += 1;
    document.documentElement.dataset.telemetryTick = String(tick);
    renderTelemetry(tick);
  });
  runtimeScheduler!.every(1000, renderClock);
}

const bootElements: BootElements = {
  overlay: document.querySelector<HTMLElement>("#boot-overlay")!,
  log: document.querySelector<HTMLElement>("#boot-log")!,
  title: document.querySelector<HTMLElement>("#boot-title")!,
  deck: document.querySelector<HTMLElement>("#command-deck")!,
  skip: document.querySelector<HTMLButtonElement>("#boot-skip")!
};

const initializeButton = document.querySelector<HTMLButtonElement>("#initialize-system")!;
const gateSoundToggle = document.querySelector<HTMLButtonElement>("#gate-sound-toggle")!;
const soundToggle = document.querySelector<HTMLButtonElement>("#sound-toggle")!;
const rebootButton = document.querySelector<HTMLButtonElement>("#reboot-system")!;

function updateSoundLabels(): void {
  const label = audioDeck.isEnabled() ? "ON" : "OFF";
  soundToggle.textContent = `SOUND ${label}`;
  gateSoundToggle.textContent = `Sound: ${label.toLowerCase()}`;
  soundToggle.setAttribute("aria-pressed", String(audioDeck.isEnabled()));
  gateSoundToggle.setAttribute("aria-pressed", String(audioDeck.isEnabled()));
}

function toggleSound(): void {
  audioDeck.setEnabled(!audioDeck.isEnabled());
  updateSoundLabels();
}

let bootAbortController: AbortController | undefined;
lifecycle.add(() => bootAbortController?.abort());

function waitForDesktopPaint(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let observedFrames = 0;
    let stopAnimation = (): void => undefined;
    const cleanup = (): void => {
      stopAnimation();
      signal.removeEventListener("abort", handleAbort);
    };
    const handleAbort = (): void => {
      cleanup();
      reject(new DOMException("Boot sequence aborted", "AbortError"));
    };
    stopAnimation = runtimeScheduler!.eachFrame(() => {
      observedFrames += 1;
      if (observedFrames < 2) return;
      cleanup();
      resolve();
    });
    signal.addEventListener("abort", handleAbort, { once: true });
    if (signal.aborted) handleAbort();
  });
}

async function startBoot(): Promise<void> {
  bootAbortController?.abort();
  const controller = new AbortController();
  bootAbortController = controller;
  initializeButton.disabled = true;
  rebootButton.disabled = true;
  const speed = searchParams.has("fastboot") ? 0.04 : 1;
  try {
    await runBootSequence(bootElements, audioDeck, speed, controller.signal);
    input.focus();
    if (pendingImageOpen) await waitForDesktopPaint(controller.signal);
    const openPendingImage = pendingImageOpen;
    pendingImageOpen = undefined;
    openPendingImage?.();
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
  } finally {
    if (bootAbortController === controller) {
      initializeButton.disabled = false;
      rebootButton.disabled = false;
    }
  }
}

lifecycle.listen<MouseEvent>(initializeButton, "click", () => { void startBoot(); });
lifecycle.listen<MouseEvent>(gateSoundToggle, "click", toggleSound);
lifecycle.listen<MouseEvent>(soundToggle, "click", toggleSound);
lifecycle.listen<MouseEvent>(rebootButton, "click", () => { void startBoot(); });
updateSoundLabels();

if (staticMode) completeBootImmediately(bootElements);
document.querySelector<HTMLElement>("#command-deck")!.setAttribute("data-ready", "");
