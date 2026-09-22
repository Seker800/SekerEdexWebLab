import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { compareScreenshotRegion, compareScreenshots, type ScreenshotRegion } from "../src/comparison/visual-comparator.js";
import { loadContract } from "../src/config/contract.js";
import { judgeVisualResult } from "../src/judge/visual-judge.js";
import type { VisualMetrics } from "../src/domain/types.js";

const canonicalRegionDefinitions: Record<string, { selector: string; expectedBounds: ScreenshotRegion }> = {
  system: { selector: ".system-panel", expectedBounds: { x: 9, y: 44, width: 303, height: 669 } },
  terminal: { selector: ".terminal-panel", expectedBounds: { x: 331, y: 44, width: 1265, height: 669 } },
  network: { selector: ".network-panel", expectedBounds: { x: 1614, y: 44, width: 311, height: 669 } },
  filesystem: { selector: ".filesystem-panel", expectedBounds: { x: 9, y: 713, width: 834, height: 375 } },
  keyboard: { selector: ".keyboard-panel", expectedBounds: { x: 842, y: 723, width: 1073, height: 375 } }
};

function assertBounds(name: string, actual: ScreenshotRegion, expected: ScreenshotRegion, tolerance = 4): void {
  for (const field of ["x", "y", "width", "height"] as const) {
    if (Math.abs(actual[field] - expected[field]) > tolerance) {
      throw new Error(`${name} ${field} is ${actual[field]}px; expected ${expected[field]}px ±${tolerance}px`);
    }
  }
}

const artifactDirectory = path.resolve("artifacts/app-verification");
const contract = await loadContract(path.resolve("specs/edex-command-deck.contract.json"));
if (!contract.comparisonRegions || !contract.perceptualComparison) {
  throw new Error("The eDEX scenario must declare formal regions and a perceptual comparison profile");
}
for (const name of Object.keys(canonicalRegionDefinitions)) {
  if (!contract.comparisonRegions[name]) throw new Error(`The eDEX scenario is missing comparison region ${name}`);
}
await mkdir(artifactDirectory, { recursive: true });
const server = await createServer({
  root: path.resolve("apps/clone"),
  server: { host: "127.0.0.1", port: 4174, strictPort: true },
  logLevel: "error"
});

await server.listen();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1934, height: 1094 },
  colorScheme: "dark",
  reducedMotion: "reduce",
  locale: "en-US",
  timezoneId: "UTC",
  deviceScaleFactor: 1
});
const page = await context.newPage();
const consoleErrors: string[] = [];
const pageErrors: string[] = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.addInitScript(() => {
  const state = window as typeof window & { __bootPhases: string[]; __soundCues: string[]; __soundEvents: Array<{ cue: string; volume: number }> };
  state.__bootPhases = [];
  state.__soundCues = [];
  state.__soundEvents = [];
  document.addEventListener("edex:boot-phase", (event) => {
    state.__bootPhases.push((event as CustomEvent<{ phase: string }>).detail.phase);
  });
  document.addEventListener("edex:sound", (event) => {
    const detail = (event as CustomEvent<{ cue: string; volume: number }>).detail;
    state.__soundCues.push(detail.cue);
    state.__soundEvents.push({ cue: detail.cue, volume: detail.volume });
  });
});

