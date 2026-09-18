import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeScheduler, type VisibilitySource } from "../apps/clone/src/runtime-scheduler.js";

class ControlledVisibility implements VisibilitySource {
  private listener: (() => void) | undefined;

  constructor(private visible: boolean) {}

  isVisible(): boolean { return this.visible; }

  subscribe(listener: () => void): () => void {
    this.listener = listener;
    return () => { this.listener = undefined; };
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.listener?.();
  }
}

describe("runtime scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("pauses periodic work while hidden and resumes without duplicate timers", () => {
    vi.useFakeTimers();
    const visibility = new ControlledVisibility(true);
    const scheduler = new RuntimeScheduler(visibility);
    const callback = vi.fn();
    scheduler.every(1000, callback);

    vi.advanceTimersByTime(2000);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(scheduler.isRunning()).toBe(true);

    visibility.setVisible(false);
    vi.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(scheduler.isRunning()).toBe(false);

    visibility.setVisible(true);
    visibility.setVisible(true);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(3);

    scheduler.dispose();
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("validates intervals and removes individual tasks", () => {
    vi.useFakeTimers();
    const scheduler = new RuntimeScheduler(new ControlledVisibility(true));
    expect(() => scheduler.every(0, () => undefined)).toThrow(RangeError);

    const callback = vi.fn();
    const remove = scheduler.every(500, callback);
    remove();
    remove();
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
    scheduler.dispose();
  });

  it("pauses and removes animation frames through the same visibility lifecycle", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
    vi.stubGlobal("cancelAnimationFrame", (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle));
    const visibility = new ControlledVisibility(true);
    const scheduler = new RuntimeScheduler(visibility);
    const callback = vi.fn();
    const remove = scheduler.eachFrame(callback);

    vi.advanceTimersByTime(48);
    expect(callback).toHaveBeenCalledTimes(3);
    visibility.setVisible(false);
    vi.advanceTimersByTime(48);
    expect(callback).toHaveBeenCalledTimes(3);
    visibility.setVisible(true);
    vi.advanceTimersByTime(16);
    expect(callback).toHaveBeenCalledTimes(4);
    remove();
    vi.advanceTimersByTime(32);
    expect(callback).toHaveBeenCalledTimes(4);
    scheduler.dispose();
  });
});
