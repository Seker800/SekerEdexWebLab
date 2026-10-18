/** Bound the whole read (headers and body), even if an adapter ignores abort. */
export async function withRequestDeadline<T>(read: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  let cancel: (reason: unknown) => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    cancel = (reason) => {
      controller.abort(reason);
      reject(reason);
    };
  });
  const onAbort = (): void => cancel(signal!.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => cancel(new Error("Request timed out.")), 8_000);
  try {
    return await Promise.race([read(controller.signal), cancelled]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
