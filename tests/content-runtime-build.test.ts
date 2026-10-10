import { describe, expect, it } from "vitest";
import { runtimeContentConfiguration } from "../apps/clone/vite.config.js";

describe("production content configuration", () => {
  it("requires an explicit public HTTPS API origin", () => {
    expect(runtimeContentConfiguration({ SEKER_CONTENT_API_ORIGIN: "https://content.example" })).toEqual({ delivery: "runtime", apiOrigin: "https://content.example" });
    expect(() => runtimeContentConfiguration({})).toThrow(/API origin/i);
    expect(() => runtimeContentConfiguration({ SEKER_CONTENT_API_ORIGIN: "http://public.example" })).toThrow(/HTTPS/i);
  });
});
