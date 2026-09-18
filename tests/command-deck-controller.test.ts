import { describe, expect, it } from "vitest";
import { CommandDeckController } from "../apps/clone/src/command-deck-controller.js";
import { DisposableRegistry } from "../apps/clone/src/disposable-registry.js";

describe("command deck controller", () => {
  it("routes typed intents through one immutable session snapshot", () => {
    const controller = new CommandDeckController();
    controller.dispatch({ type: "set-draft", value: "echo alpha" });
    expect(controller.dispatch({ type: "submit", value: "echo alpha" }).feedback).toBe("success");
    controller.dispatch({ type: "activate-session", index: 1 });
    controller.dispatch({ type: "set-draft", value: "second" });

    const snapshot = controller.snapshot();
    expect(snapshot.current).toMatchObject({ index: 1, draft: "second" });
    expect(snapshot.tabs[0]?.label).toBe("MAIN SHELL");
    expect(snapshot.tabs[1]).toMatchObject({ active: true, label: "#2 - SHELL" });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.current.entries)).toBe(true);

    controller.dispatch({ type: "activate-session", index: 0 });
    expect(controller.snapshot().current.entries.some((entry) => entry.text.includes("alpha"))).toBe(true);
  });

  it("owns keyboard modifiers and filesystem actions without DOM state", () => {
    const controller = new CommandDeckController();
    controller.dispatch({ type: "toggle-modifier", modifier: "capsLock" });
    controller.dispatch({ type: "toggle-modifier", modifier: "ctrl" });
    controller.dispatch({ type: "toggle-modifier", modifier: "shift" });
    expect(controller.snapshot().modifiers).toMatchObject({ capsLock: true, ctrl: true, shift: true });
    controller.dispatch({ type: "clear-momentary-modifiers" });
    expect(controller.snapshot().modifiers).toMatchObject({ capsLock: true, ctrl: false, shift: false });

    const result = controller.dispatch({ type: "activate-filesystem-entry", name: "themes" });
    expect(result.filesystem).toEqual({ kind: "navigated", feedback: "success" });
    expect(controller.snapshot().current.cwd).toMatch(/\/themes$/);
  });

  it("owns the selected article and clears it on navigation", () => {
    const controller = new CommandDeckController();
    controller.dispatch({ type: "activate-filesystem-entry", name: "Blog" });
    controller.dispatch({ type: "activate-filesystem-entry", name: "posts" });
    controller.dispatch({ type: "activate-filesystem-entry", name: "welcome.md" });
    expect(controller.snapshot().content?.preview).toMatchObject({ kind: "document", title: "Welcome to the command deck" });
    expect(Object.isFrozen(controller.snapshot().content?.preview)).toBe(true);
    controller.dispatch({ type: "close-content" });
    expect(controller.snapshot().content).toBeNull();
  });
});

describe("disposable registry", () => {
  it("removes registered listeners and disposes in reverse ownership order", () => {
    const target = new EventTarget();
    const registry = new DisposableRegistry();
    const calls: string[] = [];
    registry.listen(target, "tick", () => calls.push("event"));
    registry.add(() => calls.push("first"));
    registry.add(() => calls.push("second"));
    target.dispatchEvent(new Event("tick"));
    registry.dispose();
    target.dispatchEvent(new Event("tick"));
    expect(calls).toEqual(["event", "second", "first"]);
  });
});
