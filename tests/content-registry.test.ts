import { describe, expect, it } from "vitest";
import { createContentManifest } from "../apps/clone/src/content/content-registry.js";

const article = `---
title: Mountain notes
summary: A documented climb.
publishedAt: 2026-09-19
tags:
  - travel
  - photography
---
# Mountain notes

![Ridge at sunrise](./ridge.webp)`;

describe("content registry", () => {
  it("accepts content-root-relative source paths without knowing the repository layout", () => {
    const manifest = createContentManifest({
      markdownSources: { "posts/mountain/index.md": article },
      mediaSources: { "posts/mountain/ridge.webp": "/assets/ridge-HASH.webp" }
    });

    expect(manifest.entries.map((entry) => entry.relativePath)).toEqual([
      "posts/mountain/index.md",
      "posts/mountain/ridge.webp"
    ]);
  });

  it("discovers nested documents and colocated media without source-specific wiring", () => {
    const manifest = createContentManifest({
      markdownSources: { "posts/mountain/index.md": article },
      mediaSources: { "posts/mountain/ridge.webp": "/assets/ridge-HASH.webp" }
    });

    expect(manifest.entries).toEqual([
      expect.objectContaining({ kind: "document", relativePath: "posts/mountain/index.md", title: "Mountain notes", tags: ["travel", "photography"] }),
      expect.objectContaining({ kind: "media", relativePath: "posts/mountain/ridge.webp", url: "/assets/ridge-HASH.webp", mediaType: "image/webp", alt: "ridge" })
    ]);
  });

  it("keeps legacy comma-separated tags readable during migration", () => {
    const manifest = createContentManifest({
      markdownSources: { "about.md": article
        .replace("tags:\n  - travel\n  - photography", "tags: travel, photography")
        .replace("\n\n![Ridge at sunrise](./ridge.webp)", "") },
      mediaSources: {}
    });

    expect(manifest.entries[0]).toMatchObject({ tags: ["travel", "photography"] });
  });

  it.each([
    "../secret.md",
    "/absolute.md",
    "posts//empty.md",
    "posts\\windows.md"
  ])("rejects unsafe or non-canonical source path %s", (sourcePath) => {
    expect(() => createContentManifest({ markdownSources: { [sourcePath]: article }, mediaSources: {} })).toThrow(/content path/i);
  });

  it("rejects a file-directory collision deterministically", () => {
    expect(() => createContentManifest({
      markdownSources: {
        "posts.md": article,
        "posts.md/nested.md": article
      },
      mediaSources: {}
    })).toThrow(/collision/i);
  });

  it("rejects local images without alt text or a manifest target", () => {
    expect(() => createContentManifest({
      markdownSources: { "posts/mountain/index.md": article.replace("![Ridge at sunrise]", "![]") },
      mediaSources: { "posts/mountain/ridge.webp": "/assets/ridge.webp" }
    })).toThrow(/alt text.*posts\/mountain\/index\.md/i);

    expect(() => createContentManifest({
      markdownSources: { "posts/mountain/index.md": article },
      mediaSources: {}
    })).toThrow(/missing content reference.*ridge\.webp/i);
  });

  it("reports malformed documents, unsupported media, duplicate paths and broken local links", () => {
    expect(() => createContentManifest({ markdownSources: { "broken.md": "# no frontmatter" }, mediaSources: {} })).toThrow(/missing frontmatter/i);
    expect(() => createContentManifest({ markdownSources: { "broken.md": "---\ntitle: [\n---\nbody" }, mediaSources: {} })).toThrow(/invalid yaml/i);
    expect(() => createContentManifest({ markdownSources: {}, mediaSources: { "photo.bmp": "/photo.bmp" } })).toThrow(/unsupported content media/i);
    expect(() => createContentManifest({
      markdownSources: { "photo.jpg": article.replace("\n\n![Ridge at sunrise](./ridge.webp)", "") },
      mediaSources: { "photo.jpg": "/photo.jpg" }
    })).toThrow(/duplicate file path/i);
    expect(() => createContentManifest({
      markdownSources: { "about.md": article.replace("![Ridge at sunrise](./ridge.webp)", "[Missing](./missing.md)") },
      mediaSources: {}
    })).toThrow(/missing content reference.*missing\.md/i);
  });

  it("allows external, anchor and root links without treating them as manifest paths", () => {
    const source = article.replace("![Ridge at sunrise](./ridge.webp)", "[Web](https://example.com) [Mail](mailto:test@example.com) [Heading](#top) [Root](/root)");
    expect(() => createContentManifest({ markdownSources: { "about.md": source }, mediaSources: {} })).not.toThrow();
  });
});
