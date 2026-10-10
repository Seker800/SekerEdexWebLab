import { describe, expect, it } from "vitest";
import { assertSiteOwnedObjectKey, createSiteFileIndex, parseSiteFileIndex, siteBuildEnvironment } from "../scripts/release-boundaries.js";

describe("production release ownership", () => {
  it("keeps legacy content objects outside site ownership", () => {
    expect(() => assertSiteOwnedObjectKey("index.html")).not.toThrow();
    expect(() => assertSiteOwnedObjectKey("assets/app-123.js")).not.toThrow();
    expect(() => assertSiteOwnedObjectKey("content/current.json")).toThrow(/content-owned/i);
    expect(() => assertSiteOwnedObjectKey("content/../index.html")).toThrow(/unsafe/i);
  });

  it("passes only public API configuration to the site build", () => {
    expect(siteBuildEnvironment({
      PATH: "/bin",
      SEKER_CONTENT_ROOT: "../private/blog",
      SEKER_CONTENT_PROFILE: "author",
      SEKER_CONTENT_DELIVERY: "embedded",
      SEKER_CONTENT_API_ORIGIN: "https://content.example",
      CONTENT_ADMIN_PASSWORD_HASH: "private",
      CONTENT_DATA_DIR: "/private/data"
    })).toEqual({ PATH: "/bin", SEKER_CONTENT_API_ORIGIN: "https://content.example", SEKER_CONTENT_DELIVERY: "runtime" });
    expect(() => siteBuildEnvironment({ SEKER_CONTENT_API_ORIGIN: "http://192.168.1.89:4175" })).toThrow(/public HTTPS/i);
    expect(() => siteBuildEnvironment({ SEKER_CONTENT_API_ORIGIN: "https://localhost:4175" })).toThrow(/public HTTPS/i);
    expect(() => siteBuildEnvironment({})).toThrow(/API origin/i);
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
