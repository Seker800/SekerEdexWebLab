import { describe, expect, it, vi } from "vitest";
import { contentReleaseManifestPath, contentReleaseMediaPath, createContentReleasePointer, fetchPublishedContent, parseContentReleasePointer, parsePublishedContentManifest } from "../apps/clone/src/content/content-release.js";
import type { ContentSourceDescriptor } from "../apps/clone/src/content/content-model.js";

const digest = "a".repeat(64);
const source: ContentSourceDescriptor = Object.freeze({
  schemaVersion: 1,
  id: "seker-blog",
  kind: "author",
  visibility: "public",
  defaultLicense: "All rights reserved"
});

describe("versioned content releases", () => {
  it("binds the pointer, manifest and encoded media URLs to one immutable digest", () => {
    const pointer = createContentReleasePointer(source, digest);
    expect(pointer.manifestPath).toBe(contentReleaseManifestPath(digest));
    expect(contentReleaseMediaPath(digest, "旅行/cover photo.webp"))
      .toBe(`/content/releases/${digest}/media/%E6%97%85%E8%A1%8C/cover%20photo.webp`);

    const manifest = parsePublishedContentManifest({
      schemaVersion: 1,
      source,
      digest,
      entries: [
        { kind: "document", relativePath: "posts/hello.md", title: "Hello", summary: "Intro", publishedAt: "2026-09-23", tags: ["notes"], markdown: "Hello" },
        { kind: "media", relativePath: "旅行/cover photo.webp", url: contentReleaseMediaPath(digest, "旅行/cover photo.webp"), mediaType: "image/webp", alt: "cover photo" }
      ]
    }, pointer);

    expect(manifest.entries).toHaveLength(2);
    expect(Object.isFrozen(manifest.entries)).toBe(true);
  });

  it("rejects sample identity, digest drift, extra fields and media URLs outside the release", () => {
    expect(() => parseContentReleasePointer({
      schemaVersion: 1,
      source: { ...source, kind: "sample" },
      digest,
      manifestPath: contentReleaseManifestPath(digest)
    })).toThrow(/author source/i);
    expect(() => parseContentReleasePointer({
      schemaVersion: 1,
      source,
      digest,
      manifestPath: "/content/releases/elsewhere/manifest.json",
      fallback: "/examples/blog"
    })).toThrow(/unexpected fields/i);

    const pointer = createContentReleasePointer(source, digest);
    expect(() => parsePublishedContentManifest({
      schemaVersion: 1,
      source,
      digest: "b".repeat(64),
      entries: []
    }, pointer)).toThrow(/does not match/i);
    expect(() => parsePublishedContentManifest({
      schemaVersion: 1,
      source,
      digest,
      entries: [{ kind: "media", relativePath: "cover.webp", url: "/cover.webp", mediaType: "image/webp", alt: "cover" }]
    }, pointer)).toThrow(/escapes its immutable release/i);
    expect(() => parsePublishedContentManifest({
      schemaVersion: 1,
      source,
      digest,
      entries: [{ kind: "document", relativePath: "bad.md", title: "Bad", summary: "Bad", publishedAt: "2026-99-99", tags: [], markdown: "" }]
    }, pointer)).toThrow(/publication date/i);
    expect(() => parsePublishedContentManifest({
      schemaVersion: 1,
      source,
      digest,
      entries: [{ kind: "media", relativePath: "cover.webp", url: contentReleaseMediaPath(digest, "cover.webp"), mediaType: "text/html", alt: "cover" }]
    }, pointer)).toThrow(/media type/i);
  });

  it("loads the no-cache pointer before the immutable manifest without falling back to samples", async () => {
    const pointer = createContentReleasePointer(source, digest);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(pointer), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ schemaVersion: 1, source, digest, entries: [] }), { status: 200 }));

    const result = await fetchPublishedContent(fetcher);

    expect(result).toMatchObject({ source: { kind: "author" }, digest, manifest: { entries: [] } });
    expect(fetcher).toHaveBeenNthCalledWith(1, "/content/current.json", { cache: "no-store" });
    expect(fetcher).toHaveBeenNthCalledWith(2, pointer.manifestPath, { cache: "force-cache" });
  });
});
