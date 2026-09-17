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
  rejectedRepairs: [],
  sourceEvidence: {
    repositoryUrl: "https://github.com/example/reference-app.git",
    revision: "0123456789abcdef",
    localPath: ".cache/upstream/reference-app",
    guidePath: "docs/SOURCE_PORT_MAP.md",
    entryPaths: ["src/shell.css", "src/shell.ts"],
    modules: [{
      name: "network-globe",
      entryPaths: ["src/globe.ts", "src/globe.css"]
    }]
  }
};

describe("Codex repair prompt", () => {
  it("requires source inspection before screenshot calibration", () => {
    const prompt = buildRepairPrompt(request);

    expect(prompt).toContain("0123456789abcdef");
    expect(prompt).toContain(".cache/upstream/reference-app/src/shell.css");
    expect(prompt).toContain("docs/SOURCE_PORT_MAP.md");
    expect(prompt).toContain("Source module network-globe");
    expect(prompt).toContain(".cache/upstream/reference-app/src/globe.ts");
    expect(prompt).toContain("identify the highest-impact visual module");
    expect(prompt.indexOf("Read the source evidence first")).toBeLessThan(prompt.indexOf("Inspect the target screenshot"));
    expect(prompt).toContain("Use screenshots to calibrate runtime state and verify the port");
    expect(prompt).toContain("Do not add styles or behavior that only apply during screenshot capture or static mode");
    expect(prompt).toContain("must improve the normal interactive application");
  });

  it("includes rejected candidates as regression counterexamples", () => {
    const prompt = buildRepairPrompt({
      ...request,
      attempt: 2,
      rejectedRepairs: [{
        attempt: 1,
        summary: "Mapped normal text to the medium font face",
        changedFiles: ["apps/clone/src/styles.css"],
        reason: "Visual difference did not improve: 4.624% to 4.710%",
        baselineDifferenceRatio: 0.04624,
        candidateDifferenceRatio: 0.0471
      }]
    });

    expect(prompt).toContain("regression counterexamples");
    expect(prompt).toContain("Mapped normal text to the medium font face");
    expect(prompt).toContain("4.624% to 4.710%");
    expect(prompt).toContain("do not repeat them");
  });
});
