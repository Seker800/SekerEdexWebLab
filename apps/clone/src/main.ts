import "./styles.css";
import { AudioDeck } from "./audio-deck.js";
import { completeBootImmediately, runBootSequence, type BootElements } from "./boot-sequence.js";
import { canonicalCpuTraces, canonicalGlobeConstellation, canonicalMemoryPointStates, canonicalNetworkConnectionLocations, canonicalNetworkTraces, type MemoryPointState } from "./canonical-runtime.js";
import { initializeEdexGlobe, loadEdexIcons, renderEdexIcon, type EdexGlobeLayers } from "./edex-assets.js";
import { canonicalFileEntries } from "./filesystem-model.js";
import { executeCommand, neofetchText, type TerminalEntry } from "./terminal-model.js";
import { createTelemetrySnapshot, sparklinePoints } from "./telemetry.js";

interface KeyboardKey { key: string; label?: string; shift?: string }
const keyboardRows: KeyboardKey[][] = [
  [
    { key: "ESC" }, { key: "`", shift: "~" }, { key: "1", shift: "!" }, { key: "2", shift: "@" },
    { key: "3", shift: "#" }, { key: "4", shift: "$" }, { key: "5", shift: "%" }, { key: "6", shift: "^" },
    { key: "7", shift: "&" }, { key: "8", shift: "*" }, { key: "9", shift: "(" }, { key: "0", shift: ")" },
    { key: "-", shift: "_" }, { key: "=", shift: "+" }, { key: "BACK", shift: "DELETE" }
  ],
  ["TAB", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"].map<KeyboardKey>((key) => ({ key })).concat([
    { key: "[", shift: "{" }, { key: "]", shift: "}" }, { key: "ENTER" }
  ]),
  ["CAPS", "A", "S", "D", "F", "G", "H", "J", "K", "L"].map<KeyboardKey>((key) => ({ key })).concat([
    { key: ";", shift: ":" }, { key: "'", shift: "\"" }, { key: "\\", shift: "|" }, { key: "ENTER_LOWER", label: "" }
  ]),
  [{ key: "SHIFT" }, { key: "<", shift: ">" }, ...["Z", "X", "C", "V", "B", "N", "M"].map((key) => ({ key })),
    { key: ",", shift: "<" }, { key: ".", shift: ">" }, { key: "/", shift: "?" }, { key: "SHIFT_RIGHT", label: "SHIFT" }, { key: "↑" }],
  ["CTRL", "FN", "SPACE", "ALT GR", "CTRL_RIGHT", "←", "↓", "→"].map((key) => ({ key, label: key === "CTRL_RIGHT" ? "CTRL" : key }))
];

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
const edexIcons = await loadEdexIcons();

app.innerHTML = `
  <section class="boot-overlay" id="boot-overlay" data-phase="gate" aria-label="System startup">
    <div class="boot-gate">
      <p class="boot-gate__eyebrow">eDEX-UI v2.2.8</p>
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
      <div class="terminal-status"><span>Welcome to eDEX-UI v2.2.0 - Electron v4.1.4</span></div>
      <span class="terminal-times"><span id="terminal-time">SESSION // READY</span><span id="terminal-time-secondary"></span></span>
      <div class="terminal-output" id="terminal-output" role="log" aria-live="polite"></div>
      <form class="terminal-prompt" id="terminal-form">
        <label for="terminal-input">~/.c/eDEX-UI ❯</label>
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
      ${keyboardRows.map((row, rowIndex) => `<div class="key-row key-row-${rowIndex}">${row.map(({ key, label = key, shift: shiftedLabel }) => {
        const specialClass = key === "SPACE" ? " key--space" : key === "ENTER" ? " key--enter-upper" : key === "ENTER_LOWER" ? " key--enter-lower" : "";
        const keyContent = key === "SPACE" ? "" : arrowIcons[key] ?? `${shiftedLabel ? `<span class="key-shift">${escapeHtml(shiftedLabel)}</span>` : ""}<span class="key-main">${escapeHtml(label)}</span>`;
        return `<button type="button" class="key${specialClass}" data-key="${key}"${shiftedLabel ? ` data-shift="${escapeHtml(shiftedLabel)}"` : ""}>${keyContent}</button>`;
      }).join("")}</div>`).join("")}
    </section>
  </main>
`;

