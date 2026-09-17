import { readFile } from "node:fs/promises";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export interface VisualHotspot {
  x: number;
  y: number;
  width: number;
  height: number;
  differentPixels: number;
  differenceRatio: number;
}

export interface VisualHotspotReport {
  diagnosticOnly: true;
  background: "black";
  differentPixels: number;
  totalPixels: number;
  differenceRatio: number;
  cellWidth: number;
  cellHeight: number;
  threshold: number;
  includeAA: boolean;
  hotspots: VisualHotspot[];
}

function compositeOnBlack(source: PNG): PNG {
  const result = new PNG({ width: source.width, height: source.height });
  for (let index = 0; index < source.data.length; index += 4) {
    const alpha = (source.data[index + 3] ?? 0) / 255;
    result.data[index] = Math.round((source.data[index] ?? 0) * alpha);
    result.data[index + 1] = Math.round((source.data[index + 1] ?? 0) * alpha);
    result.data[index + 2] = Math.round((source.data[index + 2] ?? 0) * alpha);
    result.data[index + 3] = 255;
  }
  return result;
}

function crop(source: PNG, x: number, y: number, width: number, height: number): PNG {
  const result = new PNG({ width, height });
  PNG.bitblt(source, result, x, y, width, height, 0, 0);
  return result;
}

export async function analyzeVisualHotspots(
  targetPath: string,
  replicaPath: string,
  options: { cellWidth?: number; cellHeight?: number; limit?: number; threshold?: number; includeAA?: boolean } = {}
): Promise<VisualHotspotReport> {
  const [targetBuffer, replicaBuffer] = await Promise.all([readFile(targetPath), readFile(replicaPath)]);
  const target = compositeOnBlack(PNG.sync.read(targetBuffer));
  const replica = compositeOnBlack(PNG.sync.read(replicaBuffer));
  if (target.width !== replica.width || target.height !== replica.height) {
    throw new Error("Hotspot diagnostics require screenshots with identical dimensions");
  }

  const cellWidth = options.cellWidth ?? 64;
  const cellHeight = options.cellHeight ?? 64;
  const limit = options.limit ?? 40;
  const threshold = options.threshold ?? 0.1;
  const includeAA = options.includeAA ?? false;
  if (cellWidth <= 0 || cellHeight <= 0 || limit <= 0) throw new Error("Hotspot dimensions and limit must be positive");

  const hotspots: VisualHotspot[] = [];
  for (let y = 0; y < target.height; y += cellHeight) {
    for (let x = 0; x < target.width; x += cellWidth) {
      const width = Math.min(cellWidth, target.width - x);
      const height = Math.min(cellHeight, target.height - y);
      const expected = crop(target, x, y, width, height);
      const observed = crop(replica, x, y, width, height);
      const differentPixels = pixelmatch(expected.data, observed.data, undefined, width, height, { threshold, includeAA });
      hotspots.push({ x, y, width, height, differentPixels, differenceRatio: differentPixels / (width * height) });
    }
  }

  const differentPixels = pixelmatch(target.data, replica.data, undefined, target.width, target.height, { threshold, includeAA });
  const totalPixels = target.width * target.height;
  return {
    diagnosticOnly: true,
    background: "black",
    differentPixels,
    totalPixels,
    differenceRatio: differentPixels / totalPixels,
    cellWidth,
    cellHeight,
    threshold,
    includeAA,
    hotspots: hotspots.sort((left, right) => right.differentPixels - left.differentPixels).slice(0, limit)
  };
}
