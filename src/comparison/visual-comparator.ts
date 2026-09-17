import { readFile, writeFile } from "node:fs/promises";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import type { VisualMetrics } from "../domain/types.js";

function placeOnCanvas(source: PNG, width: number, height: number): PNG {
  const canvas = new PNG({ width, height });
  canvas.data.fill(255);
  PNG.bitblt(source, canvas, 0, 0, source.width, source.height, 0, 0);
  return canvas;
}

export interface ScreenshotRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualComparisonOptions {
  threshold?: number;
  includeAA?: boolean;
}

const pixelmatchOptions = (options: VisualComparisonOptions): { threshold: number; includeAA: boolean } => ({
  threshold: options.threshold ?? 0.1,
  includeAA: options.includeAA ?? false
});

function crop(source: PNG, region: ScreenshotRegion): PNG {
  const clipped = new PNG({ width: region.width, height: region.height });
  PNG.bitblt(source, clipped, region.x, region.y, region.width, region.height, 0, 0);
  return clipped;
}

export async function compareScreenshotRegion(
  targetPath: string,
  replicaPath: string,
  diffPath: string,
  region: ScreenshotRegion,
  options: VisualComparisonOptions = {}
): Promise<VisualMetrics> {
  const [targetBuffer, replicaBuffer] = await Promise.all([readFile(targetPath), readFile(replicaPath)]);
  const target = PNG.sync.read(targetBuffer);
  const replica = PNG.sync.read(replicaBuffer);
  if (region.x < 0 || region.y < 0 || region.x + region.width > target.width || region.y + region.height > target.height) {
    throw new Error(`Target region is outside the screenshot: ${JSON.stringify(region)}`);
  }
  if (region.x + region.width > replica.width || region.y + region.height > replica.height) {
    throw new Error(`Replica region is outside the screenshot: ${JSON.stringify(region)}`);
  }
  const croppedTarget = crop(target, region);
  const croppedReplica = crop(replica, region);
  const diff = new PNG({ width: region.width, height: region.height });
  const differentPixels = pixelmatch(
    croppedTarget.data,
    croppedReplica.data,
    diff.data,
    region.width,
    region.height,
    pixelmatchOptions(options)
  );
  await writeFile(diffPath, PNG.sync.write(diff));
  const totalPixels = region.width * region.height;
  return {
    targetWidth: region.width,
    targetHeight: region.height,
    replicaWidth: region.width,
    replicaHeight: region.height,
    comparedWidth: region.width,
    comparedHeight: region.height,
    differentPixels,
    totalPixels,
    differenceRatio: totalPixels === 0 ? 0 : differentPixels / totalPixels,
    dimensionsMatch: true
  };
}

export async function compareScreenshots(
  targetPath: string,
  replicaPath: string,
  diffPath: string,
  options: VisualComparisonOptions = {}
): Promise<VisualMetrics> {
  const [targetBuffer, replicaBuffer] = await Promise.all([readFile(targetPath), readFile(replicaPath)]);
  const target = PNG.sync.read(targetBuffer);
  const replica = PNG.sync.read(replicaBuffer);
  const width = Math.max(target.width, replica.width);
  const height = Math.max(target.height, replica.height);
  const normalizedTarget = placeOnCanvas(target, width, height);
  const normalizedReplica = placeOnCanvas(replica, width, height);
  const diff = new PNG({ width, height });

  const differentPixels = pixelmatch(
    normalizedTarget.data,
    normalizedReplica.data,
    diff.data,
    width,
    height,
    pixelmatchOptions(options)
  );
  const totalPixels = width * height;
  await writeFile(diffPath, PNG.sync.write(diff));

  return {
    targetWidth: target.width,
    targetHeight: target.height,
    replicaWidth: replica.width,
    replicaHeight: replica.height,
    comparedWidth: width,
    comparedHeight: height,
    differentPixels,
    totalPixels,
    differenceRatio: totalPixels === 0 ? 0 : differentPixels / totalPixels,
    dimensionsMatch: target.width === replica.width && target.height === replica.height
  };
}
