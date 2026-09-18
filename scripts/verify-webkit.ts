import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { webkit } from "playwright";
import { createServer } from "vite";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function assertBounds(name: string, actual: Bounds, expected: Bounds, tolerance = 1): void {
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
  server: { host: "127.0.0.1", port: 4175, strictPort: true },
  logLevel: "error"
});
await server.listen();
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  colorScheme: "dark",
  reducedMotion: "reduce",
  deviceScaleFactor: 1
});
const page = await context.newPage();
const consoleErrors: string[] = [];
const pageErrors: string[] = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto("http://127.0.0.1:4175/?static=1", { waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  await page.locator("#boot-overlay").waitFor({ state: "hidden" });
  for (const selector of [".system-panel", ".terminal-panel", ".network-panel", ".filesystem-panel", ".keyboard-panel"]) {
    if (!await page.locator(selector).isVisible()) throw new Error(`WebKit desktop region is not visible: ${selector}`);
  }
  const fullHdBounds = await page.locator(".canvas-stage").boundingBox();
  if (!fullHdBounds) throw new Error("WebKit 1920×1080 stage could not be measured");
  assertBounds("WebKit 1920×1080 stage", fullHdBounds, { x: 0, y: 0, width: 1920, height: 1080 });

  const terminalInput = page.locator("#terminal-input");
  await page.locator("#terminal-output").click({ position: { x: 40, y: 40 } });
  await page.keyboard.type("help");
  if (await terminalInput.inputValue() !== "help") throw new Error("WebKit did not route global physical typing to the terminal input");
  await terminalInput.press("Enter");
  await page.getByText("AVAILABLE COMMANDS", { exact: false }).waitFor();
  await terminalInput.fill("theme tron");
  await terminalInput.press("Enter");
  await page.getByText("THEME tron ACTIVE", { exact: false }).waitFor();
  await page.locator('.file-grid button[data-file-name="themes"]').click();
  await page.locator('.file-grid button[data-file-name="tron-disrupted.json"]').click();
  if (await page.locator("html").getAttribute("data-last-sound") !== "denied") throw new Error("WebKit did not preserve typed denied feedback");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  const letterboxBounds = await page.locator(".canvas-stage").boundingBox();
  if (!letterboxBounds) throw new Error("WebKit 1440×900 stage could not be measured");
  assertBounds("WebKit 1440×900 stage", letterboxBounds, { x: 0, y: 45, width: 1440, height: 810 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-ready]").waitFor();
  if (!await page.locator(".terminal-panel").isVisible()) throw new Error("WebKit mobile terminal is not visible");
  if (await page.locator(".keyboard-panel").isVisible()) throw new Error("WebKit mobile mode retained the desktop keyboard");
  const mobileOverflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > innerWidth,
    vertical: document.documentElement.scrollHeight > innerHeight
  }));
  if (mobileOverflow.horizontal || mobileOverflow.vertical) throw new Error(`WebKit mobile mode overflowed: ${JSON.stringify(mobileOverflow)}`);

  const report = {
    status: consoleErrors.length === 0 && pageErrors.length === 0 ? "passed" : "failed",
    browser: `WebKit ${browser.version()}`,
    checks: ["required desktop regions", "1920x1080 logical canvas", "global physical terminal typing", "1440x900 letterbox", "typed terminal and filesystem feedback", "390x844 mobile terminal"],
    consoleErrors,
    pageErrors
  };
  await writeFile(path.join(artifactDirectory, "webkit-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "passed") throw new Error(`WebKit diagnostics failed: ${JSON.stringify({ consoleErrors, pageErrors })}`);
  process.stdout.write(`WebKit verification passed: ${report.browser}\n`);
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
