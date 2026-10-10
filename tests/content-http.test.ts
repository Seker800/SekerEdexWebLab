import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ContentStore } from "../services/content-api/content-store.js";
import { createContentHandler, hashAdminPassword } from "../services/content-api/http.js";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { await Promise.all(cleanup.splice(0).map((close) => close())); });

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "seker-http-test-"));
  const store = new ContentStore(path.join(root, "db.sqlite"));
  const origin = "http://127.0.0.1";
  const server = createServer(createContentHandler({ store, mediaRoot: path.join(root, "media"), allowedOrigins: ["https://site.example"], adminOrigin: origin, adminUsername: "author", adminPasswordHash: hashAdminPassword("long local test password"), requireHttps: false }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  cleanup.push(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); store.close(); await rm(root, { recursive: true, force: true }); });
  return { store, base: `http://127.0.0.1:${address.port}` };
}

describe("public content API and private administration", () => {
  it("serves only published content to allowed static frontends", async () => {
    const { store, base } = await fixture();
    store.create({ kind: "document", relativePath: "draft.md", title: "Draft", summary: "", markdown: "secret", publishedAt: "2026-10-11", tags: [], sortOrder: 1, status: "draft" });
    store.create({ kind: "document", relativePath: "published.md", title: "Published", summary: "", markdown: "public", publishedAt: "2026-10-11", tags: [], sortOrder: 2, status: "published" });
    const response = await fetch(`${base}/api/v1/content`, { headers: { Origin: "https://site.example" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://site.example");
    expect((await response.json() as { entries: Array<{ title: string }> }).entries.map((entry) => entry.title)).toEqual(["Published"]);
    const foreign = await fetch(`${base}/api/v1/content`, { headers: { Origin: "https://foreign.example" } });
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects unauthenticated and cross-origin mutations", async () => {
    const { base } = await fixture();
    const payload = { kind: "document", relativePath: "post.md", title: "Post", summary: "", markdown: "hello", publishedAt: "2026-10-11", tags: [], sortOrder: 1, status: "published" };
    const headers = { Authorization: `Basic ${Buffer.from("author:long local test password").toString("base64")}`, "Content-Type": "application/json" };
    expect((await fetch(`${base}/api/v1/admin/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).status).toBe(401);
    expect((await fetch(`${base}/api/v1/admin/items`, { method: "POST", headers: { ...headers, Origin: "https://foreign.example" }, body: JSON.stringify(payload) })).status).toBe(403);
    const accepted = await fetch(`${base}/api/v1/admin/items`, { method: "POST", headers: { ...headers, Origin: "http://127.0.0.1" }, body: JSON.stringify(payload) });
    expect(accepted.status).toBe(201);
    expect((await fetch(`${base}/api/v1/content`).then((response) => response.json()) as { entries: unknown[] }).entries).toHaveLength(1);
  });

  it("serves an authenticated manager and keeps uploaded media draft until published", async () => {
    const { base } = await fixture();
    const authorization = `Basic ${Buffer.from("author:long local test password").toString("base64")}`;
    const admin = await fetch(`${base}/admin`, { headers: { Authorization: authorization } });
    expect(admin.status).toBe(200);
    expect(await admin.text()).toContain("Content manager");
    const upload = await fetch(`${base}/api/v1/admin/media`, {
      method: "POST",
      headers: { Authorization: authorization, Origin: "http://127.0.0.1", "Content-Type": "image/png", "X-Content-Path": "photos/one.png", "X-Content-Title": "One", "X-Content-Alt": "One photo" },
      body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
    });
    expect(upload.status).toBe(201);
    const item = await upload.json() as { id: string };
    expect((await fetch(`${base}/api/v1/media/${item.id}`)).status).toBe(404);
    const published = await fetch(`${base}/api/v1/admin/items/${item.id}`, { method: "PATCH", headers: { Authorization: authorization, Origin: "http://127.0.0.1", "Content-Type": "application/json" }, body: JSON.stringify({ status: "published" }) });
    expect(published.status).toBe(200);
    const media = await fetch(`${base}/api/v1/media/${item.id}`, { headers: { Range: "bytes=0-3" } });
    expect(media.status).toBe(206);
    expect(new Uint8Array(await media.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it("limits repeated failed administrator passwords", async () => {
    const { base } = await fixture();
    const wrong = `Basic ${Buffer.from("author:wrong password value").toString("base64")}`;
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      statuses.push((await fetch(`${base}/admin`, { headers: { Authorization: wrong } })).status);
    }
    expect(statuses.at(-1)).toBe(429);
  });
});
