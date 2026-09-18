export interface PhysicalKeyIdentity {
  key: string;
  code: string;
}

const sourceSpecialKeys: Readonly<Record<string, readonly string[]>> = {
  ShiftLeft: ["SHIFT"],
  ShiftRight: ["SHIFT_RIGHT"],
  ControlLeft: ["CTRL"],
  ControlRight: ["CTRL_RIGHT"],
  AltLeft: ["FN"],
  AltRight: ["ALT GR"],
  CapsLock: ["CAPS"],
  Escape: ["ESC"],
  Tab: ["TAB"],
  Backspace: ["BACK"],
  Enter: ["ENTER", "ENTER_LOWER"],
  Space: ["SPACE"],
  ArrowUp: ["↑"],
  ArrowLeft: ["←"],
  ArrowDown: ["↓"],
  ArrowRight: ["→"]
};

export function keyboardKeysForEvent(event: PhysicalKeyIdentity): string[] {
  const specialKeys = sourceSpecialKeys[event.code];
  if (specialKeys) return [...specialKeys];
  if (event.key.length !== 1) return [];
  return [/[a-z]/i.test(event.key) ? event.key.toUpperCase() : event.key];
}

function matchingButtons(container: ParentNode, event: PhysicalKeyIdentity): HTMLButtonElement[] {
  const candidates = new Set(keyboardKeysForEvent(event));
  return [...container.querySelectorAll<HTMLButtonElement>(".key")].filter((button) => {
    const key = button.dataset.key;
    const shifted = button.dataset.shift;
    return Boolean((key && candidates.has(key)) || (shifted && candidates.has(shifted)));
  });
}

const releaseTimers = new WeakMap<HTMLElement, number>();

function press(buttons: readonly HTMLElement[]): void {
  for (const button of buttons) {
    const timer = releaseTimers.get(button);
    if (timer !== undefined) window.clearTimeout(timer);
    button.classList.remove("blink");
    button.classList.add("pressed");
  }
}

function release(buttons: readonly HTMLElement[]): void {
  for (const button of buttons) {
    button.classList.remove("pressed");
    button.classList.add("blink");
    releaseTimers.set(button, window.setTimeout(() => {
      button.classList.remove("blink");
      releaseTimers.delete(button);
    }, 100));
  }
}

export function bindPhysicalKeyboardFeedback(container: ParentNode): () => void {
  const pressedKeys = new Map<string, HTMLButtonElement[]>();
  const identity = (event: KeyboardEvent): string => event.code || event.key;
  const onKeyDown = (event: KeyboardEvent): void => {
    const buttons = matchingButtons(container, event);
    if (buttons.length === 0) return;
    pressedKeys.set(identity(event), buttons);
    press(buttons);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    const key = identity(event);
    const buttons = pressedKeys.get(key) ?? matchingButtons(container, event);
    pressedKeys.delete(key);
    release(buttons);
  };
  const onBlur = (): void => {
    for (const buttons of pressedKeys.values()) {
      for (const button of buttons) button.classList.remove("pressed", "blink");
    }
    pressedKeys.clear();
  };

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  return () => {
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    onBlur();
  };
}

export function bindPointerKeyboardFeedback(button: HTMLElement): () => void {
  let active = false;
  const onPointerDown = (): void => {
    active = true;
    press([button]);
  };
  const onPointerEnd = (): void => {
    if (!active) return;
    active = false;
    release([button]);
  };
  button.addEventListener("pointerdown", onPointerDown);
  button.addEventListener("pointerup", onPointerEnd);
  button.addEventListener("pointercancel", onPointerEnd);
  button.addEventListener("pointerleave", onPointerEnd);
  return () => {
    button.removeEventListener("pointerdown", onPointerDown);
    button.removeEventListener("pointerup", onPointerEnd);
    button.removeEventListener("pointercancel", onPointerEnd);
    button.removeEventListener("pointerleave", onPointerEnd);
  };
}

export function bindPointerKeyRepeat(button: HTMLElement, repeat: () => void, delayMs = 400, intervalMs = 70): () => void {
  let delay: number | undefined;
  let interval: number | undefined;
  const stop = (): void => {
    if (delay !== undefined) window.clearTimeout(delay);
    if (interval !== undefined) window.clearInterval(interval);
    delay = undefined;
    interval = undefined;
  };
  const start = (): void => {
    stop();
    delay = window.setTimeout(() => {
      repeat();
      interval = window.setInterval(repeat, intervalMs);
    }, delayMs);
  };
  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
  button.addEventListener("pointerleave", stop);
  return () => {
    stop();
    button.removeEventListener("pointerdown", start);
    button.removeEventListener("pointerup", stop);
    button.removeEventListener("pointercancel", stop);
    button.removeEventListener("pointerleave", stop);
  };
}
