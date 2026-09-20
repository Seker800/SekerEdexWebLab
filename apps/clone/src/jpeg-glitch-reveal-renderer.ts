import { VFX } from "@vfx-js/core";
import { JPEGGlitchEffect } from "@vfx-js/effects";
import type { ContainedImageBounds } from "./image-reveal.js";
import {
  createJpegGlitchRevealPlan,
  jpegGlitchRetrySeed
} from "./jpeg-glitch-reveal.js";

export interface JpegGlitchRevealRuntime {
  now(): number;
  runAnimation(callback: () => void): () => void;
}

export interface JpegGlitchRevealFrame {
  readonly phase: number;
  readonly quality: number;
  readonly seed: number;
  readonly speed: number;
  readonly producedFrames: number;
}

interface JpegGlitchRevealCallbacks {
  readonly onFrame: (frame: JpegGlitchRevealFrame) => void;
  readonly onComplete: () => void;
  readonly onFailure: () => void;
}

const MAX_FRAME_DELTA_MS = 50;
const FRAME_RETRY_AFTER_MS = 220;
const MAX_FRAME_RETRIES = 3;

export class JpegGlitchRevealRenderer {
  private generation = 0;
  private vfx: VFX | undefined;
  private canvas: HTMLCanvasElement | undefined;
  private effect: JPEGGlitchEffect | undefined;
  private sourceImage: HTMLImageElement | undefined;
  private stopAnimation: (() => void) | undefined;
  private zoom = 1;

  constructor(
    private readonly stage: HTMLElement,
    private readonly runtime: JpegGlitchRevealRuntime,
    private readonly reducedMotion: boolean
  ) {}

  canAnimate(): boolean {
    return !this.reducedMotion;
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
    if (this.sourceImage) this.sourceImage.style.scale = String(zoom);
  }

  async start(source: string, bounds: ContainedImageBounds, callbacks: JpegGlitchRevealCallbacks): Promise<boolean> {
    this.cancel();
    if (!this.canAnimate()) return false;
    const plan = createJpegGlitchRevealPlan();

    const generation = this.generation;
    const sourceImage = document.createElement("img");
    sourceImage.className = "image-viewer__jpeg-glitch-source";
    sourceImage.alt = "";
    sourceImage.setAttribute("aria-hidden", "true");
    sourceImage.src = source;
    sourceImage.style.left = `${bounds.left}px`;
    sourceImage.style.top = `${bounds.top}px`;
    sourceImage.style.width = `${bounds.width}px`;
    sourceImage.style.height = `${bounds.height}px`;
    sourceImage.style.scale = String(this.zoom);
    this.stage.append(sourceImage);
    this.sourceImage = sourceImage;

    try {
      await sourceImage.decode();
    } catch {
      if (!sourceImage.complete || sourceImage.naturalWidth === 0) {
        this.fail(generation, callbacks);
        return false;
      }
    }
    if (generation !== this.generation) return false;

    const canvasesBefore = new Set(this.stage.querySelectorAll(":scope > canvas"));
    const vfx = VFX.init({
      autoplay: false,
      pixelRatio: Math.min(window.devicePixelRatio, 1),
      scrollPadding: false,
      wrapper: this.stage,
      zIndex: 1
    });
    const canvas = Array.from(this.stage.children).find(
      (child): child is HTMLCanvasElement => child instanceof HTMLCanvasElement && !canvasesBefore.has(child)
    );
    if (!vfx || !canvas) {
      vfx?.destroy();
      this.fail(generation, callbacks);
      return false;
    }
    this.vfx = vfx;
    this.canvas = canvas;
    canvas.classList.add("image-viewer__jpeg-glitch-canvas");
    canvas.style.visibility = "hidden";

    const effect = new JPEGGlitchEffect(plan.phases[0]!.params);
    this.effect = effect;
    try {
      await vfx.add(sourceImage, { effect });
    } catch {
      this.fail(generation, callbacks);
      return false;
    }
    if (generation !== this.generation) return false;

    let phase = 0;
    const requestedAtFrame = effect.producedFrames;
    let phaseElapsedMs = 0;
    let frameWaitElapsedMs = 0;
    let frameRetries = 0;
    let activeSeed = plan.phases[0]!.params.seed;
    let publishedFrames = -1;
    let lastTick = this.runtime.now();
    let waitingForFirstFrame = true;
    const applyPresentation = (): void => {
      const presentation = plan.phases[phase]!.presentation;
      canvas.style.opacity = String(presentation.opacity);
      canvas.style.filter = `brightness(${presentation.brightness})`;
    };
    const publishPhase = (): void => {
      callbacks.onFrame({
        phase,
        quality: plan.phases[phase]!.params.quality,
        seed: activeSeed,
        speed: plan.phases[phase]!.params.speed,
        producedFrames: effect.producedFrames
      });
      publishedFrames = effect.producedFrames;
    };
    this.stopAnimation = this.runtime.runAnimation(() => {
      if (generation !== this.generation || !this.vfx || !this.effect || !this.canvas) return;
      try {
        const now = this.runtime.now();
        const deltaMs = Math.min(MAX_FRAME_DELTA_MS, Math.max(0, now - lastTick));
        lastTick = now;
        this.vfx.render();

        if (waitingForFirstFrame) {
          if (this.effect.producedFrames <= requestedAtFrame) {
            frameWaitElapsedMs += deltaMs;
            if (frameWaitElapsedMs < FRAME_RETRY_AFTER_MS) return;
            frameWaitElapsedMs = 0;
            frameRetries += 1;
            if (frameRetries > MAX_FRAME_RETRIES) {
              this.fail(generation, callbacks);
              return;
            }
            const params = plan.phases[phase]!.params;
            activeSeed = jpegGlitchRetrySeed(params.seed, frameRetries);
            this.effect.setParams({ ...params, seed: activeSeed });
            return;
          }
          waitingForFirstFrame = false;
          phaseElapsedMs = 0;
          frameWaitElapsedMs = 0;
          frameRetries = 0;
          canvas.style.visibility = "visible";
          applyPresentation();
          publishPhase();
          return;
        }

        phaseElapsedMs += deltaMs;
        if (this.effect.producedFrames > publishedFrames) {
          publishPhase();
        }
        if (phaseElapsedMs < plan.phases[phase]!.holdMs) return;
        if (phase === plan.phases.length - 1) {
          this.complete(generation, callbacks);
          return;
        }

        phase += 1;
        phaseElapsedMs = 0;
        activeSeed = plan.phases[phase]!.params.seed;
        this.effect.setParams(plan.phases[phase]!.params);
        applyPresentation();
        publishPhase();
      } catch {
        this.fail(generation, callbacks);
      }
    });
    return true;
  }

  cancel(): void {
    this.generation += 1;
    this.release();
  }

  dispose(): void {
    this.cancel();
  }

  private complete(generation: number, callbacks: JpegGlitchRevealCallbacks): void {
    if (generation !== this.generation) return;
    this.release();
    callbacks.onComplete();
  }

  private fail(generation: number, callbacks: JpegGlitchRevealCallbacks): void {
    if (generation !== this.generation) return;
    this.release();
    callbacks.onFailure();
  }

  private release(): void {
    this.stopAnimation?.();
    this.stopAnimation = undefined;
    if (this.vfx && this.sourceImage) this.vfx.remove(this.sourceImage);
    this.vfx?.destroy();
    this.vfx = undefined;
    this.canvas = undefined;
    this.effect = undefined;
    this.sourceImage?.remove();
    this.sourceImage = undefined;
  }
}
