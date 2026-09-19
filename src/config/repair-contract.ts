import type { ScenarioContract } from "./contract.js";

export function withRepairComparison(contract: ScenarioContract): ScenarioContract {
  const profile = contract.repairComparison;
  if (!profile) throw new Error("Automated repair requires a repairComparison profile");
  return {
    ...contract,
    maxDifferenceRatio: profile.maxDifferenceRatio,
    comparisonOptions: profile.comparisonOptions,
    maxRegionRegressionRatio: profile.maxRegionRegressionRatio,
    comparisonRegions: Object.fromEntries(Object.entries(contract.comparisonRegions ?? {}).map(([name, region]) => {
      const { maxDifferenceRatio: _currentThreshold, ...bounds } = region;
      const repairThreshold = profile.regionMaxDifferenceRatios[name];
      return [name, repairThreshold === undefined ? bounds : { ...bounds, maxDifferenceRatio: repairThreshold }];
    }))
  };
}

export const withRepairThreshold = withRepairComparison;
