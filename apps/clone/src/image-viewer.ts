import type { BrowserFileEntry, BrowserImagePreview } from "./browser-filesystem.js";
import type { FullscreenContentOverlay } from "./fullscreen-content-overlay.js";
import { calculateContainedImageBounds, createImageRevealPlan, type ImageRevealPlan } from "./image-reveal.js";
import { PixelateRevealRenderer, type PixelateRevealRuntime } from "./pixelate-reveal-renderer.js";
import { localizeElements, translate, type Locale } from "./locale.js";

export type ImageViewerAction = "previous" | "next" | "zoom-out" | "zoom-in";

const imageViewerActions = new Set<ImageViewerAction>(["previous", "next", "zoom-out", "zoom-in"]);

function isImageViewerAction(value: string | undefined): value is ImageViewerAction {
  return value !== undefined && imageViewerActions.has(value as ImageViewerAction);
}

export interface ImageViewerEvents {
  readonly onOpen?: () => void;
  readonly onAction?: (action: ImageViewerAction) => void;
  readonly onSelectionChange?: (
    entry: Readonly<BrowserFileEntry>,
    description?: Readonly<{ alt: string; caption?: string }>
  ) => void;
}

export class ImageViewer {
  private readonly surface: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly image: HTMLImageElement;
  private readonly reveal: HTMLElement;
  private readonly revealTiles: HTMLElement[] = [];
  private readonly revealLabel: HTMLElement;
  private readonly revealPlan: ImageRevealPlan;
  private readonly pixelateReveal: PixelateRevealRenderer;
  private readonly title: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly zoomLabel: HTMLElement;
  private items: BrowserFileEntry[] = [];
  private index = 0;
  private zoom = 1;
  private revealRevision = 0;
  private revealTimer: number | undefined;
  private readonly descriptions = new Map<string, { alt: string; caption?: string }>();
  private locale: Locale;
  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (this.surface.hidden) return;
    if (event.key === "ArrowLeft") this.activate("previous");
    else if (event.key === "ArrowRight") this.activate("next");
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  constructor(
    private readonly overlay: FullscreenContentOverlay,
    revealRuntime: PixelateRevealRuntime,
    private readonly events: ImageViewerEvents = {},
    getLocale: () => Locale = () => "en"
  ) {
    this.locale = getLocale();
    this.surface = document.createElement("section");
    this.surface.className = "image-viewer";
    this.surface.hidden = true;
    this.surface.setAttribute("role", "region");
    this.surface.setAttribute("aria-labelledby", "image-viewer-title");
    this.surface.innerHTML = `
      <header class="image-viewer__header"><div><small data-i18n="mediaViewer">MEDIA VIEWER</small><h1 id="image-viewer-title"></h1></div></header>
      <div class="image-viewer__stage" data-reveal-state="ready">
        <img alt="">
        <div class="image-viewer__reveal" aria-hidden="true"></div>
        <span class="image-viewer__reveal-label" role="status" aria-live="polite"></span>
      </div>
      <p class="image-viewer__caption"></p>
      <footer><button type="button" data-viewer-action="previous" aria-label="Previous image" data-i18n="previous" data-i18n-aria="previousImage">← PREV</button><span class="image-viewer__counter"></span><button type="button" data-viewer-action="zoom-out" aria-label="Zoom out" data-i18n-aria="zoomOut">−</button><span class="image-viewer__zoom"></span><button type="button" data-viewer-action="zoom-in" aria-label="Zoom in" data-i18n-aria="zoomIn">+</button><button type="button" data-viewer-action="next" aria-label="Next image" data-i18n="next" data-i18n-aria="nextImage">NEXT →</button></footer>
    `;
    this.overlay.register("image", this.surface);
    this.stage = this.surface.querySelector(".image-viewer__stage")!;
    this.image = this.surface.querySelector("img")!;
    this.reveal = this.surface.querySelector(".image-viewer__reveal")!;
    this.revealLabel = this.surface.querySelector(".image-viewer__reveal-label")!;
    this.revealPlan = createImageRevealPlan();
    this.pixelateReveal = new PixelateRevealRenderer(this.stage, revealRuntime);
    this.reveal.style.setProperty("--image-reveal-columns", String(this.revealPlan.columns));
    this.reveal.style.setProperty("--image-reveal-rows", String(this.revealPlan.rows));
    this.reveal.style.setProperty("--image-reveal-tile-duration", `${this.revealPlan.tileDurationMs}ms`);
    for (const tile of this.revealPlan.tiles) {
      const block = document.createElement("span");
      block.className = "image-viewer__reveal-tile";
      block.style.setProperty("--image-reveal-delay", `${tile.delayMs}ms`);
      block.style.backgroundPosition = `${this.revealPlan.columns === 1 ? 0 : tile.column * 100 / (this.revealPlan.columns - 1)}% ${this.revealPlan.rows === 1 ? 0 : tile.row * 100 / (this.revealPlan.rows - 1)}%`;
      this.revealTiles.push(block);
      this.reveal.append(block);
    }
    this.title = this.surface.querySelector("#image-viewer-title")!;
    this.caption = this.surface.querySelector(".image-viewer__caption")!;
    this.counter = this.surface.querySelector(".image-viewer__counter")!;
    this.zoomLabel = this.surface.querySelector(".image-viewer__zoom")!;
    this.setLocale(this.locale);

    this.surface.addEventListener("click", (event) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-viewer-action]");
      if (!button) return;
      const action = button.dataset.viewerAction;
      if (isImageViewerAction(action)) this.activate(action);
    });
    document.addEventListener("keydown", this.handleKeydown, { capture: true });
  }

  open(items: readonly BrowserFileEntry[], selectedPath: string, description?: { alt: string; caption?: string }): void {
    this.items = items.filter((entry) => entry.preview?.kind === "image");
    if (this.items.length === 0) return;
    const wasOpen = this.overlay.isActive("image");
    this.descriptions.clear();
    if (description) this.descriptions.set(selectedPath, { ...description });
    this.index = Math.max(0, this.items.findIndex((entry) => entry.path === selectedPath));
    this.render(false);
    this.overlay.open("image");
    if (!wasOpen) this.events.onOpen?.();
  }

  close(options: { notify?: boolean } = {}): void {
    if (!this.overlay.isActive("image")) return;
    this.cancelReveal();
    this.overlay.close(options);
  }

  dispose(): void {
    this.close({ notify: false });
    this.cancelReveal();
    this.pixelateReveal.dispose();
    document.removeEventListener("keydown", this.handleKeydown, { capture: true });
    this.surface.remove();
  }

  setLocale(locale: Locale): void {
    this.locale = locale;
    localizeElements(this.surface, locale);
    const revealState = this.stage.dataset.revealState;
    if (revealState === "loading" && this.revealLabel.textContent) {
      this.revealLabel.textContent = translate(locale, this.image.complete ? "resolving" : "decoding");
    } else if (revealState === "error") this.revealLabel.textContent = translate(locale, "decodeError");
  }

  private move(direction: -1 | 1): void {
    this.index = (this.index + direction + this.items.length) % this.items.length;
    this.render(true);
  }

  private activate(action: ImageViewerAction): void {
    if (action === "previous") this.move(-1);
    else if (action === "next") this.move(1);
    else if (action === "zoom-out") this.setZoom(this.zoom - 0.25);
    else this.setZoom(this.zoom + 0.25);
    this.events.onAction?.(action);
  }

  private setZoom(value: number): void {
    this.zoom = Math.min(3, Math.max(0.5, value));
    this.image.style.scale = String(this.zoom);
    this.reveal.style.scale = String(this.zoom);
    this.pixelateReveal.setZoom(this.zoom);
    this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  private render(notifySelection: boolean): void {
    const entry = this.items[this.index]!;
    const preview = entry.preview as BrowserImagePreview;
    const description = this.descriptions.get(entry.path);
    this.title.textContent = entry.name;
    this.image.alt = description?.alt ?? preview.alt;
    this.caption.textContent = description?.caption ?? description?.alt ?? preview.caption ?? preview.alt;
    this.counter.textContent = `${this.index + 1} / ${this.items.length} · ${preview.mediaType}`;
    this.setZoom(1);
    void this.revealImage(preview.src);
    if (notifySelection) this.events.onSelectionChange?.(entry, description);
  }

  private async revealImage(source: string): Promise<void> {
    this.cancelReveal();
    const revision = this.revealRevision;
    this.stage.dataset.revealState = "loading";
    delete this.stage.dataset.revealEngine;
    delete this.stage.dataset.revealFrames;
    delete this.stage.dataset.revealProgress;
    this.stage.setAttribute("aria-busy", "true");
    this.revealLabel.textContent = translate(this.locale, "decoding");
    this.clearRevealTiles();
    this.image.src = source;

    try {
      await this.decodeImage();
    } catch {
      if (revision !== this.revealRevision) return;
      this.stage.dataset.revealState = "error";
      this.stage.setAttribute("aria-busy", "false");
      this.revealLabel.textContent = translate(this.locale, "decodeError");
      return;
    }
    if (revision !== this.revealRevision) return;

    const bounds = this.containedImageBounds();
    this.revealLabel.textContent = translate(this.locale, "resolving");
    const pixelateStarted = await this.pixelateReveal.start(source, bounds, {
      onFrame: (frame) => {
        if (revision !== this.revealRevision) return;
        this.stage.dataset.revealEngine = "pixelate";
        this.stage.dataset.revealState = "revealing";
        this.stage.dataset.revealProgress = String(frame.progress);
        this.stage.dataset.revealFrames = String(frame.producedFrames);
        this.revealLabel.textContent = "";
      },
      onComplete: () => this.finishReveal(revision),
      onFailure: () => {
        if (revision === this.revealRevision) this.startTileReveal(source, bounds, revision);
      }
    });
    if (!pixelateStarted && revision === this.revealRevision && this.stage.dataset.revealState === "loading") {
      this.startTileReveal(source, bounds, revision);
    }
  }

  private async decodeImage(): Promise<void> {
    try {
      await this.image.decode();
    } catch {
      if (!this.image.complete) {
        await new Promise<void>((resolve, reject) => {
          this.image.addEventListener("load", () => resolve(), { once: true });
          this.image.addEventListener("error", () => reject(new Error("Image failed to load")), { once: true });
        });
      }
    }
    if (this.image.naturalWidth === 0) throw new Error("Image failed to decode");
  }

  private finishReveal(revision: number): void {
    if (revision !== this.revealRevision) return;
    this.revealTimer = undefined;
    this.stage.dataset.revealState = "ready";
    this.stage.setAttribute("aria-busy", "false");
    this.revealLabel.textContent = "";
  }

  private containedImageBounds() {
    return calculateContainedImageBounds(
      this.stage.clientWidth,
      this.stage.clientHeight,
      this.image.naturalWidth,
      this.image.naturalHeight
    );
  }

  private startTileReveal(source: string, bounds: ReturnType<typeof calculateContainedImageBounds>, revision: number): void {
    this.stage.dataset.revealEngine = "tiles";
    this.reveal.style.left = `${bounds.left}px`;
    this.reveal.style.top = `${bounds.top}px`;
    this.reveal.style.width = `${bounds.width}px`;
    this.reveal.style.height = `${bounds.height}px`;
    const sourceUrl = new URL(source, document.baseURI).href;
    for (const tile of this.revealTiles) tile.style.backgroundImage = `url(${JSON.stringify(sourceUrl)})`;
    this.revealLabel.textContent = translate(this.locale, "raster");
    this.stage.dataset.revealState = "revealing";
    this.revealTimer = window.setTimeout(() => this.finishReveal(revision), this.revealPlan.minimumVisibleMs);
  }

  private clearRevealTiles(): void {
    for (const tile of this.revealTiles) tile.style.backgroundImage = "none";
  }

  private cancelReveal(): void {
    this.revealRevision += 1;
    this.pixelateReveal.cancel();
    if (this.revealTimer !== undefined) window.clearTimeout(this.revealTimer);
    this.revealTimer = undefined;
  }
}
