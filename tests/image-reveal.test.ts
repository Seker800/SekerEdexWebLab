import { describe, expect, it } from "vitest";
import { createImageRevealPlan } from "../apps/clone/src/image-reveal.js";

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
