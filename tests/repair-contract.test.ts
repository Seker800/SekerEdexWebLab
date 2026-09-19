import { describe, expect, it } from "vitest";
import { withRepairComparison } from "../src/config/repair-contract.js";
import { scenarioContractSchema, type ScenarioContract } from "../src/config/contract.js";

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
      validationCommands: [],
      repairComparison: {
        maxDifferenceRatio: 0.04,
        comparisonOptions: { threshold: 0.08, includeAA: true },
        regionMaxDifferenceRatios: {},
        maxRegionRegressionRatio: 0.001
      }
    };

    const repairContract = withRepairComparison(contract);

    expect(repairContract.maxDifferenceRatio).toBe(0.04);
    expect(repairContract.comparisonOptions).toEqual({ threshold: 0.08, includeAA: true });
    expect(contract.maxDifferenceRatio).toBe(0.07);
    expect(contract.comparisonOptions).toBeUndefined();
    expect(repairContract.maxRegionRegressionRatio).toBe(0.001);
  });

  it("requires a declared repair profile", () => {
    const contract = scenarioContractSchema.parse({
      scenarioId: "no-repair-profile",
      targetScreenshotPath: "reference.png",
      replicaUrl: "http://127.0.0.1:4174",
      viewport: { width: 200, height: 200 },
      maxDifferenceRatio: 0.1
    });
    expect(() => withRepairComparison(contract)).toThrow("repairComparison");
  });
});
