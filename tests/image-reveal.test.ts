import { describe, expect, it } from "vitest";
import { calculateContainedImageBounds, createImageRevealPlan } from "../apps/clone/src/image-reveal.js";

describe("image reveal plan", () => {
  it("creates a deterministic scan of every tile", () => {
    const plan = createImageRevealPlan({ columns: 10, rows: 6 });

    expect(plan.tiles).toHaveLength(60);
    expect(plan.tiles.map((tile) => tile.index)).toEqual([...Array(60).keys()]);
    expect(plan.tiles[0]).toMatchObject({ column: 0, row: 0, delayMs: 0 });
    expect(plan.tiles.at(-1)).toMatchObject({ column: 9, row: 5 });
  });

  it("keeps the reveal visible for a minimum duration on cached images", () => {
    const plan = createImageRevealPlan({ columns: 10, rows: 6 });
    const lastTile = plan.tiles.at(-1)!;

    expect(plan.minimumVisibleMs).toBeGreaterThanOrEqual(480);
    expect(lastTile.delayMs + plan.tileDurationMs).toBe(plan.minimumVisibleMs);
  });

  it("removes animation timing when reduced motion is requested", () => {
    const plan = createImageRevealPlan({ columns: 10, rows: 6, reducedMotion: true });

    expect(plan.minimumVisibleMs).toBe(0);
    expect(plan.tileDurationMs).toBe(0);
    expect(plan.tiles.every((tile) => tile.delayMs === 0)).toBe(true);
  });

  it("rejects invalid grid dimensions", () => {
    expect(() => createImageRevealPlan({ columns: 0 })).toThrow(RangeError);
    expect(() => createImageRevealPlan({ rows: 1.5 })).toThrow(RangeError);
  });
});

describe("contained image reveal bounds", () => {
  it("centers a landscape image inside a wider stage", () => {
    expect(calculateContainedImageBounds(1920, 1080, 1200, 720)).toEqual({
      left: 60,
      top: 0,
      width: 1800,
      height: 1080
    });
  });

  it("centers a portrait image without covering its letterbox", () => {
    expect(calculateContainedImageBounds(1920, 1080, 1200, 2133)).toEqual({
      left: expect.closeTo(656.2, 1),
      top: 0,
      width: expect.closeTo(607.6, 1),
      height: 1080
    });
  });

  it("rejects missing layout or media dimensions", () => {
    expect(() => calculateContainedImageBounds(0, 1080, 1200, 720)).toThrow(RangeError);
    expect(() => calculateContainedImageBounds(1920, 1080, 0, 720)).toThrow(RangeError);
  });
});
