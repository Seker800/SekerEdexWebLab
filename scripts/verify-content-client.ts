import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { contentManifestPlugin } from "../apps/clone/vite.config.js";

const frontendPort = 4180;
const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
const image = await readFile(path.resolve(import.meta.dirname, "../examples/blog/posts/night-routes/tokyo-night.jpg"));
const video = Buffer.from("000000186674797069736f6d0000000069736f6d", "hex");
const content = {
  schemaVersion: 1,
  source: { schemaVersion: 1, id: "seker-content", kind: "author", visibility: "public", defaultLicense: "All rights reserved" },
  entries: [
    { kind: "document", relativePath: "posts/hello.md", title: "API article", summary: "Live content", markdown: "# API article\n\n![本地图片](../photos/image.jpg)", publishedAt: "2026-10-11", tags: [], sortOrder: 1 },
    { kind: "media", relativePath: "photos/image.jpg", url: "/api/v1/media/00000000-0000-0000-0000-000000000001", mediaType: "image/jpeg", alt: "A local test image", sortOrder: 2 },
    { kind: "media", relativePath: "posts/clip.mp4", url: "/api/v1/media/00000000-0000-0000-0000-000000000002", mediaType: "video/mp4", alt: "A short clip", sortOrder: 3 }
  ]
};
let responseMode: "normal" | "stalled" | "empty" = "normal";
const backend = createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/api/v1/content") {
    if (responseMode === "stalled") return;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(responseMode === "empty" ? { ...content, entries: [] } : content));
    return;
  }
  const media = request.url?.endsWith("000000000001") ? { type: "image/jpeg", bytes: image } :
    request.url?.endsWith("000000000002") ? { type: "video/mp4", bytes: video } : undefined;
  if (media) {
    response.writeHead(200, { "Content-Type": media.type, "Content-Length": media.bytes.length });
    response.end(media.bytes);
    return;
  }
  response.writeHead(404);
  response.end();
});
let backendOpen = false;
let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  backendOpen = true;
  const address = backend.address();
  if (!address || typeof address === "string") throw new Error("Content fixture did not acquire a port");
  const apiOrigin = `http://127.0.0.1:${address.port}`;
  vite = await createViteServer({
    configFile: false,
    root: path.resolve(import.meta.dirname, "../apps/clone"),
    plugins: [contentManifestPlugin({ delivery: "runtime", apiOrigin })],
    server: { host: "127.0.0.1", port: frontendPort, strictPort: true }
  });
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(frontendOrigin);
  await page.waitForFunction(() => document.documentElement.dataset.contentState === "ready");
  assert.equal(await page.locator('.file-grid button[data-file-name="posts"]').count(), 1);
  assert.equal(await page.locator('.file-grid button[data-file-name="draft.md"]').count(), 0);
  assert.equal(await page.locator('body').textContent().then((text) => text?.includes("Welcome to the command deck")), false);
  await page.getByRole("button", { name: "Initialize system" }).click();
  await page.locator("#boot-skip").click();
  await page.locator('html[data-boot-phase="complete"]').waitFor();
  await page.locator('.file-grid button[data-file-name="posts"]').click();
  await page.locator('.file-grid button[data-file-name="hello.md"]').click();
  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLImageElement>(".content-image img");
    return element?.complete && element.naturalWidth > 0;
  });
  await mkdir(path.resolve(import.meta.dirname, "../artifacts/app-verification"), { recursive: true });
  await page.locator(".content-image img").screenshot({ path: path.resolve(import.meta.dirname, "../artifacts/app-verification/content-api-inline-image.png") });
  await page.screenshot({ path: path.resolve(import.meta.dirname, "../artifacts/app-verification/content-api-article.png") });
  await page.locator("#content-overlay-close").click();
  await page.locator('.file-grid button[data-file-name="clip.mp4"]').click();
  await page.locator(".video-viewer video").waitFor({ state: "visible" });
  assert.equal(await page.locator(".video-viewer p").textContent(), "A short clip");
  await page.screenshot({ path: path.resolve(import.meta.dirname, "../artifacts/app-verification/content-api-video.png") });
  responseMode = "stalled";
  await page.goto(`${frontendOrigin}/?fastboot#/blog/posts/hello.md`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-content-status="loading"]').waitFor({ timeout: 2_000 });
  await page.waitForFunction(() => document.documentElement.dataset.contentState === "error", undefined, { timeout: 12_000 });
  assert.equal(new URL(page.url()).hash, "#/blog/posts/hello.md", "Outage must retain the requested article for retry");
  await page.locator("#initialize-system").click();
  await page.locator('html[data-boot-phase="complete"]').waitFor();
  await page.locator('[data-content-status="error"]').waitFor();
  await page.screenshot({ path: path.resolve("artifacts/app-verification/content-api-timeout.png") });
  responseMode = "normal";
  await page.locator('[data-content-retry]').click();
  await page.waitForFunction(() => document.documentElement.dataset.contentState === "ready");
  await page.locator("#initialize-system").click();
  await page.locator('html[data-boot-phase="complete"]').waitFor();
  assert.equal(await page.locator("#content-reader-title").textContent(), "API article");

  // A populated directory must remain navigable beyond the first screenful.
  for (let index = 0; index < 80; index += 1) content.entries.push({
    kind: "document", relativePath: `many/article-${String(index).padStart(2, "0")}.md`, title: `Article ${index}`,
    summary: "", markdown: `# Article ${index}`, publishedAt: "2026-10-18", tags: [], sortOrder: index
  });
  await page.goto(`${frontendOrigin}/?fastboot&case=many#/blog/many`);
  await page.locator("#initialize-system").click();
  await page.locator('html[data-boot-phase="complete"]').waitFor();
  await page.locator(".file-grid").hover();
  await page.mouse.wheel(0, 1600);
  await page.waitForFunction(() => document.querySelector(".file-grid")!.scrollTop > 0, undefined, { timeout: 2_000 });
  await page.locator('.file-grid button[data-file-name="article-79.md"]').click({ timeout: 3_000 });
  assert.equal(await page.locator("#content-reader-title").textContent(), "Article 79");
  await page.locator("#content-overlay-close").click();
  await page.screenshot({ path: path.resolve("artifacts/app-verification/content-api-large-directory.png") });

  responseMode = "empty";
  await page.goto(`${frontendOrigin}/?fastboot&case=empty`);
  await page.locator("#initialize-system").click();
  await page.locator('html[data-boot-phase="complete"]').waitFor();
  await page.locator('[data-content-status="empty"]').waitFor({ timeout: 3_000 });
  assert.equal(await page.locator('.file-grid button[data-file-name="posts"]').count(), 0);
  await page.screenshot({ path: path.resolve("artifacts/app-verification/content-api-empty.png") });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${frontendOrigin}/?fastboot`);
  await mobilePage.locator("#gate-language").selectOption("zh-CN");
  await mobilePage.locator("#initialize-system").tap();
  await mobilePage.locator('html[data-boot-phase="complete"]').waitFor();
  await mobilePage.locator("#mobile-files-view").tap();
  assert.equal(await mobilePage.locator('[data-content-status="empty"] p').textContent(), "这里暂时没有已发布内容。");
  await mobilePage.screenshot({ path: path.resolve("artifacts/app-verification/content-api-mobile-empty.png") });
  backend.closeAllConnections();
  await new Promise<void>((resolve) => backend.close(() => resolve()));
  backendOpen = false;
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.contentState === "error");
  assert.equal(await page.locator('.file-grid button[data-file-name="posts"]').count(), 0);
  await mobilePage.reload();
  await mobilePage.locator("#initialize-system").tap();
  await mobilePage.locator('html[data-boot-phase="complete"]').waitFor();
  await mobilePage.locator("#mobile-files-view").tap();
  const retryBounds = await mobilePage.locator("[data-content-retry]").boundingBox();
  assert.ok(retryBounds && retryBounds.width >= 44 && retryBounds.height >= 44);
  assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobilePage.screenshot({ path: path.resolve("artifacts/app-verification/content-api-mobile-error.png") });
  await mobile.close();
  console.log("Content client integration passed: media, bounded loading, retry, deep-link recovery, large directory, empty and outage states.");
} finally {
  await browser?.close();
  await vite?.close();
  if (backendOpen) {
    backend.closeAllConnections();
    await new Promise<void>((resolve) => backend.close(() => resolve()));
  }
}
