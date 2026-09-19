import { describe, expect, it } from "vitest";
import { renderContentMarkdown } from "../apps/clone/src/content/markdown-renderer.js";
import { buildContentTree } from "../apps/clone/src/content/content-tree.js";
import type { ContentEntry } from "../apps/clone/src/content/content-model.js";

const entries: readonly ContentEntry[] = [
  { kind: "document", relativePath: "posts/trip/index.md", title: "Trip", summary: "Notes", publishedAt: "2026-09-19", tags: [], markdown: "" },
  { kind: "document", relativePath: "posts/next.md", title: "Next", summary: "Next", publishedAt: "2026-09-20", tags: [], markdown: "" },
  { kind: "media", relativePath: "posts/trip/ridge.webp", url: "/assets/ridge.webp", mediaType: "image/webp", alt: "ridge" }
];
const tree = buildContentTree(entries);

describe("blog content renderer", () => {
  it("renders the supported article structure", () => {
    const html = renderContentMarkdown("# Title\n\nA **bold** value with `code`.\n\n- First\n- Second\n\n1. One\n2. Two", { documentPath: "posts/trip/index.md", tree });
    expect(html).toContain('<h1 id="title" tabindex="-1">Title</h1>');
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html.replaceAll("\n", "")).toContain("<ul><li>First</li><li>Second</li></ul>");
    expect(html.replaceAll("\n", "")).toContain("<ol><li>One</li><li>Two</li></ol>");
  });

  it("escapes raw markup and only links http protocols", () => {
    const html = renderContentMarkdown('<img src=x onerror=alert(1)> [bad](javascript:alert(1)) [good](https://example.com)', { documentPath: "posts/trip/index.md", tree });
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://example.com"');
  });

  it("resolves local documents and images against the typed content tree", () => {
    const html = renderContentMarkdown("[Next](../next.md)\n\n![Ridge at sunrise](./ridge.webp)", { documentPath: "posts/trip/index.md", tree });
    expect(html).toContain('data-content-path="posts/next.md"');
    expect(html).toContain('href="#/blog/posts/next.md"');
    expect(html).toContain('data-content-path="posts/trip/ridge.webp"');
    expect(html).toContain('src="/assets/ridge.webp"');
    expect(html).toContain('alt="Ridge at sunrise"');
  });

  it("does not emit navigable markup for missing local resources or empty image alt", () => {
    const html = renderContentMarkdown("[Missing](./missing.md) ![](./ridge.webp) ![Gone](./missing.webp)", { documentPath: "posts/trip/index.md", tree });
    expect(html).not.toContain("data-content-path");
    expect(html).toContain("content-reference--missing");
    expect(html).toContain("content-image--invalid");
    expect(html).toContain("Missing image: Gone");
  });

  it("keeps mail links in-page-safe and external web links isolated", () => {
    const html = renderContentMarkdown("[Mail](mailto:test@example.com) [Web](http://example.com)", { documentPath: "posts/trip/index.md", tree });
    expect(html).toContain('href="mailto:test@example.com"');
    expect(html).toContain('href="http://example.com" target="_blank" rel="noopener noreferrer"');
  });

  it("preserves safe in-page and site-root links without treating them as missing content", () => {
    const html = renderContentMarkdown("[Section](#details)\n\n## Details\n\n[Home](/) [Unsafe](//example.com)", { documentPath: "posts/trip/index.md", tree });
    expect(html).toContain('href="#details" data-content-anchor="details"');
    expect(html).toContain('<h2 id="details" tabindex="-1">Details</h2>');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('href="//example.com"');
    expect(html.match(/content-reference--missing/gu)).toHaveLength(1);
  });

  it("gives duplicate and non-latin headings stable unique anchors", () => {
    const html = renderContentMarkdown("[跳转](#你好-世界)\n\n## 你好 世界\n\n## 你好 世界", { documentPath: "posts/trip/index.md", tree });
    expect(html).toContain('data-content-anchor="你好-世界"');
    expect(html).toContain('<h2 id="你好-世界" tabindex="-1">你好 世界</h2>');
    expect(html).toContain('<h2 id="你好-世界-2" tabindex="-1">你好 世界</h2>');
  });

  it("does not nest an image button inside a Markdown link", () => {
    const html = renderContentMarkdown("[![Ridge at sunrise](./ridge.webp)](../next.md)", { documentPath: "posts/trip/index.md", tree });
    expect(html).toContain('href="#/blog/posts/next.md"');
    expect(html).toContain('<img src="/assets/ridge.webp" alt="Ridge at sunrise"');
    expect(html).not.toContain("<button");
  });
});
