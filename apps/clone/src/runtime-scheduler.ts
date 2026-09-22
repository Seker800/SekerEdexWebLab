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
  readonly minimumIntervalMs: number;
  readonly isActive: () => boolean;
  lastRunAt: number | undefined;
}

export interface AnimationScheduleOptions {
  readonly minimumIntervalMs?: number;
  readonly isActive?: () => boolean;
}

export class RuntimeScheduler {
  private readonly tasks: ScheduledTask[] = [];
  private readonly animations: AnimationTask[] = [];
  private readonly unsubscribe: () => void;
  private running = false;
  private animationFrame: number | undefined;

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

  eachFrame(callback: () => void, options: AnimationScheduleOptions = {}): () => void {
    const minimumIntervalMs = options.minimumIntervalMs ?? 0;
    if (!Number.isFinite(minimumIntervalMs) || minimumIntervalMs < 0) {
      throw new RangeError("Animation interval cannot be negative");
    }
    const animation: AnimationTask = {
      callback,
      minimumIntervalMs,
      isActive: options.isActive ?? (() => true),
      lastRunAt: undefined
    };
    this.animations.push(animation);
    if (this.running) this.startAnimationLoop();
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
    this.startAnimationLoop();
  }

  private stop(): void {
    if (!this.running) return;
    this.running = false;
    for (const task of this.tasks) {
      if (task.timer !== undefined) clearInterval(task.timer);
      task.timer = undefined;
    }
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = undefined;
    for (const animation of this.animations) animation.lastRunAt = undefined;
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

  private startAnimationLoop(): void {
    if (this.animationFrame !== undefined || this.animations.length === 0) return;
    const frame = (timestamp: number): void => {
      this.animationFrame = undefined;
      if (this.running && this.animations.length > 0) this.animationFrame = requestAnimationFrame(frame);
      for (const animation of [...this.animations]) {
        if (!animation.isActive()) {
          animation.lastRunAt = undefined;
          continue;
        }
        if (animation.lastRunAt !== undefined && timestamp - animation.lastRunAt < animation.minimumIntervalMs) continue;
        animation.lastRunAt = timestamp;
        animation.callback();
      }
    };
    this.animationFrame = requestAnimationFrame(frame);
  }

  private removeAnimation(animation: AnimationTask): void {
    const index = this.animations.indexOf(animation);
    if (index < 0) return;
    this.animations.splice(index, 1);
    if (this.animations.length === 0 && this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
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
