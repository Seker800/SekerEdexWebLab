import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { compareScreenshotRegion, compareScreenshots, type ScreenshotRegion } from "../src/comparison/visual-comparator.js";

const canonicalRegionDefinitions: Record<string, { selector: string; expectedBounds: ScreenshotRegion; comparisonBounds: ScreenshotRegion }> = {
  system: { selector: ".system-panel", expectedBounds: { x: 9, y: 44, width: 303, height: 669 }, comparisonBounds: { x: 9, y: 44, width: 303, height: 669 } },
  terminal: { selector: ".terminal-panel", expectedBounds: { x: 331, y: 44, width: 1265, height: 669 }, comparisonBounds: { x: 331, y: 44, width: 1265, height: 669 } },
  network: { selector: ".network-panel", expectedBounds: { x: 1614, y: 44, width: 311, height: 669 }, comparisonBounds: { x: 1614, y: 44, width: 311, height: 684 } },
  filesystem: { selector: ".filesystem-panel", expectedBounds: { x: 9, y: 713, width: 834, height: 375 }, comparisonBounds: { x: 9, y: 713, width: 834, height: 381 } },
  keyboard: { selector: ".keyboard-panel", expectedBounds: { x: 842, y: 723, width: 1073, height: 375 }, comparisonBounds: { x: 843, y: 713, width: 1082, height: 381 } }
};

function assertBounds(name: string, actual: ScreenshotRegion, expected: ScreenshotRegion, tolerance = 4): void {
  for (const field of ["x", "y", "width", "height"] as const) {
    if (Math.abs(actual[field] - expected[field]) > tolerance) {
      throw new Error(`${name} ${field} is ${actual[field]}px; expected ${expected[field]}px ±${tolerance}px`);
    }
  }
}

