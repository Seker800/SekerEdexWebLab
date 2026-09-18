import "./styles.css";
import { AudioDeck } from "./audio-deck.js";
import { completeBootImmediately, runBootSequence, type BootElements } from "./boot-sequence.js";
import { canonicalCpuTraces, canonicalEdexVersion, canonicalGlobeConstellation, canonicalMemoryPointStates, canonicalNetworkConnectionLocations, canonicalNetworkTraces, canonicalSatelliteAnimationAdvanceMs, type MemoryPointState } from "./canonical-runtime.js";
import { initializeEdexGlobe, loadEdexIcons, renderEdexIcon, type EdexGlobeLayers } from "./edex-assets.js";
import { canonicalFileEntries } from "./filesystem-model.js";
import { bindPhysicalKeyboardFeedback, bindPointerKeyboardFeedback, keyboardKeysForEvent } from "./keyboard-feedback.js";
import { loadKeyboardLayout, resolveKeyboardCommand } from "./keyboard-layout.js";
import { TerminalSessionDeck } from "./terminal-session.js";
import { neofetchText } from "./terminal-model.js";
import { createTelemetrySnapshot, sparklinePoints } from "./telemetry.js";

const arrowIcons: Record<string, string> = {
  "↑": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-opacity="1" d="m12.00004 7.99999 4.99996 5h-2.99996v4.00001h-4v-4.00001h-3z"/><path stroke-linejoin="round" fill-opacity=".65" d="m4 3h16c1.1046 0 1-.10457 1 1v16c0 1.1046.1046 1-1 1h-16c-1.10457 0-1 .1046-1-1v-16c0-1.10457-.10457-1 1-1zm0 1v16h16v-16z"/></svg>',
  "←": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-opacity="1" d="m7.500015 12.499975 5-4.99996v2.99996h4.00001v4h-4.00001v3z"/><path stroke-linejoin="round" fill-opacity=".65" d="m4 3h16c1.1046 0 1-.10457 1 1v16c0 1.1046.1046 1-1 1h-16c-1.10457 0-1 .1046-1-1v-16c0-1.10457-.10457-1 1-1zm0 1v16h16v-16z"/></svg>',
  "↓": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-opacity="1" d="m12 17-4.99996-5h2.99996v-4.00001h4v4.00001h3z"/><path stroke-linejoin="round" fill-opacity=".65" d="m4 3h16c1.1046 0 1-.10457 1 1v16c0 1.1046.1046 1-1 1h-16c-1.10457 0-1 .1046-1-1v-16c0-1.10457-.10457-1 1-1zm0 1v16h16v-16z"/></svg>',
  "→": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-opacity="1" d="m16.500025 12.500015-5 4.99996v-2.99996h-4.00001v-4h4.00001v-3z"/><path stroke-linejoin="round" fill-opacity=".65" d="m4 3h16c1.1046 0 1-.10457 1 1v16c0 1.1046.1046 1-1 1h-16c-1.10457 0-1 .1046-1-1v-16c0-1.10457-.10457-1 1-1zm0 1v16h16v-16z"/></svg>'
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root is missing");
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
        <header><span>CPU USAGE</span><small>Intel® Core™ i5-4200H</small></header>
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
      <nav class="terminal-tabs" aria-label="Terminal sessions">
        <button class="active" type="button"><span>MAIN SHELL</span></button><button type="button"><span>EMPTY</span></button><button type="button"><span>EMPTY</span></button><button type="button"><span>EMPTY</span></button><button type="button"><span>EMPTY</span></button>
      </nav>
      <div class="terminal-status"><span>Welcome to eDEX-UI v${canonicalEdexVersion} - Electron v4.1.4</span></div>
      <span class="terminal-times"><span id="terminal-time">SESSION // READY</span><span id="terminal-time-secondary"></span></span>
      <div class="terminal-output" id="terminal-output" role="log" aria-live="polite"></div>
      <form class="terminal-prompt" id="terminal-form">
        <label class="terminal-powerline" for="terminal-input"><span>~/.c/</span><strong>eDEX-UI</strong><span class="terminal-powerline__chevron"> ❯</span></label>
        <input id="terminal-input" autocomplete="off" spellcheck="false" aria-label="Terminal command" />
        <span class="cursor" aria-hidden="true"></span>
      </form>
      <div class="terminal-footer"><span>TYPE <b>HELP</b> FOR COMMANDS</span><span id="latency">381ms</span><span id="terminal-footer-time">lun. 29 avril 2019 20:27:29 CEST</span></div>
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
        ${canonicalFileEntries.map(({ icon, name, category }) => `<button type="button" data-icon="${icon}" data-category="${category}"><b>${renderEdexIcon(edexIcons, icon)}</b><span>${name}</span></button>`).join("")}
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
`;

const output = document.querySelector<HTMLDivElement>("#terminal-output")!;
const input = document.querySelector<HTMLInputElement>("#terminal-input")!;
const form = document.querySelector<HTMLFormElement>("#terminal-form")!;
const fileGrid = document.querySelector<HTMLDivElement>(".file-grid")!;
const filesystemTitle = document.querySelector<HTMLElement>(".filesystem-panel .section-label small")!;
const promptPrefix = document.querySelector<HTMLElement>(".terminal-prompt .terminal-powerline > span:first-child")!;
const promptDirectory = document.querySelector<HTMLElement>(".terminal-prompt .terminal-powerline > strong")!;
const terminalTabs = [...document.querySelectorAll<HTMLButtonElement>(".terminal-tabs button")];
const audioDeck = new AudioDeck();
const staticGlobeAngle = searchParams.has("globeAngle") ? Number(searchParams.get("globeAngle")) : 6.26;
const staticGlobeSeed = searchParams.has("globeSeed") ? Number(searchParams.get("globeSeed")) : 0x1f87_2855;
const staticGlobeLayerMode = searchParams.get("globeLayers") ?? "all";
const staticGlobeLayers: EdexGlobeLayers = staticMode && staticGlobeLayerMode !== "all" ? {
  satellites: staticGlobeLayerMode === "satellites",
  localEndpoint: staticGlobeLayerMode === "pins" || staticGlobeLayerMode === "local",
  connections: staticGlobeLayerMode === "pins" || staticGlobeLayerMode === "connections"
} : { satellites: true, localEndpoint: true, connections: true };
const globeContainer = document.querySelector<HTMLElement>("#edex-globe")!;
let globeInitialization: Promise<boolean> | undefined;
const initializeRuntimeGlobe = (speed = 1): Promise<boolean> => {
  globeInitialization ??= initializeEdexGlobe(globeContainer, {
    animate: true,
    connectionLocations: canonicalNetworkConnectionLocations,
    layers: staticGlobeLayers,
    sourceTimingScale: speed
  });
  return globeInitialization;
};
if (staticMode) {
  await initializeEdexGlobe(globeContainer, {
    animate: false,
    fixedCameraAngle: staticGlobeAngle,
    fixedRandomSeed: staticGlobeSeed,
    connectionLocations: canonicalNetworkConnectionLocations,
    layers: staticGlobeLayers,
    constellationLocations: canonicalGlobeConstellation,
    fixedSatelliteAnimationAdvanceMs: canonicalSatelliteAnimationAdvanceMs
  });
} else {
  document.addEventListener("edex:module-runtime-start", (event) => {
    const speed = (event as CustomEvent<{ speed?: number }>).detail.speed ?? 1;
    void initializeRuntimeGlobe(speed);
  });
}
const terminalDeck = new TerminalSessionDeck();
let capsLock = false;
let shift = false;
let ctrl = false;
let alt = false;
let fn = false;

function renderTerminal(): void {
  output.innerHTML = terminalDeck.current.entries.map((entry) => {
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
  terminalDeck.setDraft(value);
}

function insertAtCursor(value: string): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.setRangeText(value, start, end, "end");
  terminalDeck.setDraft(input.value);
}

function renderFilesystem(): void {
  const filesystemEntries = terminalDeck.filesystemEntries();
  filesystemTitle.textContent = terminalDeck.current.filesystemView === "disks"
    ? "Showing available block devices"
    : terminalDeck.current.cwd;
  fileGrid.innerHTML = filesystemEntries.map(({ icon, name, category }) =>
    `<button type="button" data-file-name="${escapeHtml(name)}" data-icon="${icon}" data-category="${category}"><b>${renderEdexIcon(edexIcons, icon)}</b><span>${escapeHtml(name)}</span></button>`
  ).join("");
}

function renderPrompt(): void {
  const { cwd } = terminalDeck.current;
  const { home, root } = terminalDeck.filesystem;
  if (cwd === home || cwd.startsWith(`${home}/`)) {
    const suffix = cwd === home ? "" : `/${cwd.slice(home.length + 1)}`;
    promptPrefix.textContent = "~/.c/";
    promptDirectory.textContent = `eDEX-UI${suffix}`;
    return;
  }
  promptPrefix.textContent = "~/";
  promptDirectory.textContent = cwd === root ? "" : cwd.slice(root.length + 1);
}

function renderSessionChrome(): void {
  terminalTabs.forEach((tab, index) => {
    const active = terminalDeck.current.index === index;
    tab.querySelector("span")!.textContent = terminalDeck.label(index);
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  renderPrompt();
  renderFilesystem();
}

function switchSession(index: number): void {
  terminalDeck.setDraft(input.value);
  terminalDeck.activate(index);
  renderTerminal();
  renderSessionChrome();
  setInputValue(terminalDeck.current.draft);
  input.focus();
}

function clearMomentaryModifiers(): void {
  shift = false;
  ctrl = false;
  alt = false;
  fn = false;
  for (const selector of ['[data-key^="SHIFT"]', '[data-key^="CTRL"]', '[data-key="ALT GR"]', '[data-key="FN"]']) {
    document.querySelectorAll(selector).forEach((node) => node.classList.remove("latched"));
  }
}

function applyTerminalControl(command: string): boolean {
  if (command === "\u0001") input.setSelectionRange(0, 0);
  else if (command === "\u0005") input.setSelectionRange(input.value.length, input.value.length);
  else if (command === "\u0003" || command === "\u001b") setInputValue("");
  else if (command === "\u000c") { terminalDeck.clear(); renderTerminal(); }
  else return false;
  return true;
}

function submitCommand(): void {
  const hadCommand = input.value.trim().length > 0;
  terminalDeck.submit(input.value);
  input.value = "";
  renderTerminal();
  renderSessionChrome();
  if (hadCommand) audioDeck.play("stdout");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitCommand();
});

input.addEventListener("keydown", (event) => {
  const sourceKey = keyboardKeysForEvent(event).length > 0;
  if (sourceKey) audioDeck.play("stdin");
  if ((event.ctrlKey || event.metaKey) && event.key === "Tab") {
    event.preventDefault();
    const direction = event.shiftKey ? -1 : 1;
    switchSession((terminalDeck.current.index + direction + terminalTabs.length) % terminalTabs.length);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    setInputValue(terminalDeck.historyPrevious(input.value));
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    setInputValue(terminalDeck.historyNext());
  } else if (event.key === "Tab") {
    event.preventDefault();
    setInputValue(terminalDeck.complete(input.value));
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "l") {
    event.preventDefault();
    terminalDeck.clear();
    renderTerminal();
  } else if ((event.ctrlKey || event.metaKey) && /^[1-5]$/.test(event.key)) {
    event.preventDefault();
    switchSession(Number(event.key) - 1);
  }
});

input.addEventListener("input", () => terminalDeck.setDraft(input.value));

document.addEventListener("keydown", (event) => {
  if (event.code !== "CapsLock" || event.repeat) return;
  capsLock = !capsLock;
  document.querySelector<HTMLButtonElement>('[data-key="CAPS"]')?.classList.toggle("latched", capsLock);
});

document.addEventListener("keyup", (event) => {
  if (event.code === "Enter") audioDeck.play("granted");
});

document.querySelectorAll<HTMLButtonElement>(".key").forEach((button) => {
  bindPointerKeyboardFeedback(button);
  button.addEventListener("click", () => {
    const key = button.dataset.key!;
    audioDeck.play(key === "ENTER" || key === "ENTER_LOWER" ? "granted" : "stdin");
    if (key === "BACK") {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      if (start !== end) input.setRangeText("", start, end, "end");
      else if (start > 0) input.setRangeText("", start - 1, start, "end");
      terminalDeck.setDraft(input.value);
    }
    else if (key === "ENTER" || key === "ENTER_LOWER") submitCommand();
    else if (key === "SPACE") insertAtCursor(" ");
    else if (key === "CAPS") { capsLock = !capsLock; button.classList.toggle("latched", capsLock); }
    else if (key === "SHIFT" || key === "SHIFT_RIGHT") { shift = !shift; document.querySelectorAll('[data-key^="SHIFT"]').forEach((node) => node.classList.toggle("latched", shift)); }
    else if (key === "CTRL" || key === "CTRL_RIGHT") { ctrl = !ctrl; document.querySelectorAll('[data-key^="CTRL"]').forEach((node) => node.classList.toggle("latched", ctrl)); }
    else if (key === "ALT GR") { alt = !alt; button.classList.toggle("latched", alt); }
    else if (key === "FN") { fn = !fn; button.classList.toggle("latched", fn); }
    else if (key === "ESC") setInputValue("");
    else if (key === "TAB") {
      if (ctrl) {
        const direction = shift ? -1 : 1;
        switchSession((terminalDeck.current.index + direction + terminalTabs.length) % terminalTabs.length);
        clearMomentaryModifiers();
      } else setInputValue(terminalDeck.complete(input.value));
    }
    else if (key === "↑") setInputValue(terminalDeck.historyPrevious(input.value));
    else if (key === "↓") setInputValue(terminalDeck.historyNext());
    else if (key === "←" || key === "→") {
      const current = input.selectionStart ?? input.value.length;
      const next = key === "←" ? Math.max(0, current - 1) : Math.min(input.value.length, current + 1);
      input.setSelectionRange(next, next);
    }
    else {
      const layoutKey = keyboardKeys.get(key);
      if (!layoutKey) return;
      if (ctrl && /^[1-5]$/.test(key)) {
        switchSession(Number(key) - 1);
        clearMomentaryModifiers();
        return;
      }
      const command = resolveKeyboardCommand(layoutKey, { shift, capsLock, ctrl, alt, fn });
      if (!applyTerminalControl(command)) insertAtCursor(command);
      clearMomentaryModifiers();
    }
    input.focus();
  });
});
bindPhysicalKeyboardFeedback(document.querySelector(".keyboard-panel")!);

terminalTabs.forEach((button, index) => {
  button.addEventListener("click", () => {
    audioDeck.play("folder");
    switchSession(index);
  });
});

fileGrid.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button[data-file-name]");
  if (!button) return;
  audioDeck.play("folder");
  const result = terminalDeck.activateFilesystemEntry(button.dataset.fileName!);
  if (result.kind === "insert") {
    const start = input.selectionStart ?? input.value.length;
    const separator = start > 0 && !/\s/.test(input.value[start - 1] ?? "") ? " " : "";
    insertAtCursor(`${separator}${result.value}`);
  }
  if (result.kind === "navigated" || result.kind === "show-disks") {
    renderTerminal();
    renderSessionChrome();
  }
  input.focus();
});

function renderTelemetry(tick: number): void {
  const snapshot = createTelemetrySnapshot(tick);
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

renderTerminal();
renderSessionChrome();
renderTelemetry(0);
renderClock();

if (!staticMode) {
  let tick = 0;
  window.setInterval(() => { tick += 1; renderTelemetry(tick); }, 1400);
  window.setInterval(renderClock, 1000);
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

async function startBoot(): Promise<void> {
  initializeButton.disabled = true;
  const speed = searchParams.has("fastboot") ? 0.04 : 1;
  await runBootSequence(bootElements, audioDeck, speed);
  initializeButton.disabled = false;
  input.focus();
}

initializeButton.addEventListener("click", () => { void startBoot(); });
gateSoundToggle.addEventListener("click", toggleSound);
soundToggle.addEventListener("click", toggleSound);
rebootButton.addEventListener("click", () => { void startBoot(); });
updateSoundLabels();

if (staticMode) completeBootImmediately(bootElements);
document.querySelector<HTMLElement>("#command-deck")!.setAttribute("data-ready", "");
