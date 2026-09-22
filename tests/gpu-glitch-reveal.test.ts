import { describe, expect, it } from "vitest";
import { createGpuGlitchRevealPlan } from "../apps/clone/src/gpu-glitch-reveal.js";

describe("GPU glitch reveal plan", () => {
  const seededRandom = (seed: number): (() => number) => {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
  };

  it("randomizes each reveal to between four and ten glitch pulses", () => {
    expect(createGpuGlitchRevealPlan({ random: () => 0 }).phases.slice(0, -1)).toHaveLength(4);
    expect(createGpuGlitchRevealPlan({ random: () => 0.999_999 }).phases.slice(0, -1)).toHaveLength(10);
  });

  it("resolves intensity monotonically with an irregular bounded cadence", () => {
    const plan = createGpuGlitchRevealPlan({ random: seededRandom(42) });
    const glitchPhases = plan.phases.slice(0, -1);
    expect(glitchPhases[0]?.params.intensity).toBe(1.25);
    expect(glitchPhases.at(-1)?.params.intensity).toBe(0.15);
    expect(new Set(glitchPhases.map((phase) => phase.holdMs)).size).toBeGreaterThan(2);
    expect(glitchPhases.every((phase, index, phases) => index === 0
      || phase.params.intensity <= phases[index - 1]!.params.intensity)).toBe(true);
    expect(glitchPhases.every((phase) => phase.params.speed >= 2.5 && phase.params.speed <= 7)).toBe(true);
    expect(plan.minimumVisibleMs).toBeGreaterThanOrEqual(1_400);
    expect(plan.minimumVisibleMs).toBeLessThanOrEqual(3_100);
    expect(plan.phases.at(-1)?.params).toEqual({ intensity: 0, speed: 0, bypass: true });
  });

  it("varies pulse cadence and presentation for each reveal", () => {
    const first = createGpuGlitchRevealPlan({ random: seededRandom(7) });
    const replay = createGpuGlitchRevealPlan({ random: seededRandom(7) });
    const second = createGpuGlitchRevealPlan({ random: seededRandom(8) });
    const glitchPhases = first.phases.slice(0, -1);
    expect(first).toEqual(replay);
    expect(first).not.toEqual(second);
    expect(new Set(glitchPhases.map((phase) => phase.params.speed)).size).toBeGreaterThan(3);
    expect(new Set(glitchPhases.map((phase) => phase.presentation.opacity)).size).toBeGreaterThan(3);
    expect(glitchPhases.every((phase) => phase.presentation.opacity >= 0.72 && phase.presentation.opacity <= 1)).toBe(true);
    expect(glitchPhases.every((phase) => !phase.params.bypass)).toBe(true);
  });
});