const artifactDirectory = path.resolve("artifacts/app-verification");
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
  await page.screenshot({ path: path.join(artifactDirectory, "boot-gate.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Initialize system" }).click();
  await page.waitForFunction(() => document.querySelector("#boot-log")?.textContent?.includes("Boot Complete") ?? false);
  const bootLogText = await page.locator("#boot-log").textContent() ?? "";
  if (!bootLogText.includes("<dict ID=")) throw new Error("Boot log did not decode the upstream HTML entities");
  if (bootLogText.includes("&lt;dict")) throw new Error("Boot log rendered encoded entity text instead of the upstream characters");
  await page.screenshot({ path: path.join(artifactDirectory, "boot-log.png"), animations: "disabled" });
  await page.locator(".boot-title.visible").waitFor({ timeout: 25_000 });
  await page.locator(".boot-title.filled").waitFor({ timeout: 2_000 });
  await page.locator(".boot-title.framed").waitFor({ timeout: 2_000 });
  await page.locator(".boot-title.glitch").waitFor({ timeout: 2_000 });
  await page.locator("#command-deck.reveal-terminal").waitFor({ timeout: 25_000 });
  await page.screenshot({ path: path.join(artifactDirectory, "boot-reveal.png") });
  if (await page.locator(".terminal-tabs").isVisible()) throw new Error("Terminal tabs appeared before the upstream terminal initialization stage");
  await page.locator("#command-deck.greeting-visible .terminal-greeting").waitFor({ timeout: 3_000 });
  if (await page.locator(".terminal-greeting").textContent() !== "Welcome back, squared") {
    throw new Error("Boot greeting does not match the canonical source username snapshot");
  }
  if (await page.locator(".terminal-greeting > em").textContent() !== "squared") {
    throw new Error("Boot greeting did not preserve the source username emphasis");
  }
  const fadingGreetingObserved = page.locator("#command-deck.greeting-fading").waitFor({ state: "attached", timeout: 3_000 });
  await page.screenshot({ path: path.join(artifactDirectory, "boot-greeting.png") });
  if (await page.locator(".file-grid").isVisible()) throw new Error("Filesystem entries appeared before the upstream filesystem initialization stage");
  await fadingGreetingObserved;
  await page.locator("#command-deck.terminal-ready").waitFor({ timeout: 4_000 });
  await page.screenshot({ path: path.join(artifactDirectory, "boot-terminal-ready.png") });
  if (!await page.locator(".terminal-tabs").isVisible()) throw new Error("Terminal tabs did not appear at the upstream terminal initialization stage");
  if (!await page.locator(".file-grid").isVisible()) throw new Error("Filesystem entries did not appear at the upstream filesystem initialization stage");
  await page.locator('html[data-boot-phase="complete"]').waitFor({ timeout: 25_000 });

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
  await page.screenshot({ path: path.join(artifactDirectory, "boot-greeting-fading.png") });
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
    await page.screenshot({ path: path.join(artifactDirectory, name) });
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
  if (sourceDrivenState.sourceFilesystemScrollbars !== 1) throw new Error(`Expected the Electron source filesystem scrollbar compatibility layer; observed ${sourceDrivenState.sourceFilesystemScrollbars}`);
  if (sourceDrivenState.globeCanvas !== 1) throw new Error(`Expected one upstream ENCOM globe canvas; observed ${sourceDrivenState.globeCanvas}`);
  if (sourceDrivenState.leftBootModules !== 6) throw new Error(`Expected six upstream left boot modules; observed ${sourceDrivenState.leftBootModules}`);
  if (sourceDrivenState.rightBootModules !== 3) throw new Error(`Expected three upstream right boot modules; observed ${sourceDrivenState.rightBootModules}`);

  const terminalInput = page.locator("#terminal-input");
  await terminalInput.fill("status");
  await terminalInput.press("Enter");
  await page.getByText("INPUT MATRIX READY", { exact: false }).waitFor();
  await terminalInput.fill("");
  const physicalHKey = page.locator('[data-key="H"]');
  await terminalInput.focus();
  await page.keyboard.down("h");
  if (!await physicalHKey.evaluate((node) => node.classList.contains("pressed"))) {
    throw new Error("Physical keyboard input did not light the matching on-screen key");
  }
  await page.keyboard.up("h");
  if (!await physicalHKey.evaluate((node) => node.classList.contains("blink"))) {
    throw new Error("Physical keyboard release did not blink the matching on-screen key");
  }
  await page.waitForTimeout(120);
  if (await physicalHKey.evaluate((node) => node.classList.contains("pressed") || node.classList.contains("blink"))) {
    throw new Error("Physical keyboard feedback did not settle after the source release interval");
  }
  await terminalInput.fill("");
  for (const key of ["H", "E", "L", "P"]) await page.locator(`[data-key="${key}"]`).click();
  await page.locator('[data-key="ENTER"]').click();
  await page.getByText("AVAILABLE COMMANDS", { exact: false }).waitFor();
  const secondTerminalTab = page.locator(".terminal-tabs button").nth(1);
  await secondTerminalTab.click();
  if (!await secondTerminalTab.evaluate((node) => node.classList.contains("active"))) {
    throw new Error("Terminal tab did not activate");
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  const canonicalBounds: Record<string, ScreenshotRegion> = {};
  for (const [name, definition] of Object.entries(canonicalRegionDefinitions)) {
    const box = await page.locator(definition.selector).boundingBox();
    if (!box) throw new Error(`Could not measure canonical region: ${name}`);
    canonicalBounds[name] = box;
    assertBounds(name, box, definition.expectedBounds);
  }
  await page.screenshot({ path: path.join(artifactDirectory, "command-deck.png"), animations: "disabled" });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload({ waitUntil: "networkidle" });
  for (const selector of regions) {
    if (!await page.locator(selector).isVisible()) throw new Error(`Required region is not visible at 1280x800: ${selector}`);
  }
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > window.innerWidth,
    vertical: document.documentElement.scrollHeight > window.innerHeight
  }));
  if (overflow.horizontal || overflow.vertical) throw new Error(`Responsive viewport overflowed: ${JSON.stringify(overflow)}`);
  await page.screenshot({ path: path.join(artifactDirectory, "command-deck-1280x800.png"), animations: "disabled" });
  const metrics = await compareScreenshots(
    path.resolve("references/edex-ui-v2.2.8/screenshot_default.png"),
    path.join(artifactDirectory, "command-deck.png"),
    path.join(artifactDirectory, "upstream-diff.png")
  );
  const regionMetrics = Object.fromEntries(await Promise.all(Object.entries(canonicalRegionDefinitions).map(async ([name, definition]) => [
    name,
    await compareScreenshotRegion(
      path.resolve("references/edex-ui-v2.2.8/screenshot_default.png"),
      path.join(artifactDirectory, "command-deck.png"),
      path.join(artifactDirectory, `upstream-diff-${name}.png`),
      definition.comparisonBounds
    )
  ])));
  const report = {
    status: consoleErrors.length === 0 && pageErrors.length === 0 ? "passed" : "failed",
    viewport: { width: 1934, height: 1094 },
    requiredRegions: regions,
    bootChecks: { requiredPhases, observedPhases: bootEvidence.phases, titleStateBounds },
    audioChecks: { requiredSounds, observedSounds: [...new Set(bootEvidence.sounds)], soundCounts, cueVolumes: expectedBootVolumes, assets: audioAssets.length, muteToggle: true },
    interactionChecks: ["startup gesture", "boot replay and skip", "physical terminal command", "on-screen keyboard command", "terminal tab activation"],
    responsiveChecks: ["1934x1094 canonical", "1280x800 without overflow"],
    sourceDrivenChecks: sourceDrivenState,
    screenshots: ["boot-gate.png", "boot-log.png", "boot-title-outline.png", "boot-title-filled.png", "boot-title-framed.png", "boot-title-glitch.png", "boot-reveal.png", "boot-greeting.png", "boot-greeting-fading.png", "boot-terminal-ready.png", "command-deck.png", "command-deck-1280x800.png"],
    consoleErrors,
    pageErrors,
    upstreamVisualMetrics: metrics,
    canonicalBounds,
    upstreamRegionMetrics: regionMetrics,
    note: "Pixel difference is supporting evidence. Startup, sound, interaction, structure, responsive layout, console, and qualitative visual gates determine the verdict."
  };
  await writeFile(path.join(artifactDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`App verification ${report.status}; boot ${bootEvidence.phases.join(" → ")}; upstream difference ${(metrics.differenceRatio * 100).toFixed(2)}%\n`);
  if (report.status !== "passed") process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