try {
  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  await page.locator('[data-phase="gate"]').waitFor();
  if (await page.locator(".boot-gate__eyebrow").textContent() !== "eDEX-UI v2.2.0") {
    throw new Error("Boot gate version does not match the exact screenshot-era source");
  }
  const upstreamLink = page.locator('.boot-gate__source a[href="https://github.com/GitSquared/edex-ui"]');
  if (await upstreamLink.textContent() !== "GitSquared" || await upstreamLink.getAttribute("rel") !== "noreferrer") {
    throw new Error("Boot gate does not expose the original eDEX-UI source attribution");
  }
  if (await page.locator("#edex-globe canvas").count() !== 0) {
    throw new Error("Globe runtime started before the source module initialization stage");
  }
  await page.screenshot({ path: path.join(artifactDirectory, "boot-gate.png"), animations: "disabled", omitBackground: true });
  await page.getByRole("button", { name: "Initialize system" }).click();
  await page.waitForFunction(() => document.querySelector("#boot-log")?.textContent?.includes("Boot Complete") ?? false);
  const bootLogText = await page.locator("#boot-log").textContent() ?? "";
  if (!bootLogText.includes("eDEX-UI Kernel version 2.2.0")) throw new Error("Boot kernel version does not match the exact screenshot-era source");
  if (!bootLogText.includes("<dict ID=")) throw new Error("Boot log did not decode the upstream HTML entities");
  if (bootLogText.includes("&lt;dict")) throw new Error("Boot log rendered encoded entity text instead of the upstream characters");
  await page.screenshot({ path: path.join(artifactDirectory, "boot-log.png"), animations: "disabled", omitBackground: true });
  await page.locator(".boot-title.visible").waitFor({ timeout: 25_000 });
  await page.locator(".boot-title.filled").waitFor({ timeout: 2_000 });
  await page.locator(".boot-title.framed").waitFor({ timeout: 2_000 });
  await page.locator(".boot-title.glitch").waitFor({ timeout: 2_000 });
  await page.locator("#command-deck.reveal-terminal").waitFor({ timeout: 25_000 });
  await page.screenshot({ path: path.join(artifactDirectory, "boot-reveal.png"), omitBackground: true });
  if (await page.locator(".terminal-tabs").isVisible()) throw new Error("Terminal tabs appeared before the upstream terminal initialization stage");
  await page.locator("#command-deck.greeting-visible .terminal-greeting").waitFor({ timeout: 3_000 });
  if (await page.locator(".terminal-greeting").textContent() !== "Welcome back, squared") {
    throw new Error("Boot greeting does not match the canonical source username snapshot");
  }
  if (await page.locator(".terminal-greeting > em").textContent() !== "squared") {
    throw new Error("Boot greeting did not preserve the source username emphasis");
  }
  const fadingGreetingObserved = page.locator("#command-deck.greeting-fading").waitFor({ state: "attached", timeout: 3_000 });
  await page.screenshot({ path: path.join(artifactDirectory, "boot-greeting.png"), omitBackground: true });
  if (await page.locator(".file-grid").isVisible()) throw new Error("Filesystem entries appeared before the upstream filesystem initialization stage");
  await fadingGreetingObserved;
  await page.locator("#command-deck.terminal-ready").waitFor({ timeout: 4_000 });
  await page.screenshot({ path: path.join(artifactDirectory, "boot-terminal-ready.png"), omitBackground: true });
  if (!await page.locator(".terminal-tabs").isVisible()) throw new Error("Terminal tabs did not appear at the upstream terminal initialization stage");
  if (!await page.locator(".file-grid").isVisible()) throw new Error("Filesystem entries did not appear at the upstream filesystem initialization stage");
  await page.locator('html[data-boot-phase="complete"]').waitFor({ timeout: 25_000 });
  await page.locator('#edex-globe[data-globe-ready="true"]').waitFor({ timeout: 5_000 });
  await page.locator('#edex-globe[data-globe-pins-ready="true"]').waitFor({ timeout: 5_000 });
  const frameSample = await page.evaluate(`new Promise(resolve => {
    const frames = 30;
    let observed = 0;
    const startedAt = performance.now();
    const sample = () => {
      observed += 1;
      if (observed >= frames) {
        const elapsedMs = performance.now() - startedAt;
        resolve({ frames, elapsedMs, fps: frames * 1000 / elapsedMs });
      } else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  })`) as { frames: number; elapsedMs: number; fps: number };
  if (frameSample.fps < 30) throw new Error(`Runtime frame sample fell below 30 FPS: ${frameSample.fps.toFixed(1)}`);

  // The fading greeting is a 500 ms source state and can finish while the
  // preceding full-page artifact is being encoded. It was observed live
  // above; reconstruct that observed class after completion for stable visual
  // evidence, following the same rule used for the shorter title states.
  await page.evaluate(() => {
    const deck = document.querySelector<HTMLElement>("#command-deck")!;
    deck.dataset.verifierClassName = deck.className;
    deck.classList.remove("reveal-panels");
    deck.classList.add("greeting-fading");
  });
  await page.screenshot({ path: path.join(artifactDirectory, "boot-greeting-fading.png"), omitBackground: true });
  await page.evaluate(() => {
    const deck = document.querySelector<HTMLElement>("#command-deck")!;
    deck.className = deck.dataset.verifierClassName ?? deck.className;
    delete deck.dataset.verifierClassName;
  });

  // The source title's shortest state lasts 100 ms, which is shorter than a
  // full-page screenshot on some machines. Reconstruct the already-observed
  // CSS states after the live sequence so each named artifact contains the
  // state it claims instead of racing the next transition.
  const captureTitleState = async (name: string, titleClasses: string, grid: boolean): Promise<ScreenshotRegion> => {
    await page.evaluate(({ classes, showGrid }) => {
      const overlay = document.querySelector<HTMLElement>("#boot-overlay")!;
      const title = document.querySelector<HTMLElement>("#boot-title")!;
      overlay.hidden = false;
      overlay.dataset.phase = "title";
      overlay.className = `boot-overlay${showGrid ? " boot-overlay--grid" : ""}`;
      title.className = `boot-title ${classes}`;
    }, { classes: titleClasses, showGrid: grid });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDirectory, name), omitBackground: true });
    const bounds = await page.locator("#boot-title h1").boundingBox();
    if (!bounds) throw new Error(`Boot title bounds were unavailable for ${name}`);
    return bounds;
  };
  const titleStateBounds = {
    outline: await captureTitleState("boot-title-outline.png", "visible", true),
    filled: await captureTitleState("boot-title-filled.png", "visible filled", false),
    framed: await captureTitleState("boot-title-framed.png", "visible framed", false),
    glitch: await captureTitleState("boot-title-glitch.png", "visible glitch", false)
  };
  assertBounds("boot title outline", titleStateBounds.outline, { x: 756, y: 479, width: 422, height: 136 }, 1);
  assertBounds("boot title framed", titleStateBounds.framed, { x: 751, y: 477, width: 432, height: 141 }, 1);
  await page.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>("#boot-overlay")!;
    overlay.hidden = true;
    overlay.dataset.phase = "complete";
    overlay.className = "boot-overlay";
    document.querySelector<HTMLElement>("#boot-title")!.className = "boot-title";
  });

  const bootEvidence = await page.evaluate(() => {
    const state = window as typeof window & { __bootPhases: string[]; __soundCues: string[]; __soundEvents: Array<{ cue: string; volume: number }> };
    return { phases: state.__bootPhases, sounds: state.__soundCues, soundEvents: state.__soundEvents };
  });
  const requiredPhases = ["log", "title", "reveal", "complete"];
  const requiredSounds = ["stdout", "granted", "theme", "expand", "keyboard", "panels", "scan"];
  for (const phase of requiredPhases) {
    if (!bootEvidence.phases.includes(phase)) throw new Error(`Boot phase was not observed: ${phase}`);
  }
  for (const cue of requiredSounds) {
    if (!bootEvidence.sounds.includes(cue)) throw new Error(`Boot sound was not observed: ${cue}`);
  }
  const orderedCueIndexes = ["granted", "theme", "expand", "keyboard", "panels", "scan"].map((cue) => bootEvidence.sounds.indexOf(cue));
  if (orderedCueIndexes.some((index, position) => position > 0 && index <= orderedCueIndexes[position - 1]!)) {
    throw new Error(`Boot sounds did not follow the upstream order: ${bootEvidence.sounds.join(" → ")}`);
  }
  const expectedBootVolumes: Record<string, number> = { stdout: 0.4, granted: 1, theme: 1, expand: 1, keyboard: 1, panels: 1, scan: 1 };
  for (const [cue, expectedVolume] of Object.entries(expectedBootVolumes)) {
    const observed = bootEvidence.soundEvents.find((event) => event.cue === cue)?.volume;
    if (observed !== expectedVolume) throw new Error(`Boot sound ${cue} used volume ${observed ?? "unknown"}; expected ${expectedVolume}`);
  }
  const soundCounts = Object.fromEntries([...new Set(bootEvidence.sounds)].map((cue) => [cue, bootEvidence.sounds.filter((item) => item === cue).length]));
  if ((soundCounts.stdout ?? 0) < 84) throw new Error(`Expected the full boot log sound sequence; observed ${soundCounts.stdout ?? 0} stdout cues`);
  if (soundCounts.panels !== 6) throw new Error(`Expected six staggered panel cues; observed ${soundCounts.panels ?? 0}`);
  const scanCueIndex = bootEvidence.sounds.indexOf("scan");
  const panelCuesBeforeScan = bootEvidence.sounds.slice(0, scanCueIndex).filter((cue) => cue === "panels").length;
  if (panelCuesBeforeScan !== 5) throw new Error(`Expected globe scan after five source panel cues; observed ${panelCuesBeforeScan}`);
  const audioAssets = ["theme", "expand", "keyboard", "panels", "stdin", "stdout", "folder", "granted", "scan", "alarm", "denied", "error", "info"];
  for (const cue of audioAssets) {
    const response = await page.request.get(`http://127.0.0.1:4174/audio/${cue}.wav`);
    if (!response.ok()) throw new Error(`Audio asset is unavailable: ${cue}.wav (${response.status()})`);
  }

  await page.getByRole("button", { name: "SOUND ON" }).click();
  if (await page.getByRole("button", { name: "SOUND OFF" }).getAttribute("aria-pressed") !== "false") {
    throw new Error("Sound control did not enter the muted state");
  }
  await page.getByRole("button", { name: "SOUND OFF" }).click();
  await page.getByRole("button", { name: "REBOOT" }).click();
  await page.locator('[data-phase="log"]').waitFor();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await page.locator('html[data-boot-phase="complete"]').waitFor();

  await page.goto("http://127.0.0.1:4174/?static=1", { waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();

  const regions = [".terminal-panel", ".system-panel", ".network-panel", ".filesystem-panel", ".keyboard-panel"];
  for (const selector of regions) {
    if (!await page.locator(selector).isVisible()) throw new Error(`Required region is not visible: ${selector}`);
  }
  const sourceDrivenState = await page.evaluate(() => {
    const deck = document.querySelector<HTMLElement>("#command-deck");
    return {
      backgroundImage: deck ? getComputedStyle(deck).backgroundImage : "none",
      memoryPoints: document.querySelectorAll("#memory-grid > i").length,
      originalFileIcons: document.querySelectorAll(".file-grid button svg").length,
      powerlinePrompts: document.querySelectorAll(".terminal-powerline").length,
      plainTextPowerlinePrompts: [...document.querySelectorAll(".terminal-powerline")].filter((element) =>
        element.childElementCount === 0
        && element.childNodes.length === 1
        && element.firstChild?.nodeType === Node.TEXT_NODE
      ).length,
      sourceFilesystemScrollbars: document.querySelectorAll(".filesystem-source-scrollbar").length,
      globeCanvas: document.querySelectorAll("#edex-globe canvas").length,
      leftBootModules: document.querySelectorAll(".system-panel [data-boot-module]").length,
      rightBootModules: document.querySelectorAll(".network-panel [data-boot-module]").length
    };
  });
  if ((sourceDrivenState.backgroundImage.match(/linear-gradient/g) ?? []).length !== 2) {
    throw new Error(`Canonical background grid is missing: ${sourceDrivenState.backgroundImage}`);
  }
  if (sourceDrivenState.memoryPoints !== 440) throw new Error(`Expected 440 canonical memory points; observed ${sourceDrivenState.memoryPoints}`);
  if (sourceDrivenState.originalFileIcons !== 22) throw new Error(`Expected 22 upstream file icons; observed ${sourceDrivenState.originalFileIcons}`);
  if (sourceDrivenState.powerlinePrompts !== 2) throw new Error(`Expected two source Powerline prompt segments; observed ${sourceDrivenState.powerlinePrompts}`);
  if (sourceDrivenState.plainTextPowerlinePrompts !== 2) {
    throw new Error(`Expected both Powerline prompts to contain one direct path text node; observed ${sourceDrivenState.plainTextPowerlinePrompts}`);
  }
  if (sourceDrivenState.sourceFilesystemScrollbars !== 1) throw new Error(`Expected the Electron source filesystem scrollbar compatibility layer; observed ${sourceDrivenState.sourceFilesystemScrollbars}`);
  if (sourceDrivenState.globeCanvas !== 1) throw new Error(`Expected one upstream ENCOM globe canvas; observed ${sourceDrivenState.globeCanvas}`);
  if (sourceDrivenState.leftBootModules !== 6) throw new Error(`Expected six upstream left boot modules; observed ${sourceDrivenState.leftBootModules}`);
  if (sourceDrivenState.rightBootModules !== 3) throw new Error(`Expected three upstream right boot modules; observed ${sourceDrivenState.rightBootModules}`);
  if (Number.parseFloat(await page.locator(".deck-controls").evaluate((node) => getComputedStyle(node).opacity)) <= 0) {
    throw new Error("Runtime sound and reboot controls are not persistently visible");
  }

  const terminalInput = page.locator("#terminal-input");
  await terminalInput.fill("status");
  await terminalInput.press("Enter");
  await page.getByText("INPUT MATRIX READY", { exact: false }).waitFor();
  await terminalInput.fill("");
  const physicalHKey = page.locator('[data-key="H"]');
  await page.locator(".terminal-tabs button").nth(1).focus();
  if (await page.evaluate(() => document.activeElement?.id === "terminal-input")) {
    throw new Error("Deck control focus did not exercise global physical keyboard capture");
  }
  await page.keyboard.down("h");
  if (!await physicalHKey.evaluate((node) => node.classList.contains("pressed"))) {
    throw new Error("Physical keyboard input did not light the matching on-screen key");
  }
  if (await terminalInput.inputValue() !== "h") {
    throw new Error("Physical keyboard input was not routed to the terminal after focus left the input");
  }
  await page.keyboard.up("h");
  if (!await physicalHKey.evaluate((node) => node.classList.contains("blink"))) {
    throw new Error("Physical keyboard release did not blink the matching on-screen key");
  }
  await page.waitForTimeout(120);
  if (await physicalHKey.evaluate((node) => node.classList.contains("pressed") || node.classList.contains("blink"))) {
    throw new Error("Physical keyboard feedback did not settle after the source release interval");
  }
  await page.keyboard.type("elp");
  if (await terminalInput.inputValue() !== "help") throw new Error("Physical keyboard text did not remain in the terminal input");
  await terminalInput.press("Enter");
  await page.getByText("AVAILABLE COMMANDS", { exact: false }).last().waitFor();
  await page.locator("#terminal-output").click({ position: { x: 40, y: 40 } });
  if (!await page.evaluate(() => document.activeElement?.id === "terminal-input")) {
    throw new Error("Clicking the terminal output did not restore terminal focus");
  }
  await terminalInput.fill("cancel-physical");
  await terminalInput.press("Control+c");
  if (await terminalInput.inputValue() !== "") throw new Error("Physical Ctrl+C did not clear the active terminal draft");
  await terminalInput.fill("cancel-escape");
  await terminalInput.press("Escape");
  if (await terminalInput.inputValue() !== "") throw new Error("Physical Escape did not clear the active terminal draft");
  await terminalInput.fill("");
  for (const key of ["H", "E", "L", "P"]) await page.locator(`[data-key="${key}"]`).click();
  await page.locator('[data-key="ENTER"]').click();
  await page.getByText("AVAILABLE COMMANDS", { exact: false }).last().waitFor();
  await page.locator('[data-key="CTRL"]').click();
  await page.locator('[data-key="TAB"]').click();
  if (await page.locator(".terminal-tabs button").nth(1).textContent() !== "EMPTY") {
    throw new Error("On-screen Ctrl+Tab created an empty terminal session instead of cycling existing sessions");
  }
  await terminalInput.fill("cancel-screen-keyboard");
  await page.locator('[data-key="CTRL"]').click();
  await page.locator('[data-key="C"]').click();
  if (await terminalInput.inputValue() !== "") throw new Error("On-screen Ctrl+C did not clear the active terminal draft");
  await terminalInput.fill("repeat");
  const backspaceKey = page.locator('[data-key="BACK"]');
  const backspaceBounds = await backspaceKey.boundingBox();
  if (!backspaceBounds) throw new Error("Could not measure the on-screen Backspace key");
  await page.mouse.move(backspaceBounds.x + backspaceBounds.width / 2, backspaceBounds.y + backspaceBounds.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  if ((await terminalInput.inputValue()).length >= 4) throw new Error("Holding on-screen Backspace did not repeat at the upstream cadence");
  await terminalInput.fill("");
  await terminalInput.fill("st");
  await page.locator('[data-key="TAB"]').click();
  if (await terminalInput.inputValue() !== "status") throw new Error("On-screen Tab did not complete a terminal command");
  await terminalInput.fill("cd Loc");
  await terminalInput.press("Tab");
  if (await terminalInput.inputValue() !== "cd 'Local Storage/'") throw new Error("Terminal completion did not quote a path containing spaces");
  await terminalInput.press("Enter");
  if (!await page.locator(".section-label small").textContent().then((value) => value?.endsWith("/Local Storage"))) {
    throw new Error("Quoted path completion did not produce an executable directory command");
  }
  await terminalInput.fill("cd ..");
  await terminalInput.press("Enter");
  await terminalInput.fill("x".repeat(180));
  const longDraftBounds = await page.evaluate(() => ({
    cursorRight: document.querySelector<HTMLElement>(".cursor")!.getBoundingClientRect().right,
    latencyLeft: document.querySelector<HTMLElement>("#latency")!.getBoundingClientRect().left,
    inputLeft: document.querySelector<HTMLInputElement>("#terminal-input")!.getBoundingClientRect().left,
    panelLeft: document.querySelector<HTMLElement>(".terminal-panel")!.getBoundingClientRect().left
  }));
  if (longDraftBounds.cursorRight > longDraftBounds.latencyLeft || longDraftBounds.inputLeft < longDraftBounds.panelLeft) {
    throw new Error(`Long terminal draft escaped its input region: ${JSON.stringify(longDraftBounds)}`);
  }
  await terminalInput.fill("");
  await terminalInput.fill("theme");
  await terminalInput.press("Enter");
  await page.getByText("ACTIVE THEME  tron", { exact: false }).waitFor();
  if (await page.locator("html").getAttribute("data-last-sound") !== "info") throw new Error("Theme inspection did not emit informational feedback");
  await terminalInput.fill("theme blade");
  await terminalInput.press("Enter");
  await page.getByText("locked to the canonical tron theme", { exact: false }).waitFor();
  if (await page.locator("html").getAttribute("data-last-sound") !== "denied") throw new Error("Rejected theme did not emit denied feedback");
  await terminalInput.fill("definitely-not-a-command");
  await terminalInput.press("Enter");
  if (await page.locator("html").getAttribute("data-last-sound") !== "error") throw new Error("Invalid command did not emit error feedback");
  await terminalInput.fill("");
  await terminalInput.press("Tab");
  if (await page.evaluate(() => document.activeElement?.id === "terminal-input")) throw new Error("Empty terminal input trapped keyboard focus");
  await terminalInput.focus();
  await terminalInput.fill("echo primary-session");
  await terminalInput.press("Enter");
  const secondTerminalTab = page.locator(".terminal-tabs button").nth(1);
  await secondTerminalTab.click();
  if (!await secondTerminalTab.evaluate((node) => node.classList.contains("active"))) {
    throw new Error("Terminal tab did not activate");
  }
  if (await secondTerminalTab.textContent() !== "#2 - SHELL") throw new Error("Empty terminal tab did not become a session");
  if (await page.locator("#terminal-output").textContent().then((content) => content?.includes("primary-session"))) {
    throw new Error("Terminal output leaked into a newly created session");
  }
  await terminalInput.fill("echo secondary-session");
  await terminalInput.press("Enter");
  await terminalInput.press("ArrowUp");
  if (await terminalInput.inputValue() !== "echo secondary-session") throw new Error("Terminal history did not restore the active session command");
  await page.locator('.file-grid button[data-file-name="themes"]').click();
  if (!await page.locator(".section-label small").textContent().then((value) => value?.endsWith("/themes"))) {
    throw new Error("Filesystem navigation did not update the active terminal directory");
  }
  await page.locator('.file-grid button[data-file-name="tron.json"]').click();
  if (!await page.locator("#terminal-output").textContent().then((value) => value?.includes("THEME tron ACTIVE"))) throw new Error("Canonical theme file did not invoke its upstream special action");
  if (await terminalInput.inputValue() !== "echo secondary-session") throw new Error("Theme file was inserted as a generic terminal path");
  await page.locator('.file-grid button[data-file-name="tron-disrupted.json"]').click();
  if (await page.locator("html").getAttribute("data-last-sound") !== "denied") throw new Error("Noncanonical theme file did not emit denied feedback");
  await page.locator('.file-grid button[data-file-name="Go up"]').click();
  await page.locator('.file-grid button[data-file-name="keyboards"]').click();
  await page.locator('.file-grid button[data-file-name="en-US.json"]').click();
  if (!await page.locator("#terminal-output").textContent().then((value) => value?.includes("KEYBOARD en-US ACTIVE"))) throw new Error("Keyboard layout file did not invoke its upstream special action");
  await page.locator('.file-grid button[data-file-name="Go up"]').click();
  await page.locator('.file-grid button[data-file-name="Show disks"]').click();
  if (await page.locator('.file-grid button[data-file-name="Home sandbox"]').count() !== 1) {
    throw new Error("Filesystem disk view did not expose the browser sandbox");
  }
  await page.locator('.file-grid button[data-file-name="Home sandbox"]').click();
  if (await page.locator(".section-label small").textContent() !== "/home/squared") {
    throw new Error("Filesystem disk selection did not return to the sandbox root");
  }
  await page.locator(".terminal-tabs button").first().click();
  const mainSessionText = await page.locator("#terminal-output").textContent();
  if (!mainSessionText?.includes("primary-session") || mainSessionText.includes("secondary-session")) {
    throw new Error("Terminal sessions did not preserve independent output");
  }
  await secondTerminalTab.focus();
  await secondTerminalTab.press("ArrowLeft");
  if (!await page.locator(".terminal-tabs button").first().evaluate((node) => node.classList.contains("active"))) {
    throw new Error("Terminal tablist did not support keyboard arrow navigation");
  }
  await page.locator('[data-key="CTRL"]').click();
  await page.locator('[data-key="2"]').click();
  if (!await secondTerminalTab.evaluate((node) => node.classList.contains("active"))) {
    throw new Error("On-screen Ctrl+number did not switch terminal sessions");
  }
  await page.locator('[data-key="CTRL"]').click();
  await page.locator('[data-key="1"]').click();

  for (let index = 0; index < 24; index += 1) {
    await terminalInput.fill(`echo overflow-${String(index).padStart(2, "0")}`);
    await terminalInput.press("Enter");
  }
  const terminalFlowBounds = await page.evaluate(() => {
    const output = document.querySelector<HTMLElement>("#terminal-output")!;
    const prompt = document.querySelector<HTMLElement>(".terminal-prompt")!;
    const entries = output.querySelectorAll<HTMLElement>(".terminal-entry");
    const lastEntry = entries.item(entries.length - 1);
    return {
      outputBottom: output.getBoundingClientRect().bottom,
      promptTop: prompt.getBoundingClientRect().top,
      lastEntryBottom: lastEntry.getBoundingClientRect().bottom,
      overflowed: output.scrollHeight > output.clientHeight
    };
  });
  if (!terminalFlowBounds.overflowed) throw new Error("Terminal overflow regression did not exercise a scrolling output buffer");
  if (terminalFlowBounds.outputBottom > terminalFlowBounds.promptTop) {
    throw new Error(`Terminal output viewport overlaps the prompt: ${JSON.stringify(terminalFlowBounds)}`);
  }
  if (terminalFlowBounds.lastEntryBottom > terminalFlowBounds.promptTop) {
    throw new Error(`Terminal output text overlaps the prompt: ${JSON.stringify(terminalFlowBounds)}`);
  }
  await page.screenshot({ path: path.join(artifactDirectory, "terminal-overflow.png"), animations: "disabled", omitBackground: true });

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  const canonicalBounds: Record<string, ScreenshotRegion> = {};
  for (const [name, definition] of Object.entries(canonicalRegionDefinitions)) {
    const box = await page.locator(definition.selector).boundingBox();
    if (!box) throw new Error(`Could not measure canonical region: ${name}`);
    canonicalBounds[name] = box;
    assertBounds(name, box, definition.expectedBounds);
  }
  await page.screenshot({ path: path.join(artifactDirectory, "command-deck.png"), animations: "disabled", omitBackground: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  await page.locator("#boot-overlay").waitFor({ state: "hidden" });
  for (const selector of regions) {
    if (!await page.locator(selector).isVisible()) throw new Error(`Required region is not visible at 1280x800: ${selector}`);
  }
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > window.innerWidth,
    vertical: document.documentElement.scrollHeight > window.innerHeight
  }));
  if (overflow.horizontal || overflow.vertical) throw new Error(`Responsive viewport overflowed: ${JSON.stringify(overflow)}`);
  await page.screenshot({ path: path.join(artifactDirectory, "command-deck-1280x800.png"), animations: "disabled", omitBackground: true });
  const compactStageBounds = await page.locator(".canvas-stage").boundingBox();
  if (!compactStageBounds) throw new Error("Could not measure the 1280x800 canvas stage");
  assertBounds("1280x800 canvas stage", compactStageBounds, { x: 0, y: 40, width: 1280, height: 720 }, 1);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  await page.locator("#boot-overlay").waitFor({ state: "hidden" });
  const fullHdStageBounds = await page.locator(".canvas-stage").boundingBox();
  if (!fullHdStageBounds) throw new Error("Could not measure the 1920x1080 canvas stage");
  assertBounds("1920x1080 canvas stage", fullHdStageBounds, { x: 0, y: 0, width: 1920, height: 1080 }, 1);
  const fullHdRegionBounds: Record<string, ScreenshotRegion> = {};
  for (const [name, definition] of Object.entries(canonicalRegionDefinitions)) {
    const box = await page.locator(definition.selector).boundingBox();
    if (!box) throw new Error(`1920x1080 desktop viewport dropped canonical region: ${name}`);
    fullHdRegionBounds[name] = box;
  }
  await page.screenshot({ path: path.join(artifactDirectory, "command-deck-1920x1080.png"), animations: "disabled", omitBackground: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  await page.locator("#boot-overlay").waitFor({ state: "hidden" });
  const letterboxStageBounds = await page.locator(".canvas-stage").boundingBox();
  if (!letterboxStageBounds) throw new Error("Could not measure the 1440x900 canvas stage");
  assertBounds("1440x900 canvas stage", letterboxStageBounds, { x: 0, y: 45, width: 1440, height: 810 }, 1);
  await page.screenshot({ path: path.join(artifactDirectory, "command-deck-1440x900.png"), animations: "disabled", omitBackground: true });
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  await page.locator("#boot-overlay").waitFor({ state: "hidden" });
  const squareDesktopStageBounds = await page.locator(".canvas-stage").boundingBox();
  if (!squareDesktopStageBounds) throw new Error("Could not measure the 1024x1024 desktop canvas stage");
  assertBounds("1024x1024 desktop canvas stage", squareDesktopStageBounds, { x: 0, y: 224, width: 1024, height: 576 }, 1);
  const squareDesktopScale = 1024 / 1920;
  for (const [name, definition] of Object.entries(canonicalRegionDefinitions)) {
    const box = await page.locator(definition.selector).boundingBox();
    if (!box) throw new Error(`1024x1024 desktop viewport dropped canonical region: ${name}`);
    const fullHdBounds = fullHdRegionBounds[name];
    if (!fullHdBounds) throw new Error(`1920x1080 desktop baseline is missing canonical region: ${name}`);
    assertBounds(`1024x1024 ${name}`, box, {
      x: fullHdBounds.x * squareDesktopScale,
      y: 224 + fullHdBounds.y * squareDesktopScale,
      width: fullHdBounds.width * squareDesktopScale,
      height: fullHdBounds.height * squareDesktopScale
    }, 3);
  }
  await page.screenshot({ path: path.join(artifactDirectory, "command-deck-1024x1024.png"), animations: "disabled", omitBackground: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  await page.locator("#boot-overlay").waitFor({ state: "hidden" });
  if (!await page.locator(".terminal-panel").isVisible()) throw new Error("Mobile terminal mode did not retain the terminal");
  for (const selector of [".system-panel", ".network-panel", ".filesystem-panel", ".keyboard-panel"]) {
    if (await page.locator(selector).isVisible()) throw new Error(`Mobile terminal mode retained desktop-only region: ${selector}`);
  }
  const mobileState = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    verticalOverflow: document.documentElement.scrollHeight > innerHeight,
    cursorAnimation: getComputedStyle(document.querySelector(".cursor")!).animationName,
    terminalOutputFits: document.querySelector<HTMLElement>("#terminal-output")!.scrollWidth <= document.querySelector<HTMLElement>("#terminal-output")!.clientWidth,
    terminalInputFontSize: Number.parseFloat(getComputedStyle(document.querySelector<HTMLInputElement>("#terminal-input")!).fontSize),
    terminalPromptHeight: document.querySelector<HTMLElement>(".terminal-prompt")!.getBoundingClientRect().height
  }));
  if (mobileState.horizontalOverflow || mobileState.verticalOverflow) throw new Error(`Mobile terminal mode overflowed: ${JSON.stringify(mobileState)}`);
  if (mobileState.cursorAnimation !== "none") throw new Error(`Reduced motion left cursor animation active: ${mobileState.cursorAnimation}`);
  if (!mobileState.terminalOutputFits) throw new Error(`Mobile terminal content is horizontally clipped: ${JSON.stringify(mobileState)}`);
  if (mobileState.terminalInputFontSize < 16) throw new Error(`Mobile terminal input font is too small for iOS focus without zoom: ${JSON.stringify(mobileState)}`);
  if (mobileState.terminalPromptHeight < 44) throw new Error(`Mobile terminal prompt is smaller than a reliable touch target: ${JSON.stringify(mobileState)}`);
  await page.locator("#terminal-input").fill("help");
  await page.locator("#terminal-input").press("Enter");
  await page.getByText("AVAILABLE COMMANDS", { exact: false }).waitFor();
  await page.setViewportSize({ width: 390, height: 500 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const mobileKeyboardViewportState = await page.evaluate(() => {
    const prompt = document.querySelector<HTMLElement>(".terminal-prompt")!.getBoundingClientRect();
    return {
      viewportHeight: innerHeight,
      promptTop: prompt.top,
      promptBottom: prompt.bottom,
      visible: prompt.top >= 0 && prompt.bottom <= innerHeight
    };
  });
  if (!mobileKeyboardViewportState.visible) throw new Error(`Mobile terminal prompt left the resized visual viewport: ${JSON.stringify(mobileKeyboardViewportState)}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(artifactDirectory, "command-deck-mobile.png"), animations: "disabled", omitBackground: true });
  await page.setViewportSize({ width: 1934, height: 1094 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  await page.locator("#boot-overlay").waitFor({ state: "hidden" });
  const touchContext = await browser.newContext({
    viewport: { width: 1934, height: 1094 },
    colorScheme: "dark",
    reducedMotion: "reduce",
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1
  });
  const touchPage = await touchContext.newPage();
  touchPage.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`touch: ${message.text()}`); });
  touchPage.on("pageerror", (error) => pageErrors.push(`touch: ${error.message}`));
  await touchPage.goto("http://127.0.0.1:4174/?static=1", { waitUntil: "networkidle" });
  await touchPage.locator("[data-ready]").waitFor();
  for (const key of ["H", "E", "L", "P"]) await touchPage.locator(`[data-key="${key}"]`).tap();
  await touchPage.locator('[data-key="ENTER"]').tap();
  await touchPage.getByText("AVAILABLE COMMANDS", { exact: false }).waitFor();
  await touchContext.close();
  const mobileTouchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
    reducedMotion: "reduce",
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2
  });
  const mobileTouchPage = await mobileTouchContext.newPage();
  mobileTouchPage.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`mobile-touch: ${message.text()}`); });
  mobileTouchPage.on("pageerror", (error) => pageErrors.push(`mobile-touch: ${error.message}`));
  await mobileTouchPage.goto("http://127.0.0.1:4174/?static=1", { waitUntil: "networkidle" });
  await mobileTouchPage.locator("[data-ready]").waitFor();
  const mobileTouchInput = mobileTouchPage.locator("#terminal-input");
  await mobileTouchInput.tap();
  await mobileTouchInput.fill("status");
  await mobileTouchInput.press("Enter");
  await mobileTouchPage.getByText("CORE ONLINE", { exact: false }).waitFor();
  for (const controlName of ["TERMINAL", "FILES", "REBOOT", "SOUND ON"]) {
    const bounds = await mobileTouchPage.getByRole("button", { name: controlName }).boundingBox();
    if (!bounds || bounds.height < 44 || bounds.width < 44) throw new Error(`Mobile ${controlName} control is not touch-sized: ${JSON.stringify(bounds)}`);
  }
  await mobileTouchPage.screenshot({ path: path.join(artifactDirectory, "command-deck-mobile-touch.png"), animations: "disabled", omitBackground: true });
  const mobileFilesControl = mobileTouchPage.locator("#mobile-files-view");
  await mobileFilesControl.tap();
  if (!await mobileTouchPage.locator(".filesystem-panel").isVisible()) throw new Error("Mobile FILES control did not reveal the shared filesystem panel");
  if (await mobileTouchPage.locator(".terminal-panel").isVisible()) throw new Error("Mobile FILES view retained the terminal panel");
  if (await mobileFilesControl.getAttribute("aria-pressed") !== "true") throw new Error("Mobile FILES control did not expose its selected state");
  const mobileHomeBounds = await mobileTouchPage.locator("#mobile-files-home").boundingBox();
  if (!mobileHomeBounds || mobileHomeBounds.height < 44 || mobileHomeBounds.width < 44) throw new Error(`Mobile HOME control is not touch-sized: ${JSON.stringify(mobileHomeBounds)}`);
  await mobileTouchPage.locator('.file-grid button[data-file-name="themes"]').tap();
  await mobileTouchPage.locator('.file-grid button[data-file-name="tron.json"]').waitFor();
  const mobileFilesystemPath = await mobileTouchPage.locator(".filesystem-panel .section-label small").textContent();
  if (mobileFilesystemPath !== "/home/squared/.config/eDEX-UI/themes") throw new Error(`Mobile filesystem navigation did not preserve the shared cwd: ${mobileFilesystemPath}`);
  await mobileTouchPage.screenshot({ path: path.join(artifactDirectory, "command-deck-mobile-files.png"), animations: "disabled", omitBackground: true });
  const mobileTerminalControl = mobileTouchPage.locator("#mobile-terminal-view");
  await mobileTerminalControl.tap();
  if (!await mobileTouchPage.locator(".terminal-panel").isVisible()) throw new Error("Mobile TERMINAL control did not restore the terminal panel");
  if (await mobileTouchPage.locator(".filesystem-panel").isVisible()) throw new Error("Mobile TERMINAL view retained the filesystem panel");
  if (await mobileTouchPage.locator(".terminal-prompt .terminal-powerline").textContent() !== "~/.c/eDEX-UI/themes") {
    throw new Error("Mobile terminal did not retain the directory selected through the shared filesystem panel");
  }
  await mobileTouchContext.close();
  const mobileLandscapeContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    screen: { width: 844, height: 390 },
    colorScheme: "dark",
    reducedMotion: "reduce",
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2
  });
  const mobileLandscapePage = await mobileLandscapeContext.newPage();
  mobileLandscapePage.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`mobile-landscape: ${message.text()}`); });
  mobileLandscapePage.on("pageerror", (error) => pageErrors.push(`mobile-landscape: ${error.message}`));
  await mobileLandscapePage.goto("http://127.0.0.1:4174/?static=1", { waitUntil: "networkidle" });
  await mobileLandscapePage.locator("[data-ready]").waitFor();
  const mobileLandscapeState = await mobileLandscapePage.evaluate(() => {
    const terminal = document.querySelector<HTMLElement>(".terminal-panel")!.getBoundingClientRect();
    return {
      terminalLeft: terminal.left,
      terminalRight: terminal.right,
      terminalInputFontSize: Number.parseFloat(getComputedStyle(document.querySelector<HTMLInputElement>("#terminal-input")!).fontSize),
      terminalPromptHeight: document.querySelector<HTMLElement>(".terminal-prompt")!.getBoundingClientRect().height,
      desktopPanelVisible: getComputedStyle(document.querySelector<HTMLElement>(".system-panel")!).display !== "none"
    };
  });
  if (mobileLandscapeState.desktopPanelVisible || mobileLandscapeState.terminalLeft < 0 || mobileLandscapeState.terminalRight > 844 || mobileLandscapeState.terminalInputFontSize < 16 || mobileLandscapeState.terminalPromptHeight < 44) {
    throw new Error(`Mobile landscape did not retain the dedicated touch terminal mode: ${JSON.stringify(mobileLandscapeState)}`);
  }
  await mobileLandscapePage.locator("#mobile-files-view").tap();
  const mobileLandscapeFiles = await mobileLandscapePage.locator(".filesystem-panel").boundingBox();
  const mobileLandscapeFileButton = await mobileLandscapePage.locator(".file-grid button").first().boundingBox();
  if (!mobileLandscapeFiles || mobileLandscapeFiles.x < 0 || mobileLandscapeFiles.x + mobileLandscapeFiles.width > 844 || !mobileLandscapeFileButton || mobileLandscapeFileButton.height < 44) {
    throw new Error(`Mobile landscape filesystem is not touch-usable: ${JSON.stringify({ panel: mobileLandscapeFiles, fileButton: mobileLandscapeFileButton })}`);
  }
  await mobileLandscapePage.locator("#mobile-terminal-view").tap();
  await mobileLandscapePage.screenshot({ path: path.join(artifactDirectory, "command-deck-mobile-landscape.png"), animations: "disabled", omitBackground: true });
  await mobileLandscapeContext.close();
  const motionContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: "dark",
    reducedMotion: "no-preference",
    deviceScaleFactor: 1
  });
  const motionPage = await motionContext.newPage();
  await motionPage.bringToFront();
  motionPage.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`motion: ${message.text()}`); });
  motionPage.on("pageerror", (error) => pageErrors.push(`motion: ${error.message}`));
  await motionPage.addInitScript(() => {
    const state = window as typeof window & { __motionSoundCues?: string[] };
    state.__motionSoundCues = [];
    document.addEventListener("edex:sound", (event) => {
      state.__motionSoundCues?.push((event as CustomEvent<{ cue: string }>).detail.cue);
    });
  });
  await motionPage.goto("http://127.0.0.1:4174/?fastboot=1", { waitUntil: "networkidle" });
  await motionPage.getByRole("button", { name: "Initialize system" }).click();
  await motionPage.locator('html[data-boot-phase="complete"]').waitFor({ timeout: 10_000 });
  const motionBefore = await motionPage.evaluate(() => ({
    clock: document.querySelector("#deck-clock")?.textContent,
    telemetryTick: Number(document.documentElement.dataset.telemetryTick ?? 0),
    cursorAnimation: getComputedStyle(document.querySelector(".cursor")!).animationName,
    cursorDuration: getComputedStyle(document.querySelector(".cursor")!).animationDuration,
    transientKeys: document.querySelectorAll(".key.pressed, .key.blink").length
  }));
  await motionPage.waitForTimeout(1_600);
  const motionAfter = await motionPage.evaluate(() => ({
    clock: document.querySelector("#deck-clock")?.textContent,
    telemetryTick: Number(document.documentElement.dataset.telemetryTick ?? 0),
    transientKeys: document.querySelectorAll(".key.pressed, .key.blink").length
  }));
  if (motionBefore.cursorAnimation !== "cursor-blink" || motionBefore.cursorDuration !== "1s") {
    throw new Error(`Normal-motion cursor cadence is incorrect: ${JSON.stringify(motionBefore)}`);
  }
  if (motionAfter.telemetryTick <= motionBefore.telemetryTick || motionAfter.clock === motionBefore.clock) {
    throw new Error(`Runtime indicators did not advance at independent cadences: ${JSON.stringify({ motionBefore, motionAfter })}`);
  }
  if (motionBefore.transientKeys !== 0 || motionAfter.transientKeys !== 0) throw new Error("Idle keyboard retained high-frequency transient feedback");
  if (!await motionPage.locator(".section-label small").textContent().then((value) => value?.endsWith("/Blog"))) {
    throw new Error("Runtime filesystem did not start in the blog content root");
  }
  const contentTerminalInput = motionPage.locator("#terminal-input");
  await contentTerminalInput.fill("cd ..");
  await contentTerminalInput.press("Enter");
  if (motionPage.url().includes("#/blog/") || await motionPage.locator(".section-label small").textContent() !== "/home/squared") {
    throw new Error(`Leaving Blog did not expose the sandbox root state: ${motionPage.url()}`);
  }
  await contentTerminalInput.fill("cd Blog");
  await contentTerminalInput.press("Enter");
  await motionPage.goBack({ waitUntil: "networkidle" });
  if (motionPage.url().includes("#/blog/") || await motionPage.locator(".section-label small").textContent() !== "/home/squared") {
    throw new Error(`Browser back did not restore the non-content filesystem state: ${motionPage.url()}`);
  }
  await motionPage.goForward({ waitUntil: "networkidle" });
  if (!motionPage.url().endsWith("#/blog/") || !await motionPage.locator(".section-label small").textContent().then((value) => value?.endsWith("/Blog"))) {
    throw new Error(`Browser forward did not restore the content root: ${motionPage.url()}`);
  }
  await contentTerminalInput.fill("cd posts");
  await contentTerminalInput.press("Enter");
  if (!motionPage.url().endsWith("#/blog/posts")) throw new Error(`Terminal navigation did not update the content hash: ${motionPage.url()}`);
  await contentTerminalInput.fill("cat welcome.md");
  await contentTerminalInput.press("Enter");
  if (!await motionPage.locator("#terminal-output").textContent().then((value) => value?.includes("# Welcome to the command deck"))) {
    throw new Error("Terminal could not read the real Markdown content file");
  }
  const historyLengthBeforeMissingContent = await motionPage.evaluate(() => window.history.length);
  await motionPage.evaluate(() => { window.location.hash = "#/blog/posts/missing.md"; });
  await motionPage.waitForFunction(() => window.location.hash === "#/blog/");
  const historyLengthAfterMissingContent = await motionPage.evaluate(() => window.history.length);
  if (historyLengthAfterMissingContent !== historyLengthBeforeMissingContent + 1) {
    throw new Error(`Missing content recovery polluted browser history: ${historyLengthBeforeMissingContent} → ${historyLengthAfterMissingContent}`);
  }
  await motionPage.goBack({ waitUntil: "networkidle" });
  if (!motionPage.url().endsWith("#/blog/posts") || !await motionPage.locator(".section-label small").textContent().then((value) => value?.endsWith("/Blog/posts"))) {
    throw new Error(`Browser back did not escape a missing content URL: ${motionPage.url()}`);
  }
  await contentTerminalInput.fill("cd ..");
  await contentTerminalInput.press("Enter");
  if (!motionPage.url().endsWith("#/blog/")) throw new Error(`Terminal navigation did not restore the content root hash: ${motionPage.url()}`);
  await motionPage.locator('.file-grid button[data-file-name="posts"]').click();
  if (await motionPage.locator('.file-grid button[data-file-name="welcome.md"]').getAttribute("data-icon") !== "markdown") {
    throw new Error("Markdown content did not render its document-specific icon");
  }
  await motionPage.locator('.file-grid button[data-file-name="welcome.md"]').click();
  if (!await motionPage.locator("#content-reader").isVisible()) throw new Error("Markdown file did not open the central article reader");
  if (await motionPage.locator("#content-reader-title").textContent() !== "Welcome to the command deck") throw new Error("Article reader did not render typed document metadata");
  await motionPage.locator("#content-reader-body").getByText("Select a folder", { exact: false }).waitFor();
  if (!await motionPage.locator("#content-reader-body").textContent().then((value) => value?.includes("Select a folder"))) throw new Error("Article reader did not render Markdown content");
  if (!motionPage.url().endsWith("#/blog/posts/welcome.md")) throw new Error(`Article navigation did not update the content hash: ${motionPage.url()}`);
  await motionPage.locator("#content-reader-body").evaluate((body) => {
    const link = document.createElement("a");
    link.href = "#verification-anchor";
    link.dataset.contentAnchor = "verification-anchor";
    link.textContent = "Verification anchor";
    const heading = document.createElement("h2");
    heading.id = "verification-anchor";
    heading.tabIndex = -1;
    heading.textContent = "Verification destination";
    body.prepend(link, heading);
  });
  await motionPage.getByRole("link", { name: "Verification anchor" }).click();
  if (!motionPage.url().endsWith("#/blog/posts/welcome.md") || await motionPage.evaluate(() => document.activeElement?.id) !== "verification-anchor") {
    throw new Error(`Article anchor escaped the reader's content route: ${motionPage.url()}`);
  }
  const articleOverlayState = await motionPage.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>("#content-overlay");
    const stage = document.querySelector<HTMLElement>(".canvas-stage")!;
    const deck = document.querySelector<HTMLElement>("#command-deck")!;
    const close = document.querySelector<HTMLButtonElement>("#content-overlay-close");
    if (!overlay || !close) return null;
    const overlayBounds = overlay.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    return {
      parentIsStage: overlay.parentElement === stage,
      role: overlay.getAttribute("role"),
      ariaModal: overlay.getAttribute("aria-modal"),
      deckInert: deck.inert,
      deckAriaHidden: deck.getAttribute("aria-hidden"),
      articleIsActive: overlay.dataset.contentView === "document",
      overlayBounds: { x: overlayBounds.x, y: overlayBounds.y, width: overlayBounds.width, height: overlayBounds.height },
      stageBounds: { x: stageBounds.x, y: stageBounds.y, width: stageBounds.width, height: stageBounds.height },
      fillsStage: Math.abs(overlayBounds.left - stageBounds.left) < 1
        && Math.abs(overlayBounds.top - stageBounds.top) < 1
        && Math.abs(overlayBounds.width - stageBounds.width) < 1
        && Math.abs(overlayBounds.height - stageBounds.height) < 1
    };
  });
  if (!articleOverlayState?.parentIsStage || articleOverlayState.role !== "dialog" || articleOverlayState.ariaModal !== "true"
    || !articleOverlayState.deckInert || articleOverlayState.deckAriaHidden !== "true"
    || !articleOverlayState.articleIsActive || !articleOverlayState.fillsStage) {
    throw new Error(`Article did not use the shared fullscreen content overlay: ${JSON.stringify(articleOverlayState)}`);
  }
  await motionPage.setViewportSize({ width: 1440, height: 900 });
  const letterboxedContentBounds = await motionPage.evaluate(() => {
    const overlay = document.querySelector<HTMLElement>("#content-overlay")!.getBoundingClientRect();
    const stage = document.querySelector<HTMLElement>(".canvas-stage")!.getBoundingClientRect();
    return {
      overlay: { x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height },
      stage: { x: stage.x, y: stage.y, width: stage.width, height: stage.height }
    };
  });
  if (JSON.stringify(letterboxedContentBounds.overlay) !== JSON.stringify(letterboxedContentBounds.stage)
    || letterboxedContentBounds.overlay.width !== 1440 || letterboxedContentBounds.overlay.height !== 810
    || letterboxedContentBounds.overlay.y !== 45) {
    throw new Error(`Content overlay escaped the logical 16:9 desktop stage: ${JSON.stringify(letterboxedContentBounds)}`);
  }
  await motionPage.setViewportSize({ width: 1920, height: 1080 });
  await motionPage.locator("#content-overlay-close").focus();
  const articleAccessibility = await motionPage.evaluate(() => {
    const deck = document.querySelector<HTMLElement>("#command-deck")!;
    const body = document.querySelector<HTMLElement>("#content-reader-body")!;
    return {
      deckInert: deck.inert,
      deckAriaHidden: deck.getAttribute("aria-hidden"),
      bodyTabIndex: body.tabIndex,
      bodyScrollable: body.scrollHeight > body.clientHeight
    };
  });
  if (!articleAccessibility.deckInert || articleAccessibility.deckAriaHidden !== "true") {
    throw new Error(`Article reader did not isolate the command deck: ${JSON.stringify(articleAccessibility)}`);
  }
  if (articleAccessibility.bodyTabIndex !== 0 || !articleAccessibility.bodyScrollable) {
    throw new Error(`Article body is not a keyboard-scrollable region: ${JSON.stringify(articleAccessibility)}`);
  }
  await motionPage.keyboard.press("Tab");
  if (await motionPage.evaluate(() => document.activeElement?.id) !== "content-reader-body") {
    throw new Error("Article reader did not move focus from its return control to the article body");
  }
  const articleScrollBefore = await motionPage.locator("#content-reader-body").evaluate((body) => body.scrollTop);
  await motionPage.keyboard.press("PageDown");
  await motionPage.waitForTimeout(100);
  const articleScrollAfter = await motionPage.locator("#content-reader-body").evaluate((body) => body.scrollTop);
  if (articleScrollAfter <= articleScrollBefore) throw new Error("Article body did not scroll from the keyboard");
  await motionPage.screenshot({ path: path.join(artifactDirectory, "blog-reader.png"), animations: "disabled", omitBackground: true });
  await motionPage.locator("#content-overlay-close").click();
  if (await motionPage.locator("#content-reader").isVisible()) throw new Error("Shared content close did not return from the article");
  const restoredDeckAccessibility = await motionPage.evaluate(() => {
    const deck = document.querySelector<HTMLElement>("#command-deck")!;
    return { inert: deck.inert, ariaHidden: deck.getAttribute("aria-hidden") };
  });
  if (restoredDeckAccessibility.inert || restoredDeckAccessibility.ariaHidden !== null) {
    throw new Error(`Shared content close did not restore the command deck: ${JSON.stringify(restoredDeckAccessibility)}`);
  }
  if (!motionPage.url().endsWith("#/blog/posts")) throw new Error(`Closing an article did not restore its directory hash: ${motionPage.url()}`);
  await motionPage.locator(".terminal-tabs button").nth(1).click();
  if (await motionPage.locator("#content-reader").isVisible() || !motionPage.url().endsWith("#/blog/")) {
    throw new Error(`Switching terminal sessions left stale article location state: ${motionPage.url()}`);
  }
  await motionPage.locator(".terminal-tabs button").nth(0).click();
  if (!motionPage.url().endsWith("#/blog/posts")) throw new Error(`Returning to a content session did not restore its directory hash: ${motionPage.url()}`);
  await motionPage.locator('.file-grid button[data-file-name="building-edex-web"]').click();
  if (await motionPage.locator('.file-grid button[data-file-name="index.md"]').getAttribute("data-icon") !== "markdown"
    || await motionPage.locator('.file-grid button[data-file-name="command-deck.svg"]').getAttribute("data-icon") !== "image") {
    throw new Error("Content filesystem did not visually distinguish Markdown documents from images");
  }
  await motionPage.locator('.file-grid button[data-file-name="command-deck.svg"]').click();
  if (!await motionPage.locator(".image-viewer").isVisible() || !motionPage.url().endsWith("#/blog/posts/building-edex-web/command-deck.svg")) {
    throw new Error(`Opening media from the filesystem did not create a media history entry: ${motionPage.url()}`);
  }
  await motionPage.goBack({ waitUntil: "networkidle" });
  if (await motionPage.locator(".image-viewer").isVisible() || !motionPage.url().endsWith("#/blog/posts/building-edex-web")) {
    throw new Error(`Browser back did not restore the directory after filesystem media: ${motionPage.url()}`);
  }
  await motionPage.locator('.file-grid button[data-file-name="index.md"]').click();
  const inlineImage = motionPage.locator('.content-image[data-content-path="posts/building-edex-web/command-deck.svg"]');
  await inlineImage.waitFor();
  if (!await inlineImage.isVisible()) throw new Error("Relative Markdown image was not rendered from the content manifest");
  await inlineImage.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0 ? undefined : new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error("Relative Markdown image failed to load")), { once: true });
  }));
  const revealSoundOffset = await motionPage.evaluate(() => (window as typeof window & { __motionSoundCues?: string[] }).__motionSoundCues?.length ?? 0);
  const revealStartedAt = Date.now();
  await inlineImage.click();
  if (!await motionPage.locator(".image-viewer").isVisible()) throw new Error("Image file did not open the media viewer");
  if (await motionPage.locator("html").getAttribute("data-last-sound") !== "expand") {
    throw new Error("Opening the media viewer did not play its shared open cue");
  }
  const initialRevealState = await motionPage.locator(".image-viewer__stage").getAttribute("data-reveal-state");
  if (initialRevealState === "ready") throw new Error("Cached image skipped the minimum media reveal animation");
  await motionPage.locator('.image-viewer__stage[data-reveal-engine="gpu-glitch"][data-reveal-state="revealing"][data-reveal-phase="0"]').waitFor({ timeout: 5_000 });
  const revealVisual = await motionPage.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".image-viewer__stage")!;
    const image = stage.querySelector<HTMLImageElement>("img")!;
    const canvas = stage.querySelector<HTMLCanvasElement>(".image-viewer__glitch-canvas")!;
    return {
      imageOpacity: getComputedStyle(image).opacity,
      canvasVisible: getComputedStyle(canvas).visibility === "visible",
      phase: stage.dataset.revealPhase,
      intensity: Number(stage.dataset.revealIntensity),
      producedFrames: Number(stage.dataset.revealFrames)
    };
  });
  if (revealVisual.imageOpacity !== "0" || !revealVisual.canvasVisible || revealVisual.phase !== "0"
    || revealVisual.intensity !== 1.25 || revealVisual.producedFrames < 1) {
    throw new Error(`Media reveal did not begin with the selected GPU glitch preset: ${JSON.stringify(revealVisual)}`);
  }
  await motionPage.screenshot({ path: path.join(artifactDirectory, "image-reveal-gpu-glitch-start.png"), omitBackground: true });
  try {
    await motionPage.waitForFunction(() => {
      const stage = document.querySelector<HTMLElement>(".image-viewer__stage");
      return stage?.dataset.revealState === "revealing"
        && Number(stage.dataset.revealPhase) >= 2;
    }, undefined, { timeout: 8_000 });
  } catch (error) {
    const stalledReveal = await motionPage.locator(".image-viewer__stage").evaluate((stage: HTMLElement) => ({
      ...stage.dataset,
      canvasCount: stage.querySelectorAll(".image-viewer__glitch-canvas").length,
      sourceCount: stage.querySelectorAll(".image-viewer__glitch-source").length
    }));
    throw new Error(`GPU glitch reveal stalled: ${JSON.stringify(stalledReveal)}`, { cause: error });
  }
  const laterGlitchIntensity = Number(await motionPage.locator(".image-viewer__stage").getAttribute("data-reveal-intensity"));
  const laterGlitchFrames = Number(await motionPage.locator(".image-viewer__stage").getAttribute("data-reveal-frames"));
  const laterGlitchPhase = Number(await motionPage.locator(".image-viewer__stage").getAttribute("data-reveal-phase"));
  if (laterGlitchIntensity >= revealVisual.intensity) throw new Error("GPU glitch did not progressively resolve toward the source image");
  if (laterGlitchPhase < 2) {
    throw new Error(`GPU glitch did not produce enough randomized pulses: ${laterGlitchPhase}`);
  }
  await motionPage.screenshot({ path: path.join(artifactDirectory, "image-reveal-gpu-glitch-resolving.png"), omitBackground: true });
  await motionPage.locator('.image-viewer__stage[data-reveal-state="ready"]').waitFor({ timeout: 8_000 });
  const revealSoundCues = await motionPage.evaluate((offset) => (
    (window as typeof window & { __motionSoundCues?: string[] }).__motionSoundCues ?? []
  ).slice(offset), revealSoundOffset);
  const revealPulseCues = revealSoundCues.filter((cue) => cue === "stdout");
  if (revealSoundCues[0] !== "expand" || revealPulseCues.length < 4 || revealPulseCues.length > 10
    || revealSoundCues.some((cue, index) => index > 0 && cue !== "stdout")) {
    throw new Error(`GPU glitch pulses did not emit one short cue per phase: ${JSON.stringify(revealSoundCues)}`);
  }
  const revealElapsedMs = Date.now() - revealStartedAt;
  if (revealElapsedMs < 1_000) throw new Error(`Media reveal completed too quickly: ${revealElapsedMs}ms`);
  const completedRevealLabel = await motionPage.locator(".image-viewer__reveal-label").evaluate((label) => {
    const bounds = label.getBoundingClientRect();
    return { display: getComputedStyle(label).display, width: bounds.width, height: bounds.height };
  });
  if (completedRevealLabel.display !== "none" || completedRevealLabel.width !== 0 || completedRevealLabel.height !== 0) {
    throw new Error(`Completed image reveal left its empty status label visible: ${JSON.stringify(completedRevealLabel)}`);
  }
  if (await motionPage.locator(".image-viewer__glitch-canvas").count() !== 0
    || await motionPage.locator(".image-viewer__stage > img:not(.image-viewer__glitch-source)").evaluate((image) => getComputedStyle(image).opacity) !== "1") {
    throw new Error("GPU reveal did not hand off cleanly to the original image");
  }
  if (await motionPage.locator(".image-viewer__stage > img:not(.image-viewer__glitch-source)").getAttribute("alt") !== "The command deck regions") {
    throw new Error("Image viewer did not preserve the author's Markdown alt text");
  }
  if (!motionPage.url().endsWith("#/blog/posts/building-edex-web/command-deck.svg")) throw new Error(`Image navigation did not update the content hash: ${motionPage.url()}`);
  const fullscreenMediaState = await motionPage.evaluate(() => {
    const viewer = document.querySelector<HTMLElement>(".image-viewer")!;
    const overlay = document.querySelector<HTMLElement>("#content-overlay")!;
    const stage = document.querySelector<HTMLElement>(".canvas-stage")!;
    const deck = document.querySelector<HTMLElement>("#command-deck")!;
    const overlayBounds = overlay.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    return {
      viewerInsideOverlay: viewer.closest("#content-overlay") === overlay,
      activeView: overlay.dataset.contentView,
      deckInert: deck.inert,
      deckAriaHidden: deck.getAttribute("aria-hidden"),
      activeElement: (document.activeElement as HTMLElement | null)?.id,
      fillsStage: Math.abs(overlayBounds.left - stageBounds.left) < 1
        && Math.abs(overlayBounds.top - stageBounds.top) < 1
        && Math.abs(overlayBounds.width - stageBounds.width) < 1
        && Math.abs(overlayBounds.height - stageBounds.height) < 1
    };
  });
  if (!fullscreenMediaState.viewerInsideOverlay || fullscreenMediaState.activeView !== "image"
    || !fullscreenMediaState.deckInert || fullscreenMediaState.deckAriaHidden !== "true"
    || fullscreenMediaState.activeElement !== "content-overlay-close" || !fullscreenMediaState.fillsStage) {
    throw new Error(`Image did not use the shared fullscreen content overlay: ${JSON.stringify(fullscreenMediaState)}`);
  }
  const mediaLayout = await motionPage.evaluate(() => {
    const viewer = document.querySelector<HTMLElement>(".image-viewer")!;
    const stage = document.querySelector<HTMLElement>(".image-viewer__stage")!;
    const image = stage.querySelector<HTMLImageElement>("img")!;
    const header = document.querySelector<HTMLElement>(".image-viewer__header")!;
    const footer = document.querySelector<HTMLElement>(".image-viewer footer")!;
    const viewerBounds = viewer.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    const imageBounds = image.getBoundingClientRect();
    return {
      stageOverflow: getComputedStyle(stage).overflow,
      imageObjectFit: getComputedStyle(image).objectFit,
      headerPosition: getComputedStyle(header).position,
      footerPosition: getComputedStyle(footer).position,
      stageCoverage: (stageBounds.width * stageBounds.height) / (viewerBounds.width * viewerBounds.height),
      imageFillsStageBox: Math.abs(imageBounds.width - stageBounds.width) < 1
        && Math.abs(imageBounds.height - stageBounds.height) < 1
    };
  });
  if (mediaLayout.stageOverflow !== "hidden" || mediaLayout.imageObjectFit !== "contain"
    || mediaLayout.headerPosition !== "absolute" || mediaLayout.footerPosition !== "absolute"
    || mediaLayout.stageCoverage < 0.98 || !mediaLayout.imageFillsStageBox) {
    throw new Error(`Image viewer did not prioritize a fitted, non-scrolling media stage: ${JSON.stringify(mediaLayout)}`);
  }
  if (await motionPage.locator(".image-viewer__counter").textContent() !== "1 / 2 · image/svg+xml") throw new Error("Image viewer did not expose media sequence metadata");
  await motionPage.locator('[data-viewer-action="zoom-in"]').click();
  if (await motionPage.locator(".image-viewer__zoom").textContent() !== "125%") throw new Error("Image viewer zoom control did not update");
  if (await motionPage.locator("html").getAttribute("data-last-sound") !== "stdin") {
    throw new Error("Image viewer zoom control did not play an interaction cue");
  }
  await motionPage.locator('[data-viewer-action="next"]').click();
  if (await motionPage.locator("#image-viewer-title").textContent() !== "content-flow.svg") throw new Error("Image viewer did not navigate to the next image");
  if (await motionPage.locator("html").getAttribute("data-last-sound") !== "folder") {
    throw new Error("Image viewer navigation control did not play a navigation cue");
  }
  if (await motionPage.locator(".image-viewer__stage").getAttribute("data-reveal-state") === "ready") {
    throw new Error("Image sequence navigation skipped the media reveal animation");
  }
  await motionPage.locator(".image-viewer__stage > img:not(.image-viewer__glitch-source)").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0 ? undefined : new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error("Image viewer asset failed to load")), { once: true });
  }));
  await motionPage.screenshot({ path: path.join(artifactDirectory, "image-viewer.png"), animations: "disabled", omitBackground: true });
  await motionPage.goBack({ waitUntil: "networkidle" });
  if (await motionPage.locator("#image-viewer-title").textContent() !== "command-deck.svg") throw new Error("Browser back did not restore the previous media selection");
  if (await motionPage.locator(".image-viewer__stage > img:not(.image-viewer__glitch-source)").getAttribute("alt") !== "The command deck regions") {
    throw new Error("Browser back did not preserve the author's Markdown alt text");
  }
  await motionPage.goBack({ waitUntil: "networkidle" });
  if (await motionPage.locator(".image-viewer").isVisible() || !await motionPage.locator("#content-reader").isVisible()) {
    throw new Error("Browser back did not close media and restore the article");
  }
  await motionPage.goForward({ waitUntil: "networkidle" });
  await motionPage.goForward({ waitUntil: "networkidle" });
  if (!await motionPage.locator(".image-viewer").isVisible() || await motionPage.locator("#image-viewer-title").textContent() !== "content-flow.svg") {
    throw new Error("Browser forward did not restore the media sequence");
  }
  await motionPage.keyboard.press("Escape");
  if (await motionPage.locator(".image-viewer").isVisible()) throw new Error("Image viewer did not close with Escape");
  if (await motionPage.locator("#content-reader").isVisible() || !motionPage.url().endsWith("#/blog/posts/building-edex-web")) {
    throw new Error(`Closing media did not restore its directory state: ${motionPage.url()}`);
  }
  if (!await motionPage.evaluate(() => {
    const runtime = document.querySelector<HTMLElement>("#terminal-runtime")!;
    return !runtime.inert && runtime.getAttribute("aria-hidden") === null;
  })) {
    throw new Error("Image viewer did not restore the central terminal after dismissal");
  }
  await motionPage.evaluate(`(() => {
    window.__originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(window.__originalCanvasGetContext, {
      apply(target, thisArgument, argumentsList) {
        const contextId = String(argumentsList[0]);
        if (contextId === "webgl" || contextId === "experimental-webgl" || contextId === "webgl2") return null;
        return Reflect.apply(target, thisArgument, argumentsList);
      }
    });
  })()`);
  await motionPage.locator('.file-grid button[data-file-name="command-deck.svg"]').click();
  await motionPage.locator('.image-viewer__stage[data-reveal-engine="tiles"][data-reveal-state="revealing"]').waitFor({ timeout: 5_000 });
  if (await motionPage.locator(".image-viewer__reveal-tile").count() === 0) {
    throw new Error("Media reveal did not retain its tile fallback when WebGL was unavailable");
  }
  await motionPage.evaluate(() => {
    const state = window as typeof window & { __originalCanvasGetContext?: typeof HTMLCanvasElement.prototype.getContext };
    HTMLCanvasElement.prototype.getContext = state.__originalCanvasGetContext!;
    delete state.__originalCanvasGetContext;
  });
  await motionPage.keyboard.press("Escape");
  await motionPage.evaluate(() => {
    window.location.hash = "#/blog/%2e%2e/%2e%2e/secret";
  });
  await motionPage.waitForFunction(() => window.location.hash === "#/blog/");
  if (!await motionPage.locator(".section-label small").textContent().then((value) => value?.endsWith("/Blog"))) {
    throw new Error("Invalid content URL did not fall back to the content root");
  }
  const directImagePage = await motionContext.newPage();
  await directImagePage.bringToFront();
  directImagePage.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`direct-image: ${message.text()}`); });
  directImagePage.on("pageerror", (error) => pageErrors.push(`direct-image: ${error.message}`));
  await directImagePage.addInitScript(() => {
    const state = window as typeof window & {
      __directImageVisibleOnFirstDesktopFrame?: boolean;
      __directImageSoundCues?: string[];
    };
    state.__directImageSoundCues = [];
    document.addEventListener("edex:sound", (event) => {
      state.__directImageSoundCues?.push((event as CustomEvent<{ cue: string }>).detail.cue);
    });
    document.addEventListener("edex:boot-phase", (event) => {
      if ((event as CustomEvent<{ phase: string }>).detail.phase !== "complete") return;
      state.__directImageSoundCues = [];
      requestAnimationFrame(() => {
        const viewer = document.querySelector<HTMLElement>(".image-viewer");
        state.__directImageVisibleOnFirstDesktopFrame = viewer ? !viewer.hidden : false;
      });
    });
  });
  await directImagePage.goto("http://127.0.0.1:4174/?fastboot=1#/blog/posts/night-routes/tokyo-night.jpg", { waitUntil: "networkidle" });
  await directImagePage.locator("[data-ready]").waitFor();
  if (await directImagePage.locator(".image-viewer").isVisible()) {
    throw new Error("Direct image route started its reveal behind the startup gate");
  }
  await directImagePage.getByRole("button", { name: "Initialize system" }).click();
  await directImagePage.locator('html[data-boot-phase="complete"]').waitFor({ timeout: 10_000 });
  await directImagePage.waitForFunction(() => typeof (window as typeof window & { __directImageVisibleOnFirstDesktopFrame?: boolean })
    .__directImageVisibleOnFirstDesktopFrame === "boolean");
  const imageVisibleOnFirstDesktopFrame = await directImagePage.evaluate(() => (window as typeof window & {
    __directImageVisibleOnFirstDesktopFrame?: boolean;
  }).__directImageVisibleOnFirstDesktopFrame);
  if (imageVisibleOnFirstDesktopFrame) {
    throw new Error("Direct image route covered the first fully booted desktop frame");
  }
  await directImagePage.locator('.image-viewer__stage[data-reveal-engine="gpu-glitch"][data-reveal-state="revealing"]').waitFor({ timeout: 5_000 });
  const directImageSoundCues = await directImagePage.evaluate(() => (window as typeof window & {
    __directImageSoundCues?: string[];
  }).__directImageSoundCues ?? []);
  if (directImageSoundCues[0] !== "expand" || directImageSoundCues[1] !== "stdout") {
    throw new Error(`Direct image route did not sequence its open and first pulse cues after boot: ${JSON.stringify(directImageSoundCues)}`);
  }
  const directReveal = await directImagePage.evaluate(() => {
    const image = document.querySelector<HTMLImageElement>(".image-viewer__stage > img:not(.image-viewer__glitch-source)")!;
    const stage = document.querySelector<HTMLElement>(".image-viewer__stage")!;
    const canvas = stage.querySelector<HTMLCanvasElement>(".image-viewer__glitch-canvas")!;
    return {
      imageOpacity: getComputedStyle(image).opacity,
      canvasVisible: getComputedStyle(canvas).visibility === "visible",
      producedFrames: Number(stage.dataset.revealFrames)
    };
  });
  if (directReveal.imageOpacity !== "0" || !directReveal.canvasVisible || directReveal.producedFrames < 1) {
    throw new Error(`Direct image route did not enter the staged reveal after boot: ${JSON.stringify(directReveal)}`);
  }
  await directImagePage.close();
  await motionContext.close();
  const metrics = await compareScreenshots(
    path.resolve("references/edex-ui-v2.2.8/screenshot_default.png"),
    path.join(artifactDirectory, "command-deck.png"),
    path.join(artifactDirectory, "upstream-diff.png")
  );
  const perceptualMetrics = await compareScreenshots(
    path.resolve("references/edex-ui-v2.2.8/screenshot_default.png"),
    path.join(artifactDirectory, "command-deck.png"),
    path.join(artifactDirectory, "upstream-perceptual-diff.png"),
    contract.perceptualComparison.comparisonOptions
  );
  const regionMetrics = Object.fromEntries(await Promise.all(Object.entries(contract.comparisonRegions).map(async ([name, region]) => [
    name,
    await compareScreenshotRegion(
      path.resolve("references/edex-ui-v2.2.8/screenshot_default.png"),
      path.join(artifactDirectory, "command-deck.png"),
      path.join(artifactDirectory, `upstream-diff-${name}.png`),
      region
    )
  ]))) as Record<string, VisualMetrics>;
  const perceptualRegionMetrics = Object.fromEntries(await Promise.all(Object.entries(contract.comparisonRegions).map(async ([name, region]) => [
    name,
    await compareScreenshotRegion(
      path.resolve("references/edex-ui-v2.2.8/screenshot_default.png"),
      path.join(artifactDirectory, "command-deck.png"),
      path.join(artifactDirectory, `upstream-perceptual-diff-${name}.png`),
      region,
      contract.perceptualComparison!.comparisonOptions
    )
  ]))) as Record<string, VisualMetrics>;
  const diagnostics = { consoleErrors, pageErrors, finalUrl: page.url() };
  const formalVerdict = judgeVisualResult(
    metrics,
    diagnostics,
    contract.maxDifferenceRatio,
    Object.fromEntries(Object.entries(regionMetrics).map(([name, region]) => [name, {
      metrics: region,
      maxDifferenceRatio: contract.comparisonRegions?.[name]?.maxDifferenceRatio ?? null
    }]))
  );
  const perceptualVerdict = judgeVisualResult(
    perceptualMetrics,
    diagnostics,
    contract.perceptualComparison.maxDifferenceRatio,
    Object.fromEntries(Object.entries(perceptualRegionMetrics).map(([name, region]) => [name, {
      metrics: region,
      maxDifferenceRatio: contract.perceptualComparison?.regionMaxDifferenceRatios[name] ?? null
    }]))
  );
  const report = {
    status: formalVerdict.status === "passed" && perceptualVerdict.status === "passed" ? "passed" : "failed",
    viewport: { width: 1934, height: 1094 },
    requiredRegions: regions,
    bootChecks: { requiredPhases, observedPhases: bootEvidence.phases, titleStateBounds },
    audioChecks: { requiredSounds, observedSounds: [...new Set(bootEvidence.sounds)], soundCounts, cueVolumes: expectedBootVolumes, assets: audioAssets.length, muteToggle: true },
    interactionChecks: [
      "startup gesture",
      "boot replay and skip",
      "physical terminal command",
      "global terminal focus recovery",
      "physical and on-screen line editing controls",
      "on-screen keyboard command",
      "held on-screen key repeat",
      "terminal history and completion",
      "quoted filesystem completion",
      "bounded long terminal draft",
      "independent terminal sessions",
      "keyboard navigable terminal tablist",
      "on-screen terminal shortcuts",
      "filesystem navigation, disk view and insertion",
      "blog folder navigation, terminal isolation and keyboard-scrolled Markdown reading",
      "central image viewing, minimum-duration raster reveal, terminal isolation, zoom, sequence navigation and keyboard dismissal",
      "theme and keyboard file special actions",
      "outcome-specific sound feedback",
      "persistently visible sound control",
      "keyboard focus escape",
      "touch keyboard command",
      "normal-motion idle cadence"
    ],
    responsiveChecks: ["1934x1094 frozen Electron container", "1920x1080 logical canvas", "1440x900 with 1440x810 centered stage", "1280x800 with 1280x720 centered stage", "1024x1024 with canonical 1024x576 centered stage", "390x844 terminal mode", "390x844 touch terminal interaction", "390x844 terminal/files shared navigation", "844x390 touch terminal landscape", "reduced-motion static feedback"],
    performanceCheck: frameSample,
    mediaRevealCheck: {
      engine: "@vfx-js/effects GlitchEffect",
      viewport: { width: 1920, height: 1080 },
      initialPreset: { intensity: revealVisual.intensity },
      resolvingIntensity: laterGlitchIntensity,
      resolvingPhase: laterGlitchPhase,
      resolvingProducedFrames: laterGlitchFrames,
      elapsedMs: revealElapsedMs,
      directRouteProducedFrames: directReveal.producedFrames,
      webglFallback: "tiles"
    },
    sourceDrivenChecks: sourceDrivenState,
    screenshots: ["boot-gate.png", "boot-log.png", "boot-title-outline.png", "boot-title-filled.png", "boot-title-framed.png", "boot-title-glitch.png", "boot-reveal.png", "boot-greeting.png", "boot-greeting-fading.png", "boot-terminal-ready.png", "blog-reader.png", "image-reveal-gpu-glitch-start.png", "image-reveal-gpu-glitch-resolving.png", "image-viewer.png", "command-deck.png", "command-deck-1920x1080.png", "command-deck-1440x900.png", "command-deck-1280x800.png", "command-deck-1024x1024.png", "command-deck-mobile.png", "command-deck-mobile-touch.png", "command-deck-mobile-files.png", "command-deck-mobile-landscape.png"],
    consoleErrors,
    pageErrors,
    upstreamVisualMetrics: metrics,
    upstreamPerceptualMetrics: perceptualMetrics,
    canonicalBounds,
    upstreamRegionMetrics: regionMetrics,
    upstreamPerceptualRegionMetrics: perceptualRegionMetrics,
    visualVerdicts: { formal: formalVerdict, perceptual: perceptualVerdict },
    note: "The formal metric preserves the workflow threshold. The perceptual metric includes antialiased pixels so thin glyphs, globe details and one-pixel strokes remain visible to diagnostics."
  };
  await writeFile(path.join(artifactDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`App verification ${report.status}; boot ${bootEvidence.phases.join(" → ")}; upstream difference ${(metrics.differenceRatio * 100).toFixed(2)}%; perceptual ${(perceptualMetrics.differenceRatio * 100).toFixed(2)}%\n`);
  if (report.status !== "passed") {
    process.stderr.write(`${[...formalVerdict.reasons, ...perceptualVerdict.reasons].join("\n")}\n`);
  }
  if (report.status !== "passed") process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