const output = document.querySelector<HTMLDivElement>("#terminal-output")!;
const input = document.querySelector<HTMLInputElement>("#terminal-input")!;
const form = document.querySelector<HTMLFormElement>("#terminal-form")!;
const audioDeck = new AudioDeck();
const staticGlobeAngle = searchParams.has("globeAngle") ? Number(searchParams.get("globeAngle")) : 6.26;
const staticGlobeSeed = searchParams.has("globeSeed") ? Number(searchParams.get("globeSeed")) : 0xb6f6_72d2;
const staticGlobeLayerMode = searchParams.get("globeLayers") ?? "all";
const staticGlobeLayers: EdexGlobeLayers = staticMode && staticGlobeLayerMode !== "all" ? {
  satellites: staticGlobeLayerMode === "satellites",
  localEndpoint: staticGlobeLayerMode === "pins" || staticGlobeLayerMode === "local",
  connections: staticGlobeLayerMode === "pins" || staticGlobeLayerMode === "connections"
} : { satellites: true, localEndpoint: true, connections: true };
await initializeEdexGlobe(
  document.querySelector<HTMLElement>("#edex-globe")!,
  !staticMode,
  staticMode ? staticGlobeAngle : undefined,
  staticGlobeSeed,
  staticMode ? canonicalNetworkConnectionLocations : [],
  staticGlobeLayers,
  staticMode ? canonicalGlobeConstellation : undefined
);
let entries: TerminalEntry[] = [{ kind: "output", text: neofetchText }];
let capsLock = false;
let shift = false;

function renderTerminal(): void {
  output.innerHTML = entries.map((entry) => {
    const content = escapeHtml(entry.text).replace(
      "■ ■ ■ ■ ■ ■ ■ ■",
      `<span class="neofetch-swatches" aria-label="terminal color palette">${Array.from({ length: 8 }, () => "<i></i>").join("")}</span>`
    );
    return `<pre class="terminal-entry terminal-entry--${entry.kind}">${content}</pre>`;
  }).join("");
  output.scrollTop = output.scrollHeight;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

function submitCommand(): void {
  const hadCommand = input.value.trim().length > 0;
  const result = executeCommand(input.value);
  entries = result.clear ? [] : [...entries, ...result.entries];
  input.value = "";
  renderTerminal();
  if (hadCommand) audioDeck.play("stdout");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitCommand();
});

input.addEventListener("keydown", (event) => {
  if (event.key.length === 1 || event.key === "Backspace") audioDeck.play("stdin");
});

document.querySelectorAll<HTMLButtonElement>(".key").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.key!;
    audioDeck.play(key === "ENTER" || key === "ENTER_LOWER" ? "granted" : "stdin");
    button.classList.add("pressed");
    window.setTimeout(() => button.classList.remove("pressed"), 130);
    if (key === "BACK") input.value = input.value.slice(0, -1);
    else if (key === "ENTER" || key === "ENTER_LOWER") submitCommand();
    else if (key === "SPACE") input.value += " ";
    else if (key === "CAPS") { capsLock = !capsLock; button.classList.toggle("latched", capsLock); }
    else if (key === "SHIFT" || key === "SHIFT_RIGHT") { shift = !shift; document.querySelectorAll('[data-key^="SHIFT"]').forEach((node) => node.classList.toggle("latched", shift)); }
    else if (["ESC", "TAB", "CTRL", "CTRL_RIGHT", "FN", "ALT GR", "←", "↓", "↑", "→"].includes(key)) return;
    else {
      const shiftedValue = button.dataset.shift;
      const shouldUppercase = capsLock !== shift;
      input.value += shift && shiftedValue ? shiftedValue : shouldUppercase ? key.toUpperCase() : key.toLowerCase();
      if (shift) { shift = false; document.querySelectorAll('[data-key^="SHIFT"]').forEach((node) => node.classList.remove("latched")); }
    }
    input.focus();
  });
});

document.querySelectorAll<HTMLButtonElement>(".terminal-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    audioDeck.play("folder");
    document.querySelectorAll(".terminal-tabs button").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
  });
});

document.querySelectorAll<HTMLButtonElement>(".file-grid button").forEach((button) => {
  button.addEventListener("click", () => audioDeck.play("folder"));
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
