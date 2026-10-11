import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { contentManifestPlugin } from "../apps/clone/vite.config.js";
import { ContentStore } from "../services/content-api/content-store.js";
import { createContentHandler, hashAdminPassword } from "../services/content-api/http.js";

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seker-content-integration-"));
const store = new ContentStore(path.join(temporaryRoot, "content.sqlite"));
const frontendPort = 4180;
const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
const backend = createHttpServer(createContentHandler({
  store,
  mediaRoot: path.join(temporaryRoot, "media"),
  allowedOrigins: [frontendOrigin],
  adminOrigin: "http://127.0.0.1:4175",
  adminUsername: "author",
  adminPasswordHash: hashAdminPassword("integration test password"),
  requireHttps: false
}));
let backendOpen = false;
let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  store.create({ kind: "document", relativePath: "posts/hello.md", title: "API article", summary: "Live content", markdown: "# API article\n\n![本地图片](../photos/本地图片.jpg)", publishedAt: "2026-10-11", tags: [], sortOrder: 1, status: "published" });
  store.create({ kind: "document", relativePath: "posts/draft.md", title: "Private draft", summary: "", markdown: "private", publishedAt: "2026-10-11", tags: [], sortOrder: 2, status: "draft" });
  const mediaRoot = path.join(temporaryRoot, "media");
  const videoStorageKey = randomUUID();
  await mkdir(mediaRoot);
  await writeFile(path.join(mediaRoot, videoStorageKey), Buffer.from("000000186674797069736f6d0000000069736f6d", "hex"));
  store.create({ kind: "media", relativePath: "posts/clip.mp4", title: "Clip", alt: "A short clip", mediaType: "video/mp4", storageKey: videoStorageKey, sortOrder: 3, status: "published" });
  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  backendOpen = true;
  const address = backend.address();
  if (!address || typeof address === "string") throw new Error("Backend did not acquire a port");
  const apiOrigin = `http://127.0.0.1:${address.port}`;
  vite = await createViteServer({
    configFile: false,
    root: path.resolve(import.meta.dirname, "../apps/clone"),
    plugins: [contentManifestPlugin({ delivery: "runtime", apiOrigin })],
    server: { host: "127.0.0.1", port: frontendPort, strictPort: true }
  });
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 }, httpCredentials: { username: "author", password: "integration test password" } });
  await admin.goto(`${apiOrigin}/admin`);
  await admin.locator('#media-form [name="file"]').setInputFiles(path.resolve(import.meta.dirname, "../examples/blog/posts/night-routes/tokyo-night.jpg"));
  await admin.locator('#media-form [name="relativePath"]').fill("photos/本地图片.jpg");
  await admin.locator('#media-form [name="title"]').fill("本地测试图片");
  await admin.locator('#media-form [name="alt"]').fill("这是一张本地测试图片");
  await admin.locator('#media-form button[type="submit"]').click();
  await admin.locator('#status').getByText("上传成功，尚未发布").waitFor({ timeout: 5000 });
  assert.equal(store.publicEntries().some((entry) => entry.relativePath === "photos/本地图片.jpg"), false);
  await admin.locator("#items li").filter({ hasText: "本地图片.jpg" }).getByRole("button", { name: "发布" }).click();
  await admin.locator("#items li").filter({ hasText: "本地图片.jpg" }).getByText("已发布").waitFor();
  assert.equal(store.publicEntries().some((entry) => entry.relativePath === "photos/本地图片.jpg"), true);
  await mkdir(path.resolve(import.meta.dirname, "../artifacts/app-verification"), { recursive: true });
  await admin.screenshot({ path: path.resolve(import.meta.dirname, "../artifacts/app-verification/content-admin.png"), fullPage: true });
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
  await page.locator('.file-grid button[data-file-name="clip.mp4"]').click();
  await page.locator('.video-viewer video').waitFor({ state: "visible" });
  assert.equal(await page.locator(".video-viewer p").textContent(), "A short clip");
  await mkdir(path.resolve(import.meta.dirname, "../artifacts/app-verification"), { recursive: true });
  await page.screenshot({ path: path.resolve(import.meta.dirname, "../artifacts/app-verification/content-api-video.png") });
  await new Promise<void>((resolve) => backend.close(() => resolve()));
  backendOpen = false;
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.contentState === "error");
  assert.equal(await page.locator('.file-grid button[data-file-name="posts"]').count(), 0);
  console.log("Content integration passed: API article loads, draft and sample stay hidden, outage fails closed.");
} finally {
  await browser?.close();
  await vite?.close();
  if (backendOpen) await new Promise<void>((resolve) => backend.close(() => resolve()));
  store.close();
  await rm(temporaryRoot, { recursive: true, force: true });
}
