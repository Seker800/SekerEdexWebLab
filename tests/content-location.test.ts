import { describe, expect, it } from "vitest";
import { contentHash, parseContentHash } from "../apps/clone/src/content/content-location.js";

describe("content location", () => {
  it("round-trips static-hosting-safe content hashes", () => {
    expect(parseContentHash(contentHash("posts/my trip/index.md"))).toBe("posts/my trip/index.md");
    expect(contentHash("")).toBe("#/blog/");
  });

  it.each(["", "#other", "#/blog/../../secret", "#/blog/%2Fetc%2Fpasswd", "#/blog/%E0%A4%A"])("rejects invalid hash %s", (hash) => {
    expect(parseContentHash(hash)).toBeUndefined();
  });
});
