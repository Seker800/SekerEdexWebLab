import { chromium, type Browser } from "playwright";
import type { PageCollector } from "../../domain/ports.js";
import type { CaptureResult, Viewport } from "../../domain/types.js";

export class PlaywrightCollector implements PageCollector {
  private browserPromise: Promise<Browser> | undefined;

  private browser(): Promise<Browser> {
    this.browserPromise ??= chromium.launch({ headless: true });
    return this.browserPromise;
  }

  async capture(url: string, viewport: Viewport, outputPath: string, readySelector?: string): Promise<CaptureResult> {
    const browser = await this.browser();
    const context = await browser.newContext({
      viewport,
      colorScheme: "light",
      reducedMotion: "reduce",
      locale: "en-US",
      timezoneId: "UTC",
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      if (readySelector) await page.locator(readySelector).waitFor({ state: "visible", timeout: 10_000 });
      await page.screenshot({ path: outputPath, fullPage: true, animations: "disabled", omitBackground: true });

      return {
        screenshotPath: outputPath,
        diagnostics: { consoleErrors, pageErrors, finalUrl: page.url() }
      };
    } finally {
      await context.close();
    }
  }

  async close(): Promise<void> {
    if (this.browserPromise) await (await this.browserPromise).close();
  }
}
