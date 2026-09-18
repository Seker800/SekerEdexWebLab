import type { AudioDeck } from "./audio-deck.js";
import { canonicalEdexVersion } from "./canonical-runtime.js";

export type BootPhase = "gate" | "log" | "title" | "reveal" | "complete";

export interface BootElements {
  overlay: HTMLElement;
  log: HTMLElement;
  title: HTMLElement;
  deck: HTMLElement;
  skip: HTMLButtonElement;
}

const fallbackLog = [
  "Welcome to eDEX-UI!",
  "vm_page_bootstrap: memory map accepted",
  "Loading telemetry adapters [OK]",
  "Mounting /workspace [OK]",
  "Starting network uplink [OK]",
  "Input matrix detected: QWERTY",
  "Audio feedback bus ready",
  "Boot Complete"
];

const wait = (milliseconds: number, signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException("Boot sequence aborted", "AbortError"));
    return;
  }
  const onAbort = (): void => {
    window.clearTimeout(timer);
    reject(new DOMException("Boot sequence aborted", "AbortError"));
  };
  const timer = window.setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve();
  }, milliseconds);
  signal?.addEventListener("abort", onAbort, { once: true });
});

function decodeBootLine(value: string): string {
  const decoder = document.createElement("textarea");
  decoder.innerHTML = value;
  return decoder.value;
}

async function loadBootLines(): Promise<string[]> {
  try {
    const response = await fetch("/boot_log.txt");
    if (!response.ok) return fallbackLog;
    return (await response.text()).split(/\r?\n/);
  } catch {
    return fallbackLog;
  }
}

function setPhase(elements: BootElements, phase: BootPhase): void {
  elements.overlay.dataset.phase = phase;
  elements.deck.dataset.bootPhase = phase;
  document.documentElement.dataset.bootPhase = phase;
  document.dispatchEvent(new CustomEvent("edex:boot-phase", { detail: { phase } }));
}

function upstreamLineDelay(nextLineIndex: number, lineCount: number): number {
  if (nextLineIndex === 2 || nextLineIndex === 4) return 500;
  if (nextLineIndex > 4 && nextLineIndex < 25) return 30;
  if (nextLineIndex === 25) return 400;
  if (nextLineIndex === 42) return 300;
  if (nextLineIndex > 42 && nextLineIndex < 82) return 25;
  if (nextLineIndex === 83) return 25;
  if (nextLineIndex >= lineCount - 2 && nextLineIndex < lineCount) return 300;
  return Math.pow(1 - (nextLineIndex / 1000), 3) * 25;
}

