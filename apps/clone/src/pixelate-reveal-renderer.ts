import { VFX } from "@vfx-js/core";
import type { ContainedImageBounds } from "./image-reveal.js";

export interface PixelateRevealRuntime {
  now(): number;
  runAnimation(callback: () => void): () => void;
}

export interface PixelateRevealFrame {
  readonly progress: number;
  readonly producedFrames: number;
}

interface PixelateRevealCallbacks {
  readonly onFrame: (frame: PixelateRevealFrame) => void;
  readonly onComplete: () => void;
  readonly onFailure: () => void;
}

// The VFX-JS pixelateTransition preset uses a one-second entrance.
const TRANSITION_MS = 1_000;
const COMPLETION_GRACE_MS = 80;

export class PixelateRevealRenderer {
  private generation = 0;
  private vfx: VFX | undefined;
  private canvas: HTMLCanvasElement | undefined;
  private sourceImage: HTMLImageElement | undefined;
  private stopAnimation: (() => void) | undefined;
  private zoom = 1;

  constructor(
    private readonly stage: HTMLElement,
    private readonly runtime: PixelateRevealRuntime
  ) {}

  setZoom(zoom: number): void {
    this.zoom = zoom;
    if (this.sourceImage) this.sourceImage.style.scale = String(zoom);
  }

  async start(source: string, bounds: ContainedImageBounds, callbacks: PixelateRevealCallbacks): Promise<boolean> {
    this.cancel();
    const generation = this.generation;
    const sourceImage = document.createElement("img");
    sourceImage.className = "image-viewer__pixelate-source";
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
      canvas.classList.add("image-viewer__pixelate-canvas");
      canvas.style.visibility = "hidden";
      this.alignCanvasToViewport();

      await vfx.add(sourceImage, { shader: "pixelateTransition" });
      if (generation !== this.generation) return false;

      const startedAt = this.runtime.now();
      let producedFrames = 0;
      this.stopAnimation = this.runtime.runAnimation(() => {
        if (generation !== this.generation || !this.vfx || !this.canvas) return;
        try {
          this.alignCanvasToViewport();
          this.vfx.render();
          producedFrames += 1;
          canvas.style.visibility = "visible";
          const elapsedMs = Math.max(0, this.runtime.now() - startedAt);
          callbacks.onFrame({
            progress: Math.min(1, elapsedMs / TRANSITION_MS),
            producedFrames
          });
          if (elapsedMs >= TRANSITION_MS + COMPLETION_GRACE_MS) this.complete(generation, callbacks);
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

  private alignCanvasToViewport(): void {
    if (!this.canvas) return;
    // VFX draws from viewport-relative bounds, while this fixed canvas is
    // positioned relative to the centered stage in letterboxed viewports.
    const stageBounds = this.stage.getBoundingClientRect();
    const left = `${-stageBounds.left}px`;
    const top = `${-stageBounds.top}px`;
    if (this.canvas.style.left !== left) this.canvas.style.left = left;
    if (this.canvas.style.top !== top) this.canvas.style.top = top;
  }

  private complete(generation: number, callbacks: PixelateRevealCallbacks): void {
    if (generation !== this.generation) return;
    this.release();
    callbacks.onComplete();
  }

  private fail(generation: number, callbacks: PixelateRevealCallbacks): void {
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
