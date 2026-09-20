import { describe, expect, it } from "vitest";
import { compactPromptPath, executeCommand, mobileNeofetchText } from "../apps/clone/src/terminal-model.js";

describe("terminal command model", () => {
  it("formats each prompt path as one complete value", () => {
    const root = "/home/squared";
    const canonicalRoot = `${root}/.config/eDEX-UI`;

    expect(compactPromptPath(root, root, canonicalRoot)).toBe("~");
    expect(compactPromptPath(`${root}/Blog`, root, canonicalRoot)).toBe("~/Blog");
    expect(compactPromptPath(canonicalRoot, root, canonicalRoot)).toBe("~/.c/eDEX-UI");
    expect(compactPromptPath(`${canonicalRoot}/themes`, root, canonicalRoot)).toBe("~/.c/eDEX-UI/themes");
  });

  it("returns deterministic neofetch content", () => {
    const result = executeCommand("neofetch");
    expect(result.clear).toBe(false);
    expect(result.entries.at(-1)?.text).toContain("Theme: Fantome");
    expect(result.entries.at(-1)?.text).not.toContain("\\n");
    expect(result.entries.at(-1)?.text.split("\n").length).toBeGreaterThan(20);
  });

  it("provides the same neofetch facts without desktop ASCII art for narrow screens", () => {
    expect(mobileNeofetchText).toContain("squared@batcore-home");
    expect(mobileNeofetchText).toContain("Resolution: 1920x1080, 1920x1080, 1920x1080");
    expect(mobileNeofetchText).not.toContain("met$$$$$gg");
  });

  it("supports clear and reports unknown commands", () => {
    expect(executeCommand("clear").clear).toBe(true);
    expect(executeCommand("warp-drive").entries.at(-1)?.text).toContain("command not found");
  });
});
