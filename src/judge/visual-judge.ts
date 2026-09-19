import type { BrowserDiagnostics, Verdict, VisualMetrics } from "../domain/types.js";

export function judgeVisualResult(
  metrics: VisualMetrics,
  replicaDiagnostics: BrowserDiagnostics,
  maxDifferenceRatio: number,
  regions: Record<string, { metrics: VisualMetrics; maxDifferenceRatio: number | null }> = {}
): Verdict {
  const reasons: string[] = [];

  if (!metrics.dimensionsMatch) {
    reasons.push(
      `Screenshot dimensions differ: target ${metrics.targetWidth}x${metrics.targetHeight}, replica ${metrics.replicaWidth}x${metrics.replicaHeight}`
    );
  }
  if (metrics.differenceRatio > maxDifferenceRatio) {
    reasons.push(
      `Visual difference ${(metrics.differenceRatio * 100).toFixed(3)}% exceeds ${(maxDifferenceRatio * 100).toFixed(3)}%`
    );
  }
  if (replicaDiagnostics.consoleErrors.length > 0) {
    reasons.push(`Replica emitted ${replicaDiagnostics.consoleErrors.length} console error(s)`);
  }
  if (replicaDiagnostics.pageErrors.length > 0) {
    reasons.push(`Replica emitted ${replicaDiagnostics.pageErrors.length} uncaught page error(s)`);
  }

  for (const [name, region] of Object.entries(regions)) {
    if (!region.metrics.dimensionsMatch) {
      reasons.push(`Visual region ${name} dimensions differ`);
    }
    if (region.maxDifferenceRatio !== null && region.metrics.differenceRatio > region.maxDifferenceRatio) {
      reasons.push(
        `Visual region ${name} difference ${(region.metrics.differenceRatio * 100).toFixed(3)}% exceeds ${(region.maxDifferenceRatio * 100).toFixed(3)}%`
      );
    }
  }

  const regionMetrics = Object.fromEntries(Object.entries(regions).map(([name, region]) => [name, region.metrics]));
  return {
    status: reasons.length === 0 ? "passed" : "failed",
    reasons,
    metrics,
    ...(Object.keys(regionMetrics).length > 0 ? { regionMetrics } : {})
  };
}
