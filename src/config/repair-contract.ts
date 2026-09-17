import type { ScenarioContract } from "./contract.js";
import type { VisualComparisonOptions } from "../comparison/visual-comparator.js";

export function withRepairComparison(
  contract: ScenarioContract,
  maxDifferenceRatio: number,
  comparisonOptions?: Required<VisualComparisonOptions>
): ScenarioContract {
  if (maxDifferenceRatio < 0 || maxDifferenceRatio > 1) {
    throw new Error(`Repair threshold must be between 0 and 1; received ${maxDifferenceRatio}`);
  }
  return {
    ...contract,
    maxDifferenceRatio,
    ...(comparisonOptions ? { comparisonOptions } : {})
  };
}

export const withRepairThreshold = withRepairComparison;
