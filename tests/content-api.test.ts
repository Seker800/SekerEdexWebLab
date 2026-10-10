import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ContentStore } from "../services/content-api/content-store.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function store(): Promise<ContentStore> {
  const root = await mkdtemp(path.join(tmpdir(), "seker-content-test-"));
  roots.push(root);
  return new ContentStore(path.join(root, "content.sqlite"));
}

describe("independent content database", () => {
  it("starts empty and never inserts public examples", async () => {
    const db = await store();
    expect(db.publicEntries()).toEqual([]);
    db.close();
  });

  it("publishes only approved Markdown and links in directory and order", async () => {
    const db = await store();
    const second = db.create({ kind: "document", relativePath: "journal/b.md", title: "B", summary: "B summary", markdown: "# B", publishedAt: "2026-10-11", tags: [], sortOrder: 20, status: "published" });
    db.create({ kind: "document", relativePath: "journal/a.md", title: "A", summary: "A summary", markdown: "# A", publishedAt: "2026-10-11", tags: [], sortOrder: 10, status: "draft" });
    db.create({ kind: "link", relativePath: "journal/link.url", title: "Link", summary: "External", href: "https://example.org/post", sortOrder: 30, status: "published" });
    expect(db.publicEntries().map((entry) => entry.relativePath)).toEqual(["journal/b.md", "journal/link.url"]);
    db.update(second.id, { sortOrder: 40 });
    expect(db.publicEntries().map((entry) => entry.relativePath)).toEqual(["journal/link.url", "journal/b.md"]);
    expect(db.get(second.id)).toMatchObject({ markdown: "# B" });
    db.close();
  });

  it("rejects traversal, duplicate paths, unsafe links, and unpublished media", async () => {
    const db = await store();
    expect(() => db.create({ kind: "link", relativePath: "../escape.url", title: "Bad", summary: "Bad", href: "javascript:alert(1)", sortOrder: 0, status: "published" })).toThrow();
    expect(() => db.create({ kind: "link", relativePath: "safe.url", title: "Bad", summary: "Bad", href: "javascript:alert(1)", sortOrder: 0, status: "published" })).toThrow();
    db.create({ kind: "media", relativePath: "photos/one.webp", title: "One", alt: "One", mediaType: "image/webp", storageKey: "00000000-0000-0000-0000-000000000000", sortOrder: 0, status: "draft" });
    expect(() => db.create({ kind: "media", relativePath: "photos/one.webp", title: "Other", alt: "Other", mediaType: "image/webp", storageKey: "ffffffff-ffff-ffff-ffff-ffffffffffff", sortOrder: 1, status: "published" })).toThrow();
    expect(db.publicEntries()).toEqual([]);
    db.close();
  });

  it("never accepts a file that collides with a directory", async () => {
    const db = await store();
    db.create({ kind: "document", relativePath: "trip", title: "Trip", summary: "", markdown: "", publishedAt: "2026-10-11", tags: [], sortOrder: 0, status: "draft" });
    expect(() => db.create({ kind: "document", relativePath: "trip/post.md", title: "Post", summary: "", markdown: "", publishedAt: "2026-10-11", tags: [], sortOrder: 0, status: "draft" })).toThrow(/collision/i);
    db.close();
  });
});
