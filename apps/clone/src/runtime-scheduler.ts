export interface VisibilitySource {
  isVisible(): boolean;
  subscribe(listener: () => void): () => void;
}

interface ScheduledTask {
  readonly callback: () => void;
  readonly intervalMs: number;
  timer: ReturnType<typeof setInterval> | undefined;
}

interface AnimationTask {
  readonly callback: () => void;
  frame: number | undefined;
}

export class RuntimeScheduler {
  private readonly tasks: ScheduledTask[] = [];
  private readonly animations: AnimationTask[] = [];
  private readonly unsubscribe: () => void;
  private running = false;

  constructor(private readonly visibility: VisibilitySource) {
    this.unsubscribe = visibility.subscribe(() => this.sync());
    this.sync();
  }

  every(intervalMs: number, callback: () => void): () => void {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new RangeError("Scheduler interval must be positive");
    const task: ScheduledTask = { callback, intervalMs, timer: undefined };
    this.tasks.push(task);
    if (this.running) this.startTask(task);
    return () => this.remove(task);
  }

  eachFrame(callback: () => void): () => void {
    const animation: AnimationTask = { callback, frame: undefined };
    this.animations.push(animation);
    if (this.running) this.startAnimation(animation);
    return () => this.removeAnimation(animation);
  }

  isRunning(): boolean {
    return this.running;
  }

  dispose(): void {
    this.unsubscribe();
    this.stop();
    this.tasks.length = 0;
    this.animations.length = 0;
  }

  private sync(): void {
    if (this.visibility.isVisible()) this.start();
    else this.stop();
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    for (const task of this.tasks) this.startTask(task);
    for (const animation of this.animations) this.startAnimation(animation);
  }

  private stop(): void {
    if (!this.running) return;
    this.running = false;
    for (const task of this.tasks) {
      if (task.timer !== undefined) clearInterval(task.timer);
      task.timer = undefined;
    }
    for (const animation of this.animations) {
      if (animation.frame !== undefined) cancelAnimationFrame(animation.frame);
      animation.frame = undefined;
    }
  }

  private startTask(task: ScheduledTask): void {
    task.timer = setInterval(task.callback, task.intervalMs);
  }

  private remove(task: ScheduledTask): void {
    const index = this.tasks.indexOf(task);
    if (index < 0) return;
    if (task.timer !== undefined) clearInterval(task.timer);
    this.tasks.splice(index, 1);
  }

  private startAnimation(animation: AnimationTask): void {
    const frame = (): void => {
      animation.callback();
      if (this.running && this.animations.includes(animation)) animation.frame = requestAnimationFrame(frame);
    };
    animation.frame = requestAnimationFrame(frame);
  }

  private removeAnimation(animation: AnimationTask): void {
    const index = this.animations.indexOf(animation);
    if (index < 0) return;
    if (animation.frame !== undefined) cancelAnimationFrame(animation.frame);
    this.animations.splice(index, 1);
  }
}

export function documentVisibilitySource(target: Document): VisibilitySource {
  return {
    isVisible: () => !target.hidden,
    subscribe: (listener) => {
      target.addEventListener("visibilitychange", listener);
      return () => target.removeEventListener("visibilitychange", listener);
    }
  };
}
