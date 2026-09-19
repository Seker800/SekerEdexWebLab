export interface ImageRevealTile {
  readonly index: number;
  readonly column: number;
  readonly row: number;
  readonly delayMs: number;
}

export interface ImageRevealPlan {
  readonly columns: number;
  readonly rows: number;
  readonly tileDurationMs: number;
  readonly minimumVisibleMs: number;
  readonly tiles: readonly ImageRevealTile[];
}

export interface ContainedImageBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface ImageRevealOptions {
  readonly columns?: number;
  readonly rows?: number;
  readonly reducedMotion?: boolean;
}

const DEFAULT_COLUMNS = 10;
const DEFAULT_ROWS = 6;
const TILE_DURATION_MS = 240;
const TILE_STAGGER_MS = 10;

export function calculateContainedImageBounds(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number
): ContainedImageBounds {
  const dimensions = [containerWidth, containerHeight, imageWidth, imageHeight];
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError("Image reveal dimensions must be finite positive numbers");
  }

  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return Object.freeze({
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
    height
  });
}

export function createImageRevealPlan(options: ImageRevealOptions = {}): ImageRevealPlan {
  const columns = options.columns ?? DEFAULT_COLUMNS;
  const rows = options.rows ?? DEFAULT_ROWS;
  if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) {
    throw new RangeError("Image reveal dimensions must be positive integers");
  }

  const tileDurationMs = options.reducedMotion ? 0 : TILE_DURATION_MS;
  const tiles = Array.from({ length: columns * rows }, (_, index): ImageRevealTile => ({
    index,
    column: index % columns,
    row: Math.floor(index / columns),
    delayMs: options.reducedMotion ? 0 : index * TILE_STAGGER_MS
  }));
  const minimumVisibleMs = tiles[tiles.length - 1]!.delayMs + tileDurationMs;

  return Object.freeze({
    columns,
    rows,
    tileDurationMs,
    minimumVisibleMs,
    tiles: Object.freeze(tiles.map((tile) => Object.freeze(tile)))
  });
}
