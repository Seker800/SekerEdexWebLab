import { describe, expect, it } from "vitest";
import { judgeVisualResult } from "../src/judge/visual-judge.js";
import type { VisualMetrics } from "../src/domain/types.js";

const metrics: VisualMetrics = {
  targetWidth: 100,
  targetHeight: 100,
  replicaWidth: 100,
  replicaHeight: 100,
  comparedWidth: 100,
  comparedHeight: 100,
  differentPixels: 10,
  totalPixels: 10_000,
  differenceRatio: 0.001,
  dimensionsMatch: true
};

describe("visual judge", () => {
  it("passes clean output within the frozen threshold", () => {
    const verdict = judgeVisualResult(metrics, { consoleErrors: [], pageErrors: [], finalUrl: "http://replica" }, 0.002);
    expect(verdict.status).toBe("passed");
  });

  it("reports independent visual and runtime failures", () => {
    const verdict = judgeVisualResult(metrics, { consoleErrors: ["boom"], pageErrors: [], finalUrl: "http://replica" }, 0);
    expect(verdict.status).toBe("failed");
    expect(verdict.reasons).toHaveLength(2);
  });
});
