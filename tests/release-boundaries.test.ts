import { describe, expect, it } from "vitest";
import { assertContentOwnedObjectKey, assertSiteOwnedObjectKey, createSiteFileIndex, parseSiteFileIndex, siteBuildEnvironment } from "../scripts/release-boundaries.js";

describe("production release ownership", () => {
  it("keeps site and content object namespaces mutually exclusive", () => {
    expect(() => assertSiteOwnedObjectKey("index.html")).not.toThrow();
    expect(() => assertSiteOwnedObjectKey("assets/app-123.js")).not.toThrow();
    expect(() => assertSiteOwnedObjectKey("content/current.json")).toThrow(/content-owned/i);
    expect(() => assertContentOwnedObjectKey("content/current.json")).not.toThrow();
    expect(() => assertContentOwnedObjectKey("deployment.json")).toThrow(/site-owned/i);
    expect(() => assertContentOwnedObjectKey("content/../index.html")).toThrow(/unsafe/i);
  });

  it("removes every local author-content selector from a site build", () => {
    expect(siteBuildEnvironment({
      PATH: "/bin",
      SEKER_CONTENT_ROOT: "../private/blog",
      SEKER_CONTENT_PROFILE: "author",
      SEKER_CONTENT_DELIVERY: "embedded"
    })).toEqual({ PATH: "/bin", SEKER_CONTENT_DELIVERY: "runtime" });
  });

  it("only accepts an explicit index of site-owned files for stale cleanup", () => {
    expect(createSiteFileIndex(["index.html", "assets/app.js", "index.html"])).toEqual({
      schemaVersion: 1,
      files: ["assets/app.js", "index.html"]
    });
    expect(parseSiteFileIndex({ schemaVersion: 1, files: ["index.html"] })).toEqual(["index.html"]);
    expect(() => parseSiteFileIndex({ schemaVersion: 1, files: ["content/current.json"] })).toThrow(/content-owned/i);
    expect(() => parseSiteFileIndex({ schemaVersion: 1, files: ["index.html"], content: [] })).toThrow(/schema/i);
  });
});
