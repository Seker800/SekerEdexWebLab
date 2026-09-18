import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("eDEX target provenance", () => {
  it("binds automatic repair to the source revision containing the exact screenshot", async () => {
    const provenance = JSON.parse(await readFile(path.resolve("references/edex-ui-v2.2.8/provenance.json"), "utf8")) as {
      screenshotCommit: string;
      screenshotSha256: string;
    };
    const contract = JSON.parse(await readFile(path.resolve("specs/edex-command-deck.contract.json"), "utf8")) as {
      targetScreenshotPath: string;
      sourceEvidence: { revision: string; localPath: string };
    };
    const screenshot = await readFile(path.resolve(contract.targetScreenshotPath));
    const screenshotHash = createHash("sha256").update(screenshot).digest("hex");

    expect(screenshotHash).toBe(provenance.screenshotSha256);
    expect(contract.sourceEvidence.revision).toBe(provenance.screenshotCommit);
    expect(contract.sourceEvidence.localPath).toContain("edex-ui-visual-66ba190");
  });

  it("keeps the public license and upstream attribution attached to the port", async () => {
    const [license, upstreamLicense, firaLicense, encomLicense, notice, readme, packageMetadata] = await Promise.all([
      readFile(path.resolve("LICENSE"), "utf8"),
      readFile(path.resolve("apps/clone/UPSTREAM_LICENSE"), "utf8"),
      readFile(path.resolve("apps/clone/licenses/FIRA-OFL-1.1.txt"), "utf8"),
      readFile(path.resolve("apps/clone/licenses/ENCOM-GLOBE-MIT.txt"), "utf8"),
      readFile(path.resolve("NOTICE.md"), "utf8"),
      readFile(path.resolve("README.md"), "utf8"),
      readFile(path.resolve("package.json"), "utf8").then((content) => JSON.parse(content) as { license?: string })
    ]);

    expect(license).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(license).toContain("Version 3, 29 June 2007");
    expect(upstreamLicense).toBe(license);
    expect(firaLicense).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(encomLicense).toContain("Copyright (c) 2014-2017 Robert Scanlon");
    expect(packageMetadata.license).toBe("GPL-3.0-only");
    expect(readme).toMatch(/browser-native/i);
    expect(readme).toMatch(/unofficial browser port/i);
    expect(notice).toContain("GitSquared/eDEX-UI");
    expect(notice).toContain("66ba190ee5369523195c4012d0a798fbe4d43391");
  });
});
