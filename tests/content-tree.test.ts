import { describe, expect, it } from "vitest";
import { buildContentTree, listContentDirectory, resolveContentReference } from "../apps/clone/src/content/content-tree.js";
import type { ContentEntry } from "../apps/clone/src/content/content-model.js";

const entries: readonly ContentEntry[] = [
  { kind: "document", relativePath: "posts/trip/index.md", title: "Trip", summary: "Notes", publishedAt: "2026-09-19", tags: ["travel"], markdown: "# Trip" },
  { kind: "document", relativePath: "posts/next.md", title: "Next", summary: "Next", publishedAt: "2026-09-20", tags: [], markdown: "# Next" },
  { kind: "media", relativePath: "posts/trip/ridge.webp", url: "/assets/ridge.webp", mediaType: "image/webp", alt: "ridge" }
];

describe("content tree", () => {
  it("projects real nested paths with directories first", () => {
    const tree = buildContentTree(entries);
    expect(listContentDirectory(tree, "").map((node) => node.relativePath)).toEqual(["posts"]);
    expect(listContentDirectory(tree, "posts").map((node) => node.relativePath)).toEqual(["posts/trip", "posts/next.md"]);
    expect(listContentDirectory(tree, "posts/trip").map((node) => node.relativePath)).toEqual(["posts/trip/index.md", "posts/trip/ridge.webp"]);
    expect(Object.isFrozen(tree.root)).toBe(true);
    expect(Object.isFrozen(tree.root.children)).toBe(true);
    expect(Object.isFrozen(tree.get("posts/trip/index.md"))).toBe(true);
  });

  it("resolves references inside the manifest and refuses root escapes", () => {
    const tree = buildContentTree(entries);
    expect(resolveContentReference(tree, "posts/trip/index.md", "./ridge.webp")?.relativePath).toBe("posts/trip/ridge.webp");
    expect(resolveContentReference(tree, "posts/trip/index.md", "../next.md")?.relativePath).toBe("posts/next.md");
    expect(resolveContentReference(tree, "posts/trip/index.md", "../../../../secret.md")).toBeUndefined();
    expect(resolveContentReference(tree, "posts/trip/index.md", "./missing.webp")).toBeUndefined();
    expect(resolveContentReference(tree, "posts/trip/index.md", "%E0%A4%A")).toBeUndefined();
    expect(resolveContentReference(tree, "posts/trip/index.md", "/absolute.md")).toBeUndefined();
  });
});
