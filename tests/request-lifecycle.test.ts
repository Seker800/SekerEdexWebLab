import { afterEach, describe, expect, it, vi } from "vitest";
import { withRequestDeadline } from "../apps/clone/src/request-lifecycle.js";

afterEach(() => vi.useRealTimers());

describe("bounded request lifecycle", () => {
  it("cancels a non-cooperative adapter immediately when its owner aborts", async () => {
    vi.useFakeTimers();
    const owner = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const request = withRequestDeadline((signal) => {
      requestSignal = signal;
      return new Promise(() => undefined);
    }, owner.signal);
    const failure = expect(request).rejects.toThrow("Owner closed");
    owner.abort(new Error("Owner closed"));
    await failure;
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start an already cancelled read", async () => {
    const owner = new AbortController();
    owner.abort();
    const read = vi.fn();
    await expect(withRequestDeadline(read, owner.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["success", "failure", "throw"])("cleans deadlines after %s", async (outcome) => {
    vi.useFakeTimers();
    const owner = new AbortController();
    const remove = vi.spyOn(owner.signal, "removeEventListener");
    const read = () => {
      if (outcome === "throw") throw new Error("Read failed");
      return outcome === "success" ? Promise.resolve("content") : Promise.reject(new Error("Read failed"));
    };
    const request = withRequestDeadline(read, owner.signal);
    if (outcome === "success") await expect(request).resolves.toBe("content");
    else await expect(request).rejects.toThrow("Read failed");
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects and cancels a stalled request at its deadline", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const request = withRequestDeadline((signal) => {
      requestSignal = signal;
      return new Promise(() => undefined);
    });
    const failure = expect(request).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(8_000);
    await failure;
    expect(requestSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
