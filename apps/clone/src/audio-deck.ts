export type SoundCue = "theme" | "expand" | "keyboard" | "panels" | "stdin" | "stdout" | "folder" | "granted" | "scan" | "alarm" | "denied" | "error" | "info";

const cueVolumes: Record<SoundCue, number> = {
  theme: 1,
  expand: 1,
  keyboard: 1,
  panels: 1,
  stdin: 0.4,
  stdout: 0.4,
  folder: 1,
  granted: 1,
  scan: 1,
  alarm: 1,
  denied: 1,
  error: 1,
  info: 1
};

export interface SoundPlaybackEvent {
  cue: SoundCue;
  enabled: boolean;
  volume: number;
}

export interface AudioDeckOptions {
  context?: AudioContext;
  fetcher?: typeof fetch;
  emitSoundEvent?: (event: SoundPlaybackEvent) => void;
}

function createBrowserAudioContext(): AudioContext | undefined {
  if (typeof AudioContext === "undefined") return undefined;
  try {
    return new AudioContext();
  } catch {
    return undefined;
  }
}

function emitBrowserSoundEvent(event: SoundPlaybackEvent): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("edex:sound", { detail: event }));
  document.documentElement.dataset.lastSound = event.cue;
}

export class AudioDeck {
  private enabled = true;
  private disposed = false;
  private unlocked = false;
  private readonly context: AudioContext | undefined;
  private readonly fetcher: typeof fetch;
  private readonly emitSoundEvent: (event: SoundPlaybackEvent) => void;
  private readonly loadAbortController = new AbortController();
  private readonly buffers = new Map<SoundCue, Promise<AudioBuffer | undefined>>();
  private readonly cueGains = new Map<SoundCue, GainNode>();
  private readonly active = new Set<AudioBufferSourceNode>();

  constructor(options: AudioDeckOptions = {}) {
    this.context = options.context ?? createBrowserAudioContext();
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.emitSoundEvent = options.emitSoundEvent ?? emitBrowserSoundEvent;
    if (!this.context) return;
    for (const cue of Object.keys(cueVolumes) as SoundCue[]) {
      const gain = this.context.createGain();
      gain.gain.value = cueVolumes[cue];
      gain.connect(this.context.destination);
      this.cueGains.set(cue, gain);
      this.buffers.set(cue, this.load(cue));
    }
  }

  isEnabled(): boolean { return this.enabled; }

  async unlock(): Promise<void> {
    if (this.disposed || !this.context) return;
    await Promise.all([this.resumeContext(), ...this.buffers.values()]);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopActiveSounds();
  }

  play(cue: SoundCue): void {
    this.emitSoundEvent({ cue, enabled: this.enabled, volume: cueVolumes[cue] });
    if (!this.enabled || this.disposed || !this.context) return;
    void this.playBuffer(cue);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadAbortController.abort();
    this.stopActiveSounds();
    for (const gain of this.cueGains.values()) gain.disconnect();
    this.cueGains.clear();
    this.buffers.clear();
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => undefined);
  }

  private async load(cue: SoundCue): Promise<AudioBuffer | undefined> {
    if (!this.context) return undefined;
    try {
      const response = await this.fetcher(`/audio/${cue}.wav`, { signal: this.loadAbortController.signal });
      if (!response.ok) return undefined;
      return await this.context.decodeAudioData(await response.arrayBuffer());
    } catch {
      return undefined;
    }
  }

  private async resumeContext(): Promise<void> {
    if (!this.context || this.context.state === "closed") return;
    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        return;
      }
    }
    this.unlocked = true;
  }

  private async playBuffer(cue: SoundCue): Promise<void> {
    const context = this.context;
    const gain = this.cueGains.get(cue);
    const buffer = await this.buffers.get(cue);
    if (!context || !gain || !buffer || !this.enabled || this.disposed) return;
    if (!this.unlocked) await this.resumeContext();
    if (!this.unlocked || !this.enabled || this.disposed) return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.onended = () => {
      source.disconnect();
      this.active.delete(source);
    };
    this.active.add(source);
    try {
      source.start();
    } catch {
      source.disconnect();
      this.active.delete(source);
    }
  }

  private stopActiveSounds(): void {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {
        // A source can end between iteration and stop; disconnect still releases its graph node.
      }
      source.disconnect();
    }
    this.active.clear();
  }
}
