import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, it } from "vitest";
import { compareScreenshots } from "../src/comparison/visual-comparator.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function solidPng(filePath: string, width: number, height: number, red: number): Promise<void> {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = red;
    image.data[offset + 1] = 0;
    image.data[offset + 2] = 0;
    image.data[offset + 3] = 255;
  }
  await writeFile(filePath, PNG.sync.write(image));
}

describe("visual comparator", () => {
  it("measures pixel and dimension differences and writes a diff", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "edex-visual-"));
    temporaryDirectories.push(directory);
    const target = path.join(directory, "target.png");
    const replica = path.join(directory, "replica.png");
    const diff = path.join(directory, "diff.png");
    await solidPng(target, 2, 2, 255);
    await solidPng(replica, 1, 2, 0);

    const metrics = await compareScreenshots(target, replica, diff);

    expect(metrics.dimensionsMatch).toBe(false);
    expect(metrics.differentPixels).toBeGreaterThan(0);
    expect((await readFile(diff)).byteLength).toBeGreaterThan(0);
  });
});
