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
}

export interface JpegGlitchRevealPlan {
  readonly minimumVisibleMs: number;
  readonly phases: readonly JpegGlitchRevealPhase[];
}

interface JpegGlitchRevealOptions {
  readonly reducedMotion?: boolean;
}

const BASE_PARAMS = Object.freeze({
  seed: 0.35,
  randomFlip: true,
  vertical: false,
  speed: 0,
  bypass: false
});

const PHASES = Object.freeze([
  { holdMs: 240, quality: 0.17, iterations: 10, resolutionScale: 0.63 },
  { holdMs: 220, quality: 0.3, iterations: 8, resolutionScale: 0.72 },
  { holdMs: 220, quality: 0.48, iterations: 6, resolutionScale: 0.82 },
  { holdMs: 220, quality: 0.7, iterations: 3, resolutionScale: 0.92 },
  { holdMs: 500, quality: 1, iterations: 0, resolutionScale: 1, bypass: true }
]);

const RETRY_SEED_STEP = 0.173;

export function jpegGlitchRetrySeed(seed: number, retry: number): number {
  return (seed + Math.max(0, retry) * RETRY_SEED_STEP) % 1;
}

export function createJpegGlitchRevealPlan(options: JpegGlitchRevealOptions = {}): JpegGlitchRevealPlan {
  if (options.reducedMotion) return Object.freeze({ minimumVisibleMs: 0, phases: Object.freeze([]) });

  const phases = PHASES.map(({ holdMs, ...params }) => Object.freeze({
    holdMs,
    params: Object.freeze({ ...BASE_PARAMS, ...params })
  }));
  return Object.freeze({
    minimumVisibleMs: phases.reduce((total, phase) => total + phase.holdMs, 0),
    phases: Object.freeze(phases)
  });
}
