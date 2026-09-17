import { describe, expect, it } from "vitest";
import { withRepairThreshold } from "../src/config/repair-contract.js";
import type { ScenarioContract } from "../src/config/contract.js";

describe("repair contract", () => {
  it("tightens the autonomous target without mutating the regression contract", () => {
    const contract: ScenarioContract = {
      scenarioId: "edex-command-deck",
      targetScreenshotPath: "reference.png",
      replicaUrl: "http://127.0.0.1:4174/?static=1",
      viewport: { width: 1934, height: 1094 },
      maxDifferenceRatio: 0.07,
      maxAttempts: 3,
      allowedPaths: ["apps/clone"],
      validationCommands: []
    };

    const repairContract = withRepairThreshold(contract, 0.04);

    expect(repairContract.maxDifferenceRatio).toBe(0.04);
    expect(contract.maxDifferenceRatio).toBe(0.07);
  });
});
