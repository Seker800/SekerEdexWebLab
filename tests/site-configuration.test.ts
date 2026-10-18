import { describe, expect, it } from "vitest";
import { siteBuildEnvironment } from "../scripts/release-boundaries.js";

describe("explicit sample and API configuration", () => {
  const sample = { schemaVersion: 1, contentMode: "sample", contentApiOrigin: "" };
  it("allows deliberate sample releases without a backend", () => {
    expect(siteBuildEnvironment({ CONTENT_ADMIN_PASSWORD_HASH: "secret" }, sample)).toEqual({ SEKER_CONTENT_DELIVERY: "embedded" });
  });
  it("requires a valid origin in API mode and never downgrades to samples", () => {
    expect(siteBuildEnvironment({}, { ...sample, contentMode: "api", contentApiOrigin: "https://content.example" })).toEqual({ SEKER_CONTENT_DELIVERY: "runtime", SEKER_CONTENT_API_ORIGIN: "https://content.example" });
    expect(() => siteBuildEnvironment({}, { ...sample, contentMode: "api" })).toThrow();
    expect(() => siteBuildEnvironment({}, { ...sample, contentMode: "guess" })).toThrow();
    expect(() => siteBuildEnvironment({}, { ...sample, contentApiOrigin: "https://content.example" })).toThrow();
    expect(() => siteBuildEnvironment({}, { ...sample, contentMode: "api", contentApiOrigin: "http://127.0.0.1:4175" })).toThrow(/HTTPS/);
  });
});
