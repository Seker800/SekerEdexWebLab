import type { BrowserFileEntry, BrowserVideoPreview } from "./browser-filesystem.js";
import type { FullscreenContentOverlay } from "./fullscreen-content-overlay.js";

export class VideoViewer {
  private readonly surface: HTMLElement;
  private readonly video: HTMLVideoElement;
  private readonly title: HTMLElement;
  private readonly caption: HTMLElement;

  constructor(private readonly overlay: FullscreenContentOverlay) {
    this.surface = document.createElement("section");
    this.surface.className = "video-viewer";
    this.surface.innerHTML = '<header><h1></h1></header><video controls playsinline preload="metadata"></video><p></p>';
    this.overlay.register("video", this.surface);
    this.video = this.surface.querySelector("video")!;
    this.title = this.surface.querySelector("h1")!;
    this.caption = this.surface.querySelector("p")!;
  }

  open(entry: BrowserFileEntry): void {
    if (entry.preview?.kind !== "video") return;
    const preview: BrowserVideoPreview = entry.preview;
    this.title.textContent = entry.name;
    this.caption.textContent = preview.alt;
    this.video.src = preview.src;
    this.overlay.open("video");
  }

  close(options: { notify?: boolean } = {}): void {
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    if (this.overlay.isActive("video")) this.overlay.close(options);
  }

  dispose(): void { this.close({ notify: false }); this.surface.remove(); }
}
