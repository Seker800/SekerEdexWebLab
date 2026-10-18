import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";

const artifactDirectory = path.resolve("artifacts/resilience");
const server = await createServer({ root: path.resolve("apps/clone"), server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
await server.listen();
const base = server.resolvedUrls!.local[0]!;
const results: { browser: string; scenario: string; passed: boolean; error?: string }[] = [];

async function boot(page: Page): Promise<void> {
  await page.goto(`${base}?fastboot`);
  await page.locator("#initialize-system").click({ timeout: 5_000 });
  await page.locator('html[data-boot-phase="complete"]').waitFor();
}

const scenarios: Record<string, (page: Page) => Promise<void>> = {
  "blocked browser storage": async (page) => {
    await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } }));
    await boot(page);
    await page.locator("#deck-language").selectOption("zh-CN");
    assert.equal(await page.locator("#reboot-system").textContent(), "重新启动");
  },
  "back-forward cache keeps controls alive": async (page) => {
    await boot(page);
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await page.locator("#deck-language").selectOption("zh-CN");
    assert.equal(await page.locator("#reboot-system").textContent(), "重新启动");
  },
  "closing image cancels in-flight reveal": async (page) => {
    await boot(page);
    await page.evaluate(() => {
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function () {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return decode.call(this);
      };
      location.hash = "#/blog/posts/night-routes/tokyo-night.jpg";
    });
    await page.locator(".image-viewer:not([hidden])").waitFor();
    await page.locator("#content-overlay-close").click();
    await page.waitForTimeout(800);
    assert.equal(await page.locator(".image-viewer__pixelate-source, .image-viewer__pixelate-canvas").count(), 0);
    assert.notEqual(await page.locator(".image-viewer__stage").getAttribute("data-reveal-state"), "revealing");
  },
  "overlay pauses embedded media and contains keyboard focus": async (page) => {
    await boot(page);
    const result = await page.evaluate(async () => {
      const moduleUrl = "/src/fullscreen-content-overlay.ts";
      const { FullscreenContentOverlay } = await import(moduleUrl);
      const root = document.createElement("section");
      const viewport = document.createElement("div");
      const close = document.createElement("button");
      close.textContent = "Close test dialog";
      root.append(close, viewport);
      root.hidden = true;
      document.body.append(root);
      const background = document.querySelector<HTMLElement>("#app")!;
      const overlay = new FullscreenContentOverlay(root, viewport, background, close, () => undefined);
      const article = document.createElement("article");
      const video = document.createElement("video");
      let paused = 0;
      video.pause = () => { paused += 1; };
      const last = document.createElement("button");
      last.textContent = "Last dialog action";
      article.append(video, last);
      overlay.register("document", article);
      overlay.open("document");
      last.focus();
      last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
      const wrapped = document.activeElement === close;
      overlay.close();
      overlay.dispose();
      root.remove();
      return { paused, wrapped };
    });
    assert.equal(result.wrapped, true, "Tab must remain inside the active dialog");
    assert.ok(result.paused > 0, "Closing a document must pause embedded media");
  }
};

try {
  await mkdir(artifactDirectory, { recursive: true });
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const [scenario, run] of Object.entries(scenarios)) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        try {
          await run(page);
          assert.deepEqual(pageErrors, []);
          results.push({ browser: engine.name(), scenario, passed: true });
        } catch (error) {
          results.push({ browser: engine.name(), scenario, passed: false, error: String(error) });
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
  await writeFile(path.join(artifactDirectory, "report.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  assert.ok(results.every((result) => result.passed), "Resilience regressions failed");
} finally { await server.close(); }
