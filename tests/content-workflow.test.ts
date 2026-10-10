import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

describe("separate code and content workflows", () => {
  it("has no content uploader in the open-source site repository", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["deploy:site"]).toBe("tsx scripts/deploy-site.ts");
    expect(pkg.scripts["publish:content"]).toBeUndefined();
    expect(pkg.scripts["content:serve"]).toBe("tsx services/content-api/serve.ts");
    expect(pkg.scripts.deploy).toBeUndefined();
  });
});
