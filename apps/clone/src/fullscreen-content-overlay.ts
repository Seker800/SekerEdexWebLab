export type FullscreenContentView = "document" | "image" | "video";

interface CloseOptions {
  readonly notify?: boolean;
}

interface ViewLifecycle {
  readonly onDeactivate?: () => void;
}

export class FullscreenContentOverlay {
  private readonly views = new Map<FullscreenContentView, HTMLElement>();
  private readonly lifecycles = new Map<FullscreenContentView, ViewLifecycle>();
  private activeView: FullscreenContentView | undefined;
  private readonly handleCloseClick = (): void => this.close();
  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (this.root.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    } else if (event.key === "Tab") {
      const controls = [...this.root.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, video[controls], audio[controls], [tabindex]'
      )].filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
      const first = controls[0] ?? this.closeButton;
      const last = controls.at(-1) ?? first;
      const active = document.activeElement;
      if (!this.root.contains(active) || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
      event.stopPropagation();
    }
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

  register(name: FullscreenContentView, view: HTMLElement, lifecycle: ViewLifecycle = {}): void {
    if (this.views.has(name)) throw new Error(`Fullscreen content view already registered: ${name}`);
    view.dataset.contentView = name;
    view.hidden = true;
    this.viewport.append(view);
    this.views.set(name, view);
    this.lifecycles.set(name, lifecycle);
  }

  open(name: FullscreenContentView, options: { focus?: boolean } = {}): void {
    const nextView = this.views.get(name);
    if (!nextView) throw new Error(`Fullscreen content view is not registered: ${name}`);
    if (this.activeView !== name) this.deactivate();
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
    this.deactivate();
    this.root.hidden = true;
    delete this.root.dataset.contentView;
    for (const view of this.views.values()) view.hidden = true;
    this.activeView = undefined;
    this.background.inert = false;
    this.background.removeAttribute("aria-hidden");
    if (options.notify !== false) this.onClose();
  };

  private deactivate(): void {
    if (!this.activeView) return;
    const active = this.activeView;
    this.activeView = undefined;
    this.views.get(active)?.querySelectorAll<HTMLMediaElement>("video, audio").forEach((media) => media.pause());
    this.lifecycles.get(active)?.onDeactivate?.();
  }

  dispose(): void {
    this.close({ notify: false });
    this.closeButton.removeEventListener("click", this.handleCloseClick);
    document.removeEventListener("keydown", this.handleKeydown, { capture: true });
  }
}
