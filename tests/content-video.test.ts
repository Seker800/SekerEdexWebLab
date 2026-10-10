import { describe, expect, it } from "vitest";
import { createSandboxFilesystem } from "../apps/clone/src/browser-filesystem.js";
import { CommandDeckController } from "../apps/clone/src/command-deck-controller.js";

describe("video content navigation", () => {
  it("opens a published video through the shared content route", () => {
    const filesystem = createSandboxFilesystem({ contentEntries: [{ kind: "media", relativePath: "clips/trip.mp4", url: "https://content.example/api/v1/media/00000000-0000-0000-0000-000000000000", mediaType: "video/mp4", alt: "Trip clip", sortOrder: 1 }], mountContentRoot: true });
    const controller = new CommandDeckController(filesystem);
    const result = controller.dispatch({ type: "activate-content-path", relativePath: "clips/trip.mp4" });
    expect(result.filesystem?.kind).toBe("video");
    expect(result.filesystem).toMatchObject({ entry: { preview: { kind: "video", alt: "Trip clip" } } });
  });
});
