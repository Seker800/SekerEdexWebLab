import { describe, expect, it } from "vitest";
import { pathsOutsideAllowed } from "../src/adapters/codex/git-guard.js";

describe("git repair guard", () => {
  it("accepts files nested under an allowed path", () => {
    expect(pathsOutsideAllowed(["apps/clone/src/page.tsx"], ["apps/clone"])).toEqual([]);
  });

  it("rejects sibling paths with a matching prefix", () => {
    expect(pathsOutsideAllowed(["apps/clone-secret/token.ts"], ["apps/clone"])).toEqual(["apps/clone-secret/token.ts"]);
  });
});
