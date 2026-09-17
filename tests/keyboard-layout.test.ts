import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseKeyboardLayout, resolveKeyboardCommand } from "../apps/clone/src/keyboard-layout.js";

async function sourceLayout(): Promise<unknown> {
  return JSON.parse(await readFile("apps/clone/public/keyboard/en-US.json", "utf8"));
}

describe("upstream eDEX keyboard layout adapter", () => {
  it("preserves the five source rows and all 65 keys", async () => {
    const rows = parseKeyboardLayout(await sourceLayout());

    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.length)).toEqual([15, 14, 14, 14, 8]);
    expect(rows.flat()).toHaveLength(65);
  });

  it("assigns stable browser identities to source-only special keys", async () => {
    const rows = parseKeyboardLayout(await sourceLayout());

    expect(rows[2]![13]).toMatchObject({ key: "ENTER_LOWER", label: "", command: "\r" });
    expect(rows[3]![12]).toMatchObject({ key: "SHIFT_RIGHT", label: "SHIFT" });
    expect(rows[3]![13]).toMatchObject({ key: "↑", icon: "↑" });
    expect(rows[4]!.map(({ key }) => key)).toEqual(["CTRL", "FN", "SPACE", "ALT GR", "CTRL_RIGHT", "←", "↓", "→"]);
  });

  it("expands source control-sequence placeholders and retains modifier commands", async () => {
    const rows = parseKeyboardLayout(await sourceLayout());
    const escape = "\u001b";

    expect(rows[0]![0]!.command).toBe(escape);
    expect(rows[0]![2]).toMatchObject({ shift: "!", fn: "F1", altCommand: `${escape}1`, fnCommand: `${escape}OP` });
    expect(rows[1]![1]).toMatchObject({ command: "q", shiftCommand: "Q", ctrlCommand: "\u0011", altCommand: `${escape}q` });
  });

  it("resolves source commands using the original modifier priority", async () => {
    const key = parseKeyboardLayout(await sourceLayout())[0]![2]!;

    expect(resolveKeyboardCommand(key, {})).toBe("1");
    expect(resolveKeyboardCommand(key, { shift: true })).toBe("!");
    expect(resolveKeyboardCommand(key, { alt: true })).toBe("\u001b1");
    expect(resolveKeyboardCommand(key, { fn: true })).toBe("\u001bOP");
  });
});
