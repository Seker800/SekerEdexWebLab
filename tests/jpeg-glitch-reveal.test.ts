import { describe, expect, it } from "vitest";
import { createJpegGlitchRevealPlan, jpegGlitchRetrySeed } from "../apps/clone/src/jpeg-glitch-reveal.js";

describe("JPEG glitch reveal plan", () => {
  it("starts from the selected destructive preset and resolves monotonically", () => {
    const plan = createJpegGlitchRevealPlan();

    expect(plan.phases[0]).toMatchObject({
      holdMs: 240,
      params: {
        quality: 0.17,
        seed: 0.35,
        iterations: 10,
        resolutionScale: 0.63
      }
    });
    expect(plan.phases).toHaveLength(5);
    expect(plan.phases.every((phase, index, phases) => index === 0
      || (phase.params.quality > phases[index - 1]!.params.quality
        && phase.params.iterations < phases[index - 1]!.params.iterations
        && phase.params.resolutionScale > phases[index - 1]!.params.resolutionScale))).toBe(true);
    expect(plan.minimumVisibleMs).toBeGreaterThanOrEqual(1_000);
    expect(plan.minimumVisibleMs).toBeLessThanOrEqual(1_500);
  });

  it("pins every phase to a deterministic still frame", () => {
    const plan = createJpegGlitchRevealPlan();

    expect(plan.phases.every((phase) => phase.params.seed === 0.35)).toBe(true);
    expect(plan.phases.every((phase) => phase.params.speed === 0)).toBe(true);
    expect(plan.phases.every((phase) => phase.params.randomFlip && !phase.params.vertical)).toBe(true);
    expect(plan.phases.slice(0, -1).every((phase) => !phase.params.bypass)).toBe(true);
    expect(plan.phases.at(-1)?.params.bypass).toBe(true);
  });

  it("removes the effect entirely for reduced motion", () => {
    const plan = createJpegGlitchRevealPlan({ reducedMotion: true });

    expect(plan.phases).toEqual([]);
    expect(plan.minimumVisibleMs).toBe(0);
  });

  it("uses bounded deterministic retry seeds when a corrupted JPEG cannot decode", () => {
    expect(jpegGlitchRetrySeed(0.35, 0)).toBe(0.35);
    expect(jpegGlitchRetrySeed(0.35, 1)).toBeCloseTo(0.523, 6);
    expect(jpegGlitchRetrySeed(0.35, 2)).toBeCloseTo(0.696, 6);
    expect(jpegGlitchRetrySeed(0.35, 1)).toBe(jpegGlitchRetrySeed(0.35, 1));
  });
});
