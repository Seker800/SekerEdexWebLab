export type Disposer = () => void;

export class DisposableRegistry {
  private disposers: Disposer[] = [];
  private disposed = false;

  add(disposer: Disposer): Disposer {
    if (this.disposed) {
      disposer();
      return disposer;
    }
    this.disposers.push(disposer);
    return disposer;
  }

  listen<T extends Event>(
    target: EventTarget,
    type: string,
    listener: (event: T) => void,
    options?: AddEventListenerOptions | boolean
  ): Disposer {
    const eventListener = listener as EventListener;
    target.addEventListener(type, eventListener, options);
    return this.add(() => target.removeEventListener(type, eventListener, options));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const disposer of this.disposers.splice(0).reverse()) disposer();
  }
}
