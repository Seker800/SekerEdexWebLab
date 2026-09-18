import type { BrowserFileEntry, BrowserImagePreview } from "./browser-filesystem.js";
import { ModalFocusBoundary } from "./modal-focus-boundary.js";

export class ImageViewer {
  private readonly overlay: HTMLDivElement;
  private readonly dialog: HTMLDivElement;
  private readonly image: HTMLImageElement;
  private readonly title: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly zoomLabel: HTMLElement;
  private readonly focusBoundary: ModalFocusBoundary;
  private items: BrowserFileEntry[] = [];
  private index = 0;
  private zoom = 1;
  private dragOrigin: { pointerX: number; pointerY: number; x: number; y: number } | null = null;
  private x = 0;
  private y = 0;
  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (this.overlay.hidden) return;
    if (event.key === "Escape") this.close();
    else if (event.key === "ArrowLeft") this.move(-1);
    else if (event.key === "ArrowRight") this.move(1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  constructor(host: HTMLElement, private readonly onClose?: () => void) {
    this.overlay = document.createElement("div");
    this.overlay.className = "image-viewer";
    this.overlay.hidden = true;
    this.overlay.innerHTML = `<div class="image-viewer__dialog" role="dialog" aria-modal="true" aria-labelledby="image-viewer-title">
      <header class="image-viewer__header"><span id="image-viewer-title"></span><button type="button" data-viewer-action="close" aria-label="Close image viewer">CLOSE</button></header>
      <div class="image-viewer__stage"><img alt=""></div>
      <p class="image-viewer__caption"></p>
      <footer><button type="button" data-viewer-action="previous" aria-label="Previous image">← PREV</button><span class="image-viewer__counter"></span><button type="button" data-viewer-action="zoom-out" aria-label="Zoom out">−</button><span class="image-viewer__zoom"></span><button type="button" data-viewer-action="zoom-in" aria-label="Zoom in">+</button><button type="button" data-viewer-action="next" aria-label="Next image">NEXT →</button></footer>
    </div>`;
    host.append(this.overlay);
    this.dialog = this.overlay.querySelector(".image-viewer__dialog")!;
    this.image = this.overlay.querySelector("img")!;
    this.title = this.overlay.querySelector("#image-viewer-title")!;
    this.caption = this.overlay.querySelector(".image-viewer__caption")!;
    this.counter = this.overlay.querySelector(".image-viewer__counter")!;
    this.zoomLabel = this.overlay.querySelector(".image-viewer__zoom")!;
    this.dialog.tabIndex = -1;
    this.focusBoundary = new ModalFocusBoundary(
      this.dialog,
      Array.from(host.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== this.overlay)
    );

    this.overlay.addEventListener("click", (event) => {
      if (event.target === this.overlay) this.close();
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-viewer-action]");
      if (!button) return;
      const action = button.dataset.viewerAction;
      if (action === "close") this.close();
      else if (action === "previous") this.move(-1);
      else if (action === "next") this.move(1);
      else if (action === "zoom-out") this.setZoom(this.zoom - 0.25);
      else if (action === "zoom-in") this.setZoom(this.zoom + 0.25);
    });
    document.addEventListener("keydown", this.handleKeydown, { capture: true });
    const header = this.overlay.querySelector<HTMLElement>(".image-viewer__header")!;
    header.addEventListener("pointerdown", (event) => {
      if ((event.target as Element).closest("button")) return;
      this.dragOrigin = { pointerX: event.clientX, pointerY: event.clientY, x: this.x, y: this.y };
      header.setPointerCapture(event.pointerId);
    });
    header.addEventListener("pointermove", (event) => {
      if (!this.dragOrigin) return;
      const overlayBounds = this.overlay.getBoundingClientRect();
      const scaleX = this.overlay.clientWidth / overlayBounds.width;
      const scaleY = this.overlay.clientHeight / overlayBounds.height;
      this.x = this.dragOrigin.x + (event.clientX - this.dragOrigin.pointerX) * scaleX;
      this.y = this.dragOrigin.y + (event.clientY - this.dragOrigin.pointerY) * scaleY;
      this.position();
    });
    const finishDrag = (): void => { this.dragOrigin = null; };
    header.addEventListener("pointerup", finishDrag);
    header.addEventListener("pointercancel", finishDrag);
    header.addEventListener("lostpointercapture", finishDrag);
    window.addEventListener("resize", this.handleResize);
  }

  open(items: readonly BrowserFileEntry[], selectedPath: string): void {
    this.items = items.filter((entry) => entry.preview?.kind === "image");
    if (this.items.length === 0) return;
    this.index = Math.max(0, this.items.findIndex((entry) => entry.path === selectedPath));
    this.x = 0;
    this.y = 0;
    this.overlay.hidden = false;
    this.render();
    this.focusBoundary.activate(this.overlay.querySelector<HTMLButtonElement>('[data-viewer-action="close"]')!);
  }

  close(): void {
    if (this.overlay.hidden) return;
    this.overlay.hidden = true;
    this.focusBoundary.deactivate();
    this.onClose?.();
  }

  dispose(): void {
    document.removeEventListener("keydown", this.handleKeydown, { capture: true });
    window.removeEventListener("resize", this.handleResize);
    this.focusBoundary.dispose();
    this.overlay.remove();
  }

  private move(direction: -1 | 1): void {
    this.index = (this.index + direction + this.items.length) % this.items.length;
    this.render();
  }

  private setZoom(value: number): void {
    this.zoom = Math.min(3, Math.max(0.5, value));
    this.image.style.scale = String(this.zoom);
    this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  private position(): void {
    const maxX = Math.max(0, (this.overlay.clientWidth - this.dialog.offsetWidth) / 2);
    const maxY = Math.max(0, (this.overlay.clientHeight - this.dialog.offsetHeight) / 2);
    this.x = Math.min(maxX, Math.max(-maxX, this.x));
    this.y = Math.min(maxY, Math.max(-maxY, this.y));
    this.dialog.style.translate = `${this.x}px ${this.y}px`;
  }

  private readonly handleResize = (): void => this.position();

  private render(): void {
    const entry = this.items[this.index]!;
    const preview = entry.preview as BrowserImagePreview;
    this.title.textContent = entry.name;
    this.image.src = preview.src;
    this.image.alt = preview.alt;
    this.caption.textContent = preview.caption ?? preview.alt;
    this.counter.textContent = `${this.index + 1} / ${this.items.length} · ${preview.mediaType}`;
    this.setZoom(1);
    this.position();
  }
}
