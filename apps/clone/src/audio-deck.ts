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

export class AudioDeck {
  private enabled = true;
  private readonly sources = new Map<SoundCue, HTMLAudioElement>();
  private readonly active = new Set<HTMLAudioElement>();

  constructor() {
    for (const cue of Object.keys(cueVolumes) as SoundCue[]) {
      const audio = new Audio(`/audio/${cue}.wav`);
      audio.preload = "auto";
      audio.volume = cueVolumes[cue];
      this.sources.set(cue, audio);
    }
  }

  isEnabled(): boolean { return this.enabled; }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      for (const audio of this.sources.values()) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }

  play(cue: SoundCue): void {
    document.dispatchEvent(new CustomEvent("edex:sound", { detail: { cue, enabled: this.enabled, volume: cueVolumes[cue] } }));
    document.documentElement.dataset.lastSound = cue;
    if (!this.enabled) return;
    const source = this.sources.get(cue);
    if (!source) return;
    const instance = source.cloneNode(true) as HTMLAudioElement;
    instance.volume = cueVolumes[cue];
    this.active.add(instance);
    instance.addEventListener("ended", () => this.active.delete(instance), { once: true });
    void instance.play().catch(() => this.active.delete(instance));
  }

  dispose(): void {
    for (const audio of [...this.sources.values(), ...this.active]) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }
    this.active.clear();
    this.sources.clear();
  }
}
