import { describe, expect, it } from "vitest";
import { executeCommand } from "../apps/clone/src/terminal-model.js";

describe("terminal command model", () => {
  it("returns deterministic neofetch content", () => {
    const result = executeCommand("neofetch");
    expect(result.clear).toBe(false);
    expect(result.entries.at(-1)?.text).toContain("Theme: Fantome");
    expect(result.entries.at(-1)?.text).not.toContain("\\n");
    expect(result.entries.at(-1)?.text.split("\n").length).toBeGreaterThan(20);
  });

  it("supports clear and reports unknown commands", () => {
    expect(executeCommand("clear").clear).toBe(true);
    expect(executeCommand("warp-drive").entries.at(-1)?.text).toContain("command not found");
  });
});
