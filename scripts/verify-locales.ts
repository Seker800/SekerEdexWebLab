import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = "http://127.0.0.1:4174";
const artifacts = path.resolve("artifacts/app-verification");
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const desktop = await browser.newContext({ viewport: { width: 1934, height: 1094 } });
  const page = await desktop.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/?fastboot`, { waitUntil: "networkidle" });
  await page.locator("#gate-language").selectOption("zh-CN");
  if (await page.locator("#initialize-system").textContent() !== "初始化系统") throw new Error("Boot gate did not translate");
  await page.screenshot({ path: path.join(artifacts, "boot-gate-zh-cn.png") });
  await page.locator("#initialize-system").click();
  await page.waitForFunction(() => document.documentElement.dataset.bootPhase === "complete");
  await page.waitForTimeout(900);
  if (await page.locator(".system-panel .clock-meta h1").nth(1).textContent() !== "运行时间") throw new Error("Desktop labels did not translate");
  if (await page.locator("#deck-language").inputValue() !== "zh-CN") throw new Error("Desktop language picker did not sync");
  await page.screenshot({ path: path.join(artifacts, "command-deck-zh-cn.png") });
  await page.reload({ waitUntil: "networkidle" });
  if (await page.locator("#gate-language").inputValue() !== "zh-CN") throw new Error("Language selection was not retained");
  await page.goto(`${base}/?fastboot#/blog/posts/night-routes/tokyo-night.jpg`, { waitUntil: "networkidle" });
  await page.locator("#initialize-system").click();
  await page.waitForFunction(() => document.documentElement.dataset.bootPhase === "complete");
  await page.locator(".image-viewer:not([hidden])").waitFor();
  if (await page.locator(".image-viewer__header small").textContent() !== "图片查看器") throw new Error("Image viewer did not translate");
  await page.locator('.image-viewer__stage[data-reveal-state="ready"]').waitFor({ timeout: 15_000 });
  await page.screenshot({ path: path.join(artifacts, "image-viewer-zh-cn.png") });
  await page.goto(`${base}/?fastboot`, { waitUntil: "networkidle" });
  await page.locator("#initialize-system").click();
  await page.waitForFunction(() => document.documentElement.dataset.bootPhase === "complete");
  await page.locator("#deck-language").selectOption("en");
  if (await page.locator("#reboot-system").textContent() !== "REBOOT") throw new Error("Switching back to English failed");
  if (await page.locator("html").getAttribute("lang") !== "en") throw new Error("Document language did not change");
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${base}/?fastboot`, { waitUntil: "networkidle" });
  await mobilePage.locator("#gate-language").selectOption("zh-CN");
  await mobilePage.locator("#initialize-system").tap();
  await mobilePage.waitForFunction(() => document.documentElement.dataset.bootPhase === "complete");
  await mobilePage.waitForTimeout(900);
  if (!await mobilePage.locator("#deck-language").isVisible()) throw new Error("Mobile language picker is hidden");
  await mobilePage.screenshot({ path: path.join(artifacts, "command-deck-mobile-zh-cn.png") });
  await mobile.close();
  console.log("Locale browser checks passed; desktop and mobile screenshots saved.");
} finally {
  await browser.close();
}
