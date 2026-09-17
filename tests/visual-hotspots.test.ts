import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { analyzeVisualHotspots } from "../src/comparison/visual-hotspots.js";

async function savePng(filePath: string, pixels: number[]): Promise<void> {
  const image = new PNG({ width: 2, height: 1 });
  image.data.set(pixels);
  await writeFile(filePath, PNG.sync.write(image));
}

describe("visual hotspot diagnostics", () => {
  it("treats transparent black and opaque black as the same visible pixel", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "visual-hotspots-"));
    const targetPath = path.join(directory, "target.png");
    const replicaPath = path.join(directory, "replica.png");
    await savePng(targetPath, [0, 0, 0, 32, 255, 255, 255, 255]);
    await savePng(replicaPath, [0, 0, 0, 255, 0, 0, 0, 255]);

    const report = await analyzeVisualHotspots(targetPath, replicaPath, { cellWidth: 1, cellHeight: 1, limit: 2 });

    expect(report.differentPixels).toBe(1);
    expect(report).toMatchObject({ threshold: 0.1, includeAA: false });
    expect(report.hotspots[0]).toMatchObject({ x: 1, y: 0, differentPixels: 1 });
    expect(report.hotspots[1]).toMatchObject({ x: 0, y: 0, differentPixels: 0 });
  });
});
