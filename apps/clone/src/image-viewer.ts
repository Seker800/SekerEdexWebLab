import type { BrowserFileEntry, BrowserImagePreview } from "./browser-filesystem.js";

export class ImageViewer {
  private readonly surface: HTMLElement;
  private readonly image: HTMLImageElement;
  private readonly title: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly zoomLabel: HTMLElement;
  private items: BrowserFileEntry[] = [];
  private index = 0;
  private zoom = 1;
  private readonly descriptions = new Map<string, { alt: string; caption?: string }>();
  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (this.surface.hidden) return;
    if (event.key === "Escape") this.close();
    else if (event.key === "ArrowLeft") this.move(-1);
    else if (event.key === "ArrowRight") this.move(1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  constructor(
    private readonly host: HTMLElement,
    private readonly background: HTMLElement,
    private readonly onClose?: () => void,
    private readonly onSelectionChange?: (
      entry: Readonly<BrowserFileEntry>,
      description?: Readonly<{ alt: string; caption?: string }>
    ) => void
  ) {
    this.surface = document.createElement("section");
    this.surface.className = "image-viewer";
    this.surface.hidden = true;
    this.surface.setAttribute("role", "region");
    this.surface.setAttribute("aria-labelledby", "image-viewer-title");
    this.surface.innerHTML = `
      <header class="image-viewer__header"><span id="image-viewer-title"></span><button type="button" data-viewer-action="close" aria-label="Close image viewer">CLOSE</button></header>
      <div class="image-viewer__stage"><img alt=""></div>
      <p class="image-viewer__caption"></p>
      <footer><button type="button" data-viewer-action="previous" aria-label="Previous image">← PREV</button><span class="image-viewer__counter"></span><button type="button" data-viewer-action="zoom-out" aria-label="Zoom out">−</button><span class="image-viewer__zoom"></span><button type="button" data-viewer-action="zoom-in" aria-label="Zoom in">+</button><button type="button" data-viewer-action="next" aria-label="Next image">NEXT →</button></footer>
    `;
    host.append(this.surface);
    this.image = this.surface.querySelector("img")!;
    this.title = this.surface.querySelector("#image-viewer-title")!;
    this.caption = this.surface.querySelector(".image-viewer__caption")!;
    this.counter = this.surface.querySelector(".image-viewer__counter")!;
    this.zoomLabel = this.surface.querySelector(".image-viewer__zoom")!;

    this.surface.addEventListener("click", (event) => {
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
  }

  open(items: readonly BrowserFileEntry[], selectedPath: string, description?: { alt: string; caption?: string }): void {
    this.items = items.filter((entry) => entry.preview?.kind === "image");
    if (this.items.length === 0) return;
    this.descriptions.clear();
    if (description) this.descriptions.set(selectedPath, { ...description });
    this.index = Math.max(0, this.items.findIndex((entry) => entry.path === selectedPath));
    this.surface.hidden = false;
    this.host.classList.add("content-open");
    this.background.inert = true;
    this.background.setAttribute("aria-hidden", "true");
    this.render(false);
    this.surface.querySelector<HTMLButtonElement>('[data-viewer-action="close"]')!.focus();
  }

  close(options: { notify?: boolean } = {}): void {
    if (this.surface.hidden) return;
    this.surface.hidden = true;
    this.host.classList.remove("content-open");
    this.background.inert = false;
    this.background.removeAttribute("aria-hidden");
    if (options.notify !== false) this.onClose?.();
  }

  dispose(): void {
    this.close({ notify: false });
    document.removeEventListener("keydown", this.handleKeydown, { capture: true });
    this.surface.remove();
  }

  private move(direction: -1 | 1): void {
    this.index = (this.index + direction + this.items.length) % this.items.length;
    this.render(true);
  }

  private setZoom(value: number): void {
    this.zoom = Math.min(3, Math.max(0.5, value));
    this.image.style.scale = String(this.zoom);
    this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  private render(notifySelection: boolean): void {
    const entry = this.items[this.index]!;
    const preview = entry.preview as BrowserImagePreview;
    const description = this.descriptions.get(entry.path);
    this.title.textContent = entry.name;
    this.image.src = preview.src;
    this.image.alt = description?.alt ?? preview.alt;
    this.caption.textContent = description?.caption ?? description?.alt ?? preview.caption ?? preview.alt;
    this.counter.textContent = `${this.index + 1} / ${this.items.length} · ${preview.mediaType}`;
    this.setZoom(1);
    if (notifySelection) this.onSelectionChange?.(entry, description);
  }
}
