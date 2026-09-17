import { describe, expect, it } from "vitest";
import { buildRepairPrompt } from "../src/adapters/codex/codex-repair-agent.js";
import type { RepairRequest } from "../src/domain/types.js";

const request: RepairRequest = {
  scenarioId: "source-backed-reference",
  attempt: 1,
  contractPath: "/artifacts/contract.json",
  targetScreenshotPath: "/artifacts/target.png",
  replicaScreenshotPath: "/artifacts/replica.png",
  diffScreenshotPath: "/artifacts/diff.png",
  verdictPath: "/artifacts/verdict.json",
  allowedPaths: ["apps/clone"],
  validationCommands: [["npm", "test"]],
  sourceEvidence: {
    repositoryUrl: "https://github.com/example/reference-app.git",
    revision: "0123456789abcdef",
    localPath: ".cache/upstream/reference-app",
    guidePath: "docs/SOURCE_PORT_MAP.md",
    entryPaths: ["src/shell.css", "src/shell.ts"]
  }
};

describe("Codex repair prompt", () => {
  it("requires source inspection before screenshot calibration", () => {
    const prompt = buildRepairPrompt(request);

    expect(prompt).toContain("0123456789abcdef");
    expect(prompt).toContain(".cache/upstream/reference-app/src/shell.css");
    expect(prompt).toContain("docs/SOURCE_PORT_MAP.md");
    expect(prompt.indexOf("Read the source evidence first")).toBeLessThan(prompt.indexOf("Inspect the target screenshot"));
    expect(prompt).toContain("Use screenshots to calibrate runtime state and verify the port");
    expect(prompt).toContain("Do not add styles or behavior that only apply during screenshot capture or static mode");
    expect(prompt).toContain("must improve the normal interactive application");
  });
});
