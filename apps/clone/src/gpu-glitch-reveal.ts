export interface GpuGlitchRevealParams {
  readonly intensity: number;
  readonly speed: number;
  readonly bypass: boolean;
}

export interface GpuGlitchRevealPhase {
  readonly holdMs: number;
  readonly params: GpuGlitchRevealParams;
  readonly presentation: {
    readonly opacity: number;
    readonly brightness: number;
  };
}

export interface GpuGlitchRevealPlan {
  readonly minimumVisibleMs: number;
  readonly phases: readonly GpuGlitchRevealPhase[];
}

interface GpuGlitchRevealOptions {
  readonly random?: () => number;
}

const MIN_GLITCH_PHASE_COUNT = 4;
const MAX_GLITCH_PHASE_COUNT = 10;
const MIN_GLITCH_DURATION_MS = 900;
const MIN_PULSE_INTERVAL_MS = 90;
const MAX_PULSE_INTERVAL_MS = 260;
const CLEAR_HOLD_MS = 500;

export function createGpuGlitchRevealPlan(options: GpuGlitchRevealOptions = {}): GpuGlitchRevealPlan {
  const random = options.random ?? Math.random;
  const glitchPhaseCount = Math.min(
    MAX_GLITCH_PHASE_COUNT,
    MIN_GLITCH_PHASE_COUNT + Math.floor(random() * (MAX_GLITCH_PHASE_COUNT - MIN_GLITCH_PHASE_COUNT + 1))
  );
  const minimumPulseInterval = Math.max(MIN_PULSE_INTERVAL_MS, Math.ceil(MIN_GLITCH_DURATION_MS / glitchPhaseCount));
  const maximumPulseInterval = Math.max(MAX_PULSE_INTERVAL_MS, minimumPulseInterval + 120);
  const glitchPhases = Array.from({ length: glitchPhaseCount }, (_, index) => {
    const progress = index / (glitchPhaseCount - 1);
    return Object.freeze({
      holdMs: Math.round(minimumPulseInterval + random() * (maximumPulseInterval - minimumPulseInterval)),
      params: Object.freeze({
        intensity: Number((1.25 - progress * 1.1).toFixed(3)),
        speed: Number((2.5 + random() * 4.5).toFixed(3)),
        bypass: false
      }),
      presentation: Object.freeze({
        opacity: Number((0.72 + random() * 0.28).toFixed(3)),
        brightness: Number((0.82 + random() * 0.38).toFixed(3))
      })
    });
  });
  const clearPhase = Object.freeze({
    holdMs: CLEAR_HOLD_MS,
    params: Object.freeze({ intensity: 0, speed: 0, bypass: true }),
    presentation: Object.freeze({ opacity: 1, brightness: 1 })
  });
  const phases = [...glitchPhases, clearPhase];
  return Object.freeze({
    minimumVisibleMs: phases.reduce((total, phase) => total + phase.holdMs, 0),
    phases: Object.freeze(phases)
  });
}
