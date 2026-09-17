import { describe, expect, it } from "vitest";
import { createTelemetrySnapshot, sparklinePoints } from "../apps/clone/src/telemetry.js";

describe("telemetry adapter", () => {
  it("produces bounded deterministic display data", () => {
    const first = createTelemetrySnapshot(4);
    const second = createTelemetrySnapshot(4);
    expect(first).toEqual(second);
    expect(first.cpu).toBeGreaterThanOrEqual(0);
    expect(first.cpu).toBeLessThanOrEqual(100);
    expect(first.historyA).toHaveLength(28);
  });

  it("converts samples to SVG points", () => {
    expect(sparklinePoints([0, 50, 100], 100, 100)).toBe("0.0,100.0 50.0,50.0 100.0,0.0");
  });
});

