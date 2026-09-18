const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

interface BackgroundState {
  element: HTMLElement;
  inert: boolean;
  ariaHidden: string | null;
}

export class ModalFocusBoundary {
  private backgroundState: BackgroundState[] = [];
  private returnFocus: HTMLElement | null = null;
  private active = false;

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (!this.active || event.key !== "Tab") return;
    const focusable = this.focusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      this.dialog.focus();
      return;
    }

    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusable[nextIndex]!.focus();
  };

  constructor(
    private readonly dialog: HTMLElement,
    private readonly backgroundElements: readonly HTMLElement[]
  ) {
    this.dialog.addEventListener("keydown", this.handleKeydown, { capture: true });
  }

  activate(initialFocus: HTMLElement): void {
    if (this.active) return;
    this.active = true;
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.backgroundState = this.backgroundElements.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden")
    }));
    for (const { element } of this.backgroundState) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
    initialFocus.focus();
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    for (const { element, inert, ariaHidden } of this.backgroundState) {
      element.inert = inert;
      if (ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
    }
    this.backgroundState = [];
    const focusTarget = this.returnFocus;
    this.returnFocus = null;
    if (focusTarget?.isConnected) focusTarget.focus();
  }

  dispose(): void {
    this.deactivate();
    this.dialog.removeEventListener("keydown", this.handleKeydown, { capture: true });
  }

  private focusableElements(): HTMLElement[] {
    return Array.from(this.dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
  }
}
