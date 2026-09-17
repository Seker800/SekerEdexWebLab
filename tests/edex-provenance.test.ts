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
});
