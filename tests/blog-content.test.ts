import { describe, expect, it } from "vitest";
import { renderSafeMarkdown } from "../apps/clone/src/blog-content.js";

describe("blog content renderer", () => {
  it("renders the supported article structure", () => {
    const html = renderSafeMarkdown("# Title\n\nA **bold** value with `code`.\n\n- First\n- Second\n\n1. One\n2. Two");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<ul><li>First</li><li>Second</li></ul>");
    expect(html).toContain("<ol><li>One</li><li>Two</li></ol>");
  });

  it("escapes raw markup and only links http protocols", () => {
    const html = renderSafeMarkdown('<img src=x onerror=alert(1)> [bad](javascript:alert(1)) [good](https://example.com)');
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://example.com"');
  });
});