export async function runBootSequence(elements: BootElements, audio: AudioDeck, speed = 1, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const duration = (milliseconds: number): number => Math.max(1, Math.round(milliseconds * speed));
  const bootModules = (): HTMLElement[] => [...elements.deck.querySelectorAll<HTMLElement>("[data-boot-module]")];
  let skipped = false;
  let moduleRuntimeStarted = false;
  const startModuleRuntime = (): void => {
    if (moduleRuntimeStarted) return;
    moduleRuntimeStarted = true;
    document.dispatchEvent(new CustomEvent("edex:module-runtime-start", { detail: { speed } }));
  };
  const finish = (): void => {
    skipped = true;
    startModuleRuntime();
    bootModules().forEach((panel) => panel.classList.add("module-visible"));
    setPhase(elements, "complete");
    elements.overlay.hidden = true;
    elements.deck.classList.remove("greeting-visible", "greeting-fading", "keyboard-primed", "keyboard-expanded");
    elements.deck.classList.add("boot-complete", "terminal-ready", "keyboard-complete");
  };
  elements.skip.hidden = false;
  elements.skip.onclick = finish;
  elements.overlay.hidden = false;
  elements.overlay.classList.remove("boot-overlay--departing", "boot-overlay--grid");
  elements.deck.classList.remove("boot-complete", "reveal-terminal", "reveal-lower", "reveal-panels", "terminal-ready", "greeting-visible", "greeting-fading", "keyboard-primed", "keyboard-expanded", "keyboard-complete");
  bootModules().forEach((panel) => panel.classList.remove("module-visible"));
  elements.log.textContent = "";
  elements.title.className = "boot-title";
  setPhase(elements, "log");

  const lines = await loadBootLines();
  for (let index = 0; index < lines.length && !skipped; index += 1) {
    const line = decodeBootLine(lines[index] ?? "");
    elements.log.textContent += `${line}\n`;
    if (index === 1) {
      elements.log.textContent += `eDEX-UI Kernel version ${canonicalEdexVersion} boot at Mon Apr 29 2019; root:xnu-1699.22.73~1/RELEASE_X86_64`;
    }
    elements.log.scrollTop = elements.log.scrollHeight;
    audio.play(line === "Boot Complete" ? "granted" : "stdout");
    await wait(duration(upstreamLineDelay(index + 1, lines.length)), signal);
  }
  if (skipped) return;
  await wait(duration(300), signal);

  setPhase(elements, "title");
  audio.play("theme");
  await wait(duration(400), signal);
  elements.overlay.classList.add("boot-overlay--grid");
  elements.title.classList.add("visible");
  await wait(duration(200), signal);
  elements.overlay.classList.remove("boot-overlay--grid");
  await wait(duration(100), signal);
  elements.title.classList.add("filled");
  await wait(duration(300), signal);
  elements.title.classList.remove("filled");
  elements.title.classList.add("framed");
  await wait(duration(100), signal);
  elements.title.classList.remove("framed");
  elements.title.classList.add("glitch");
  await wait(duration(500), signal);
  elements.overlay.classList.add("boot-overlay--grid");
  elements.title.classList.remove("glitch");
  elements.title.classList.add("framed");
  await wait(duration(1000), signal);
  if (skipped) return;

  setPhase(elements, "reveal");
  elements.overlay.classList.remove("boot-overlay--grid");
  elements.overlay.classList.add("boot-overlay--departing");
  audio.play("expand");
  await wait(duration(500), signal);
  elements.deck.classList.add("reveal-terminal");
  await wait(duration(700), signal);
  elements.deck.classList.add("reveal-lower");
  await wait(duration(280), signal);
  elements.deck.classList.add("greeting-visible", "keyboard-primed");
  audio.play("keyboard");
  await wait(duration(100), signal);
  elements.deck.classList.add("keyboard-expanded");
  await wait(duration(1000), signal);
  elements.deck.classList.remove("greeting-visible");
  elements.deck.classList.add("greeting-fading");
  await wait(duration(100), signal);
  elements.deck.classList.remove("keyboard-primed", "keyboard-expanded");
  elements.deck.classList.add("keyboard-complete");
  await wait(duration(400), signal);
  elements.deck.classList.remove("greeting-fading");
  startModuleRuntime();
  elements.deck.classList.add("reveal-panels");
  const leftModules = [...elements.deck.querySelectorAll<HTMLElement>(".system-panel [data-boot-module]")];
  const rightModules = [...elements.deck.querySelectorAll<HTMLElement>(".network-panel [data-boot-module]")];
  await wait(duration(100), signal);
  elements.deck.classList.add("terminal-ready");
  await wait(duration(400), signal);
  for (let index = 0; index < 6 && !skipped; index += 1) {
    audio.play("panels");
    if (index === 4) audio.play("scan");
    leftModules[index]?.classList.add("module-visible");
    rightModules[index]?.classList.add("module-visible");
    await wait(duration(500), signal);
  }
  if (skipped) return;
  finish();
}

export function completeBootImmediately(elements: BootElements): void {
  elements.overlay.hidden = true;
  elements.deck.dataset.bootPhase = "complete";
  elements.deck.classList.add("boot-complete", "reveal-terminal", "reveal-lower", "reveal-panels", "terminal-ready", "keyboard-complete");
  elements.deck.querySelectorAll<HTMLElement>("[data-boot-module]").forEach((panel) => panel.classList.add("module-visible"));
  document.documentElement.dataset.bootPhase = "complete";
}
