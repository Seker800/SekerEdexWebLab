import { describe, expect, it } from "vitest";
import { createSandboxFilesystem } from "../apps/clone/src/browser-filesystem.js";
import { TerminalSessionDeck } from "../apps/clone/src/terminal-session.js";

describe("browser filesystem", () => {
  it("navigates the frozen eDEX tree without escaping its declared root", () => {
    const filesystem = createSandboxFilesystem();

    expect(filesystem.list(filesystem.home).map((entry) => entry.name)).toContain("themes");
    expect(filesystem.resolve(filesystem.home, "themes")).toBe(`${filesystem.home}/themes`);
    expect(filesystem.resolve(filesystem.home, "../../../../etc")).toBe(filesystem.root);
    expect(filesystem.list(`${filesystem.home}/themes`).map((entry) => entry.name)).toContain("tron.json");
  });

  it("completes directory and file names relative to the active directory", () => {
    const filesystem = createSandboxFilesystem();

    expect(filesystem.complete(filesystem.home, "th")).toEqual(["themes/"]);
    expect(filesystem.complete(`${filesystem.home}/themes`, "tron.j")).toEqual(["tron.json"]);
  });

  it("handles absolute, home-relative, missing and root-level paths", () => {
    const filesystem = createSandboxFilesystem();

    expect(filesystem.resolve(filesystem.home, "~")).toBe(filesystem.root);
    expect(filesystem.resolve(filesystem.home, "~/Documents")).toBe(`${filesystem.root}/Documents`);
    expect(filesystem.resolve(filesystem.home, filesystem.home)).toBe(filesystem.home);
    expect(filesystem.resolve(filesystem.home, "/etc/passwd")).toBe(filesystem.root);
    expect(filesystem.resolve(filesystem.root, ".")).toBe(filesystem.root);
    expect(filesystem.list(filesystem.root).map((entry) => entry.name)).not.toContain("Go up");
    expect(filesystem.list(`${filesystem.root}/missing`)).toEqual([]);
    expect(filesystem.entry(filesystem.home, "missing")).toBeUndefined();
    expect(filesystem.read(`${filesystem.root}/Documents/readme.txt`)).toBe("eDEX browser workspace");
    expect(filesystem.complete(filesystem.home, "themes/tron.j")).toEqual(["themes/tron.json"]);
  });
});

describe("terminal session deck", () => {
  it("keeps output, history, drafts and current directories isolated by tab", () => {
    const deck = new TerminalSessionDeck();

    deck.submit("echo alpha");
    deck.setDraft("draft one");
    deck.activate(1);
    deck.submit("cd themes");
    deck.submit("pwd");

    expect(deck.current.index).toBe(1);
    expect(deck.current.cwd).toMatch(/\/themes$/);
    expect(deck.current.entries.at(-1)?.text).toMatch(/\/themes$/);
    expect(deck.historyPrevious("unfinished")).toBe("pwd");

    deck.activate(0);
    expect(deck.current.cwd).toBe(deck.filesystem.home);
    expect(deck.current.draft).toBe("draft one");
    expect(deck.current.entries.some((entry) => entry.text.includes("alpha"))).toBe(true);
    expect(deck.current.entries.some((entry) => entry.text.includes("/themes"))).toBe(false);
  });

  it("supports shell-like directory commands, history and deterministic completion", () => {
    const deck = new TerminalSessionDeck();

    deck.submit("ls");
    expect(deck.current.entries.at(-1)?.text).toContain("themes/");

    deck.submit("cd themes");
    expect(deck.complete("cat tron.j")).toBe("cat tron.json");
    deck.submit("echo themed");
    expect(deck.current.entries.at(-2)?.text).toContain("~/.config/eDEX-UI/themes$");
    deck.submit("history");
    expect(deck.current.entries.at(-1)?.text).toContain("1  ls");
    expect(deck.current.entries.at(-1)?.text).toContain("2  cd themes");

    deck.clear();
    expect(deck.current.entries).toEqual([]);
  });

  it("maps filesystem actions onto the active terminal without executing files", () => {
    const deck = new TerminalSessionDeck();

    expect(deck.activateFilesystemEntry("themes")).toEqual({ kind: "navigated" });
    expect(deck.current.cwd).toMatch(/\/themes$/);
    expect(deck.activateFilesystemEntry("tron.json")).toEqual({
      kind: "insert",
      value: "'tron.json'"
    });
    expect(deck.activateFilesystemEntry("Go up")).toEqual({ kind: "navigated" });
    expect(deck.current.cwd).toBe(deck.filesystem.home);
  });

  it("exposes a reversible sandbox disk view", () => {
    const deck = new TerminalSessionDeck();

    expect(deck.activateFilesystemEntry("Show disks")).toEqual({ kind: "show-disks" });
    expect(deck.filesystemEntries().map((entry) => entry.name)).toEqual(["Home sandbox"]);
    expect(deck.activateFilesystemEntry("Home sandbox")).toEqual({ kind: "navigated" });
    expect(deck.current.cwd).toBe(deck.filesystem.root);
    expect(deck.filesystemEntries().map((entry) => entry.name)).toContain(".config");
  });

  it("cycles through history while restoring the unfinished draft", () => {
    const deck = new TerminalSessionDeck();
    deck.submit("status");
    deck.submit("date");

    expect(deck.historyPrevious("echo pending")).toBe("date");
    expect(deck.historyPrevious("ignored")).toBe("status");
    expect(deck.historyNext()).toBe("date");
    expect(deck.historyNext()).toBe("echo pending");
  });

  it("rejects invalid sessions and handles empty history and completion edges", () => {
    const deck = new TerminalSessionDeck();

    expect(() => deck.activate(-1)).toThrow(RangeError);
    expect(() => deck.activate(5)).toThrow(RangeError);
    expect(() => deck.activate(1.5)).toThrow(RangeError);
    expect(deck.label(2)).toBe("EMPTY");
    expect(deck.historyPrevious("draft")).toBe("draft");
    expect(deck.historyNext()).toBe("");
    expect(deck.complete("   ")).toBe("   ");
    expect(deck.complete("his")).toBe("history");
    expect(deck.complete("unknown value")).toBe("unknown value");
    expect(deck.complete("cat definitely-missing")).toBe("cat definitely-missing");
    deck.submit("   ");
    expect(deck.current.history).toEqual([]);
  });

  it("reports invalid filesystem commands and supports quoted directories and readable files", () => {
    const deck = new TerminalSessionDeck();

    deck.submit("cd 'Local Storage'");
    expect(deck.current.cwd).toMatch(/\/Local Storage$/);
    deck.submit("cd leveldb");
    deck.submit("cd missing");
    expect(deck.current.entries.at(-1)?.text).toContain("no such directory");

    deck.activate(1);
    deck.submit("ls Cookies");
    expect(deck.current.entries.at(-1)?.text).toContain("no such directory");
    deck.submit('cd "themes"');
    deck.submit("cat tron.json");
    expect(deck.current.entries.at(-1)?.text).toContain('"theme": "tron"');
    deck.submit("cat missing.json");
    expect(deck.current.entries.at(-1)?.text).toContain("no readable file");
    deck.submit("cd");
    expect(deck.current.cwd).toBe(deck.filesystem.root);
  });

  it("returns missing filesystem actions in both directory and disk views", () => {
    const deck = new TerminalSessionDeck();

    expect(deck.activateFilesystemEntry("missing")).toEqual({ kind: "missing" });
    expect(deck.activateFilesystemEntry("Show disks")).toEqual({ kind: "show-disks" });
    expect(deck.activateFilesystemEntry("missing")).toEqual({ kind: "missing" });
  });
});
