export type FullscreenContentView = "document" | "image";

interface CloseOptions {
  readonly notify?: boolean;
}

export class FullscreenContentOverlay {
  private readonly views = new Map<FullscreenContentView, HTMLElement>();
  private activeView: FullscreenContentView | undefined;
  private readonly handleCloseClick = (): void => this.close();
  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (this.root.hidden || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  };

  constructor(
    readonly root: HTMLElement,
    private readonly viewport: HTMLElement,
    private readonly background: HTMLElement,
    private readonly closeButton: HTMLButtonElement,
    private readonly onClose: () => void
  ) {
    this.closeButton.addEventListener("click", this.handleCloseClick);
    document.addEventListener("keydown", this.handleKeydown, { capture: true });
  }

  register(name: FullscreenContentView, view: HTMLElement): void {
    if (this.views.has(name)) throw new Error(`Fullscreen content view already registered: ${name}`);
    view.dataset.contentView = name;
    view.hidden = true;
    this.viewport.append(view);
    this.views.set(name, view);
  }

  open(name: FullscreenContentView, options: { focus?: boolean } = {}): void {
    const nextView = this.views.get(name);
    if (!nextView) throw new Error(`Fullscreen content view is not registered: ${name}`);
    for (const view of this.views.values()) view.hidden = view !== nextView;
    this.activeView = name;
    this.root.dataset.contentView = name;
    this.root.hidden = false;
    this.background.inert = true;
    this.background.setAttribute("aria-hidden", "true");
    if (options.focus !== false) this.closeButton.focus();
  }

  isActive(name: FullscreenContentView): boolean {
    return !this.root.hidden && this.activeView === name;
  }

  readonly close = (options: CloseOptions = {}): void => {
    if (this.root.hidden) return;
    this.root.hidden = true;
    delete this.root.dataset.contentView;
    for (const view of this.views.values()) view.hidden = true;
    this.activeView = undefined;
    this.background.inert = false;
    this.background.removeAttribute("aria-hidden");
    if (options.notify !== false) this.onClose();
  };

  dispose(): void {
    this.close({ notify: false });
    this.closeButton.removeEventListener("click", this.handleCloseClick);
    document.removeEventListener("keydown", this.handleKeydown, { capture: true });
  }
}
