import { describe, expect, it } from "vitest";
import { createJpegGlitchRevealPlan, jpegGlitchRetrySeed } from "../apps/clone/src/jpeg-glitch-reveal.js";

describe("JPEG glitch reveal plan", () => {
  const seededRandom = (seed: number): (() => number) => {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
  };

  it("builds a denser irregular pulse sequence that still resolves monotonically", () => {
    const plan = createJpegGlitchRevealPlan({ random: seededRandom(42) });
    const glitchPhases = plan.phases.slice(0, -1);

    expect(plan.phases[0]).toMatchObject({
      params: {
        quality: 0.17,
        iterations: 10,
        resolutionScale: 0.63
      }
    });
    expect(glitchPhases).toHaveLength(10);
    expect(new Set(glitchPhases.map((phase) => phase.holdMs)).size).toBeGreaterThan(3);
    expect(glitchPhases.every((phase) => phase.holdMs >= 90 && phase.holdMs <= 210)).toBe(true);
    expect(glitchPhases.every((phase, index, phases) => index === 0
      || (phase.params.quality >= phases[index - 1]!.params.quality
        && phase.params.iterations <= phases[index - 1]!.params.iterations
        && phase.params.resolutionScale >= phases[index - 1]!.params.resolutionScale))).toBe(true);
    expect(plan.minimumVisibleMs).toBeGreaterThanOrEqual(1_400);
    expect(plan.minimumVisibleMs).toBeLessThanOrEqual(2_600);
  });

  it("varies the codec seed, cadence and tear form for every reveal", () => {
    const first = createJpegGlitchRevealPlan({ random: seededRandom(7) });
    const replay = createJpegGlitchRevealPlan({ random: seededRandom(7) });
    const second = createJpegGlitchRevealPlan({ random: seededRandom(8) });
    const glitchPhases = first.phases.slice(0, -1);

    expect(first).toEqual(replay);
    expect(first).not.toEqual(second);
    expect(new Set(glitchPhases.map((phase) => phase.params.seed)).size).toBe(glitchPhases.length);
    expect(glitchPhases.every((phase) => phase.params.speed >= 7 && phase.params.speed <= 14)).toBe(true);
    expect(new Set(glitchPhases.map((phase) => phase.params.speed)).size).toBeGreaterThan(3);
    expect(glitchPhases.some((phase) => phase.params.vertical)).toBe(true);
    expect(glitchPhases.some((phase) => !phase.params.vertical)).toBe(true);
    expect(glitchPhases.every((phase) => phase.params.randomFlip && !phase.params.bypass)).toBe(true);
    expect(first.phases.at(-1)?.params.bypass).toBe(true);
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
