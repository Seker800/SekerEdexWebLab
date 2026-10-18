import { describe, expect, it, vi } from "vitest";
import { fetchContentApi } from "../apps/clone/src/content/content-api.js";
import { buildContentTree, listContentDirectory } from "../apps/clone/src/content/content-tree.js";

const source = { schemaVersion: 1, id: "seker-content", kind: "author", visibility: "public", defaultLicense: "All rights reserved" };

describe("independent API content client", () => {
  it.each(["headers", "body"])("bounds stalled %s and aborts the request", async (phase) => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | null | undefined;
      const pending = new Promise<Response>(() => undefined);
      const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, options) => {
        requestSignal = options?.signal;
        return phase === "headers" ? pending : Promise.resolve(new Response(new ReadableStream()));
      });
      let failure: unknown;
      void fetchContentApi("https://content.example", fetcher).catch((error: unknown) => { failure = error; });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(failure).toBeInstanceOf(Error);
      expect(requestSignal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("loads ordered Markdown, links, images and videos from an HTTPS API", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 1, source, entries: [
      { kind: "media", relativePath: "travel/clip.mp4", url: "/api/v1/media/00000000-0000-0000-0000-000000000000", mediaType: "video/mp4", alt: "Clip", sortOrder: 30 },
      { kind: "document", relativePath: "travel/story.md", title: "Story", summary: "", publishedAt: "2026-10-11", tags: [], markdown: "# Story", sortOrder: 10 },
      { kind: "link", relativePath: "travel/source.url", title: "Source", summary: "", href: "https://example.org/story", sortOrder: 20 }
    ] }), { status: 200 }));
    const loaded = await fetchContentApi("https://content.example", fetcher);
    expect(fetcher).toHaveBeenCalledWith("https://content.example/api/v1/content", expect.objectContaining({ cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: expect.any(AbortSignal) }));
    expect(loaded.manifest.entries).toHaveLength(3);
    const tree = buildContentTree(loaded.manifest.entries);
    expect(listContentDirectory(tree, "travel").map((entry) => entry.relativePath)).toEqual(["travel/story.md", "travel/source.url", "travel/clip.mp4"]);
    expect(loaded.manifest.entries[0]).toMatchObject({ url: "https://content.example/api/v1/media/00000000-0000-0000-0000-000000000000" });
  });

  it("fails closed on invalid origin, media URL or response", async () => {
    await expect(fetchContentApi("http://public.example", vi.fn())).rejects.toThrow(/HTTPS/i);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 1, source, entries: [{ kind: "media", relativePath: "a.jpg", url: "https://evil.example/a.jpg", mediaType: "image/jpeg", alt: "A", sortOrder: 1 }] }), { status: 200 }));
    await expect(fetchContentApi("https://content.example", fetcher)).rejects.toThrow(/media URL/i);
    await expect(fetchContentApi("https://content.example", vi.fn().mockResolvedValue(new Response("", { status: 503 })))).rejects.toThrow(/503/);
  });
});
