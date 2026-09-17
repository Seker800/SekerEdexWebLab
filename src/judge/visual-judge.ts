import type { BrowserDiagnostics, Verdict, VisualMetrics } from "../domain/types.js";

export function judgeVisualResult(
  metrics: VisualMetrics,
  replicaDiagnostics: BrowserDiagnostics,
  maxDifferenceRatio: number
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

  return { status: reasons.length === 0 ? "passed" : "failed", reasons, metrics };
}
