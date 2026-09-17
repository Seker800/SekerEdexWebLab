import type { ScenarioContract } from "./contract.js";

export function withRepairThreshold(contract: ScenarioContract, maxDifferenceRatio: number): ScenarioContract {
  if (maxDifferenceRatio < 0 || maxDifferenceRatio > 1) {
    throw new Error(`Repair threshold must be between 0 and 1; received ${maxDifferenceRatio}`);
  }
  return { ...contract, maxDifferenceRatio };
}
