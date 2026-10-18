import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";

const server = await createServer({ root: path.resolve("apps/clone"), server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
await server.listen();
const base = server.resolvedUrls!.local[0]!;
const artifacts = path.resolve("artifacts/mini-entry");
await mkdir(artifacts, { recursive: true });
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const input of ["mouse", "keyboard", "touch"] as const) {
        const mobile = input === "touch";
        const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://mini.seker.wang/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Minimal destination</h1>" }));
        await page.goto(`${base}?fastboot`, { waitUntil: "networkidle" });
        const link = page.locator("#enter-minimal");
        await link.waitFor({ timeout: 5000 });
        assert.equal(await link.getAttribute("href"), "https://mini.seker.wang/");
        assert.equal(await link.textContent(), "Enter minimal site");
        await page.locator("#gate-language").selectOption("zh-CN");
        assert.equal(await link.textContent(), "进入极简版");
        assert.equal(await page.locator("html").getAttribute("data-boot-phase"), "gate");
        if (mobile) {
          const bounds = await link.boundingBox();
          assert.ok(bounds && bounds.height >= 44 && bounds.x >= 0 && bounds.x + bounds.width <= 390);
        }
        await page.screenshot({ path: path.join(artifacts, `${engine.name()}-${input}.png`) });
        if (input === "keyboard") {
          await page.locator("#initialize-system").focus();
          await page.keyboard.press("Tab");
          assert.equal(await link.evaluate(element => element === document.activeElement), true);
          await page.keyboard.press("Enter");
        } else if (mobile) await link.tap();
        else await link.click();
        await page.waitForURL("https://mini.seker.wang/");
        assert.equal(context.pages().length, 1, "Navigation should reuse the current tab");
        assert.deepEqual(errors, []);
        await context.close();
      }
    } finally { await browser.close(); }
  }
  console.log("Minimal entry passed: Chromium/WebKit mouse, keyboard and touch; screenshots saved.");
} finally { await server.close(); }
