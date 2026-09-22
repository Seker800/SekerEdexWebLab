import { VFX } from "@vfx-js/core";
import { GlitchEffect } from "@vfx-js/effects";
import type { ContainedImageBounds } from "./image-reveal.js";
import { createGpuGlitchRevealPlan } from "./gpu-glitch-reveal.js";

export interface GpuGlitchRevealRuntime {
  now(): number;
  runAnimation(callback: () => void): () => void;
}

export interface GpuGlitchRevealFrame {
  readonly phase: number;
  readonly intensity: number;
  readonly speed: number;
  readonly producedFrames: number;
}

interface GpuGlitchRevealCallbacks {
  readonly onFrame: (frame: GpuGlitchRevealFrame) => void;
  readonly onPulse: () => void;
  readonly onComplete: () => void;
  readonly onFailure: () => void;
}

const MAX_FRAME_DELTA_MS = 50;

export class GpuGlitchRevealRenderer {
  private generation = 0;
  private vfx: VFX | undefined;
  private canvas: HTMLCanvasElement | undefined;
  private sourceImage: HTMLImageElement | undefined;
  private stopAnimation: (() => void) | undefined;
  private zoom = 1;

  constructor(
    private readonly stage: HTMLElement,
    private readonly runtime: GpuGlitchRevealRuntime,
    private readonly reducedMotion: boolean
  ) {}

  canAnimate(): boolean {
    return !this.reducedMotion;
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
    if (this.sourceImage) this.sourceImage.style.scale = String(zoom);
  }

  async start(source: string, bounds: ContainedImageBounds, callbacks: GpuGlitchRevealCallbacks): Promise<boolean> {
    this.cancel();
    if (!this.canAnimate()) return false;
    const plan = createGpuGlitchRevealPlan();
    const generation = this.generation;
    const sourceImage = document.createElement("img");
    sourceImage.className = "image-viewer__glitch-source";
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

    try {
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
      if (!vfx || !canvas) throw new Error("VFX canvas initialization failed");
      this.vfx = vfx;
      this.canvas = canvas;
      canvas.classList.add("image-viewer__glitch-canvas");
      canvas.style.visibility = "hidden";

      const firstPhase = plan.phases[0]!;
      const effect = new GlitchEffect({ intensity: firstPhase.params.intensity, speed: firstPhase.params.speed });
      await vfx.add(sourceImage, { effect });
      if (generation !== this.generation) return false;

      let phase = 0;
      let phaseElapsedMs = 0;
      let producedFrames = 0;
      let lastTick = this.runtime.now();
      const publishPhase = (): void => {
        const current = plan.phases[phase]!;
        callbacks.onFrame({
          phase,
          intensity: current.params.intensity,
          speed: current.params.speed,
          producedFrames
        });
      };
      const enterPhase = (): void => {
        const current = plan.phases[phase]!;
        canvas.style.opacity = String(current.presentation.opacity);
        canvas.style.filter = `brightness(${current.presentation.brightness})`;
        effect.setParams(current.params);
        publishPhase();
        if (!current.params.bypass) callbacks.onPulse();
      };

      this.stopAnimation = this.runtime.runAnimation(() => {
        if (generation !== this.generation || !this.vfx || !this.canvas) return;
        try {
          const now = this.runtime.now();
          const deltaMs = Math.min(MAX_FRAME_DELTA_MS, Math.max(0, now - lastTick));
          lastTick = now;
          this.vfx.render();
          producedFrames += 1;
          if (producedFrames === 1) {
            canvas.style.visibility = "visible";
            enterPhase();
            return;
          }

          phaseElapsedMs += deltaMs;
          if (phaseElapsedMs < plan.phases[phase]!.holdMs) return;
          if (phase === plan.phases.length - 1) {
            this.complete(generation, callbacks);
            return;
          }
          phase += 1;
          phaseElapsedMs = 0;
          enterPhase();
        } catch {
          this.fail(generation, callbacks);
        }
      });
      return true;
    } catch {
      this.fail(generation, callbacks);
      return false;
    }
  }

  cancel(): void {
    this.generation += 1;
    this.release();
  }

  dispose(): void {
    this.cancel();
  }

  private complete(generation: number, callbacks: GpuGlitchRevealCallbacks): void {
    if (generation !== this.generation) return;
    this.release();
    callbacks.onComplete();
  }

  private fail(generation: number, callbacks: GpuGlitchRevealCallbacks): void {
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
    this.sourceImage?.remove();
    this.sourceImage = undefined;
  }
}
