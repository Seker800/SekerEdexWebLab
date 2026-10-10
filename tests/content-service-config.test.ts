import { describe, expect, it } from "vitest";
import { contentServiceConfiguration } from "../services/content-api/serve.js";

describe("content service startup guard", () => {
  const complete = {
    CONTENT_DATA_DIR: "/tmp/seker-content-test",
    CONTENT_ADMIN_USERNAME: "author",
    CONTENT_ADMIN_PASSWORD_HASH: `${"a".repeat(32)}:${"b".repeat(128)}`,
    CONTENT_ADMIN_ORIGIN: "https://private.example",
    CONTENT_PUBLIC_ORIGINS: "https://site-a.example,https://site-b.example"
  };

  it("requires external storage, private credentials and explicit frontend origins", () => {
    const config = contentServiceConfiguration(complete);
    expect(config.allowedOrigins).toEqual(["https://site-a.example", "https://site-b.example"]);
    expect(config.requireHttps).toBe(true);
    expect(() => contentServiceConfiguration({ ...complete, CONTENT_DATA_DIR: "./inside-repo" })).toThrow(/absolute/i);
    expect(() => contentServiceConfiguration({ ...complete, CONTENT_ADMIN_PASSWORD_HASH: "" })).toThrow(/password/i);
    expect(() => contentServiceConfiguration({ ...complete, CONTENT_PUBLIC_ORIGINS: "*" })).toThrow(/origin/i);
  });
});
