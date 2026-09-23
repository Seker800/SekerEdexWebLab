import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { contentSourceDescriptorFilename, loadContentSource } from "../apps/clone/content-source.js";
import { createContentReleaseBundle } from "../scripts/content-release-bundle.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("content release bundle", () => {
  it("turns author Markdown and media into one immutable release without site files", async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), "seker-repository-"));
    const contentRoot = await mkdtemp(path.join(tmpdir(), "seker-author-content-"));
    temporaryDirectories.push(repositoryRoot, contentRoot);
    await mkdir(path.join(contentRoot, "posts", "hello"), { recursive: true });
    await writeFile(path.join(contentRoot, contentSourceDescriptorFilename), JSON.stringify({
      schemaVersion: 1,
      id: "seker-blog",
      kind: "author",
      visibility: "public",
      defaultLicense: "All rights reserved"
    }));
    await writeFile(path.join(contentRoot, "posts", "hello", "index.md"), [
      "---",
      "title: Hello",
      "summary: Intro",
      "publishedAt: 2026-09-23",
      "tags: [notes]",
      "---",
      "![Cover](./cover.webp)"
    ].join("\n"));
    await writeFile(path.join(contentRoot, "posts", "hello", "cover.webp"), "web-image");
    const source = await loadContentSource({ repositoryRoot, contentRoot, expectedKind: "author" });

    const bundle = await createContentReleaseBundle(source);

    expect(bundle.pointer.digest).toBe(source.digest);
    expect(bundle.manifest.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "document", relativePath: "posts/hello/index.md" }),
      expect.objectContaining({
        kind: "media",
        relativePath: "posts/hello/cover.webp",
        url: `/content/releases/${source.digest}/media/posts/hello/cover.webp`
      })
    ]));
    expect(bundle.manifestObjectKey).toBe(`content/releases/${source.digest}/manifest.json`);
    expect(bundle.mediaUploads).toEqual([{
      localPath: path.join(contentRoot, "posts", "hello", "cover.webp"),
      objectKey: `content/releases/${source.digest}/media/posts/hello/cover.webp`
    }]);
  });
});
