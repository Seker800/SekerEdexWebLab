export interface JpegGlitchRevealParams {
  readonly quality: number;
  readonly seed: number;
  readonly iterations: number;
  readonly resolutionScale: number;
  readonly randomFlip: boolean;
  readonly vertical: boolean;
  readonly speed: number;
  readonly bypass: boolean;
}

export interface JpegGlitchRevealPhase {
  readonly holdMs: number;
  readonly params: JpegGlitchRevealParams;
  readonly presentation: {
    readonly opacity: number;
    readonly brightness: number;
  };
}

export interface JpegGlitchRevealPlan {
  readonly minimumVisibleMs: number;
  readonly phases: readonly JpegGlitchRevealPhase[];
}

interface JpegGlitchRevealOptions {
  readonly reducedMotion?: boolean;
  readonly random?: () => number;
}

const MIN_GLITCH_PHASE_COUNT = 4;
const MAX_GLITCH_PHASE_COUNT = 10;
const MIN_GLITCH_DURATION_MS = 900;
const MIN_PULSE_INTERVAL_MS = 90;
const MAX_PULSE_INTERVAL_MS = 260;
const CLEAR_HOLD_MS = 500;

const RETRY_SEED_STEP = 0.173;

export function jpegGlitchRetrySeed(seed: number, retry: number): number {
  return (seed + Math.max(0, retry) * RETRY_SEED_STEP) % 1;
}

export function createJpegGlitchRevealPlan(options: JpegGlitchRevealOptions = {}): JpegGlitchRevealPlan {
  if (options.reducedMotion) return Object.freeze({ minimumVisibleMs: 0, phases: Object.freeze([]) });

  const random = options.random ?? Math.random;
  const glitchPhaseCount = Math.min(
    MAX_GLITCH_PHASE_COUNT,
    MIN_GLITCH_PHASE_COUNT + Math.floor(random() * (MAX_GLITCH_PHASE_COUNT - MIN_GLITCH_PHASE_COUNT + 1))
  );
  const verticalPhases = Array.from({ length: glitchPhaseCount }, () => random() < 0.3);
  if (verticalPhases.every(Boolean)) verticalPhases[Math.floor(random() * glitchPhaseCount)] = false;
  else if (verticalPhases.every((vertical) => !vertical)) verticalPhases[Math.floor(random() * glitchPhaseCount)] = true;
  const minimumPulseInterval = Math.max(MIN_PULSE_INTERVAL_MS, Math.ceil(MIN_GLITCH_DURATION_MS / glitchPhaseCount));
  const maximumPulseInterval = Math.max(MAX_PULSE_INTERVAL_MS, minimumPulseInterval + 120);
  const glitchPhases = Array.from({ length: glitchPhaseCount }, (_, index) => {
    const progress = index / (glitchPhaseCount - 1);
    return Object.freeze({
      holdMs: Math.round(minimumPulseInterval + random() * (maximumPulseInterval - minimumPulseInterval)),
      params: Object.freeze({
        quality: Number((0.17 + progress * 0.71).toFixed(3)),
        seed: random(),
        iterations: Math.max(1, Math.round(10 - progress * 9)),
        resolutionScale: Number((0.63 + progress * 0.33).toFixed(3)),
        randomFlip: true,
        vertical: verticalPhases[index]!,
        speed: Number((7 + random() * 7).toFixed(3)),
        bypass: false
      }),
      presentation: Object.freeze({
        opacity: Number((0.68 + random() * 0.32).toFixed(3)),
        brightness: Number((0.82 + random() * 0.38).toFixed(3))
      })
    });
  });
  const clearPhase = Object.freeze({
    holdMs: CLEAR_HOLD_MS,
    params: Object.freeze({
      quality: 1,
      seed: 0,
      iterations: 0,
      resolutionScale: 1,
      randomFlip: false,
      vertical: false,
      speed: 0,
      bypass: true
    }),
    presentation: Object.freeze({ opacity: 1, brightness: 1 })
  });
  const phases = [...glitchPhases, clearPhase];
  return Object.freeze({
    minimumVisibleMs: phases.reduce((total, phase) => total + phase.holdMs, 0),
    phases: Object.freeze(phases)
  });
}
