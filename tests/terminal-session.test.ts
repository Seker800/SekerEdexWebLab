import { describe, expect, it } from "vitest";
import { createSandboxFilesystem } from "../apps/clone/src/browser-filesystem.js";
import { TerminalSessionDeck } from "../apps/clone/src/terminal-session.js";
import { blogDocuments } from "../apps/clone/src/blog-content-registry.js";

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

  it("exposes blog documents and images only in the runtime content tree", () => {
    const filesystem = createSandboxFilesystem({ blogDocuments });
    expect(filesystem.list(filesystem.home).map((entry) => entry.name)).toContain("Blog");
    expect(filesystem.list(`${filesystem.home}/Blog`).map((entry) => entry.name)).toEqual(["Show disks", "Go up", "posts", "projects", "images", "about.md"]);
    expect(filesystem.entry(`${filesystem.home}/Blog/posts`, "welcome.md")?.preview).toMatchObject({ kind: "document", title: "Welcome to the command deck" });
    expect(filesystem.entry(`${filesystem.home}/Blog/images`, "command-deck.svg")?.preview).toMatchObject({ kind: "image", mediaType: "image/svg+xml" });
    expect(createSandboxFilesystem().list(filesystem.home).map((entry) => entry.name)).not.toContain("Blog");
    expect(createSandboxFilesystem({ blogDocuments, startInBlog: true }).initialPath).toBe(`${filesystem.home}/Blog`);
    expect(createSandboxFilesystem({ startInBlog: true }).initialPath).toBe(filesystem.home);
  });

  it("can start the runtime session directly in the blog content tree", () => {
    const deck = new TerminalSessionDeck(createSandboxFilesystem({ blogDocuments, startInBlog: true }));
    expect(deck.current.cwd).toBe(`${deck.filesystem.home}/Blog`);
    expect(deck.filesystemEntries().map((entry) => entry.name)).toEqual(["Show disks", "Go up", "posts", "projects", "images", "about.md"]);
  });

  it("projects nested content paths without filesystem-specific article wiring", () => {
    const filesystem = createSandboxFilesystem({
      blogDocuments: [{
        relativePath: "notes/architecture/boundaries.md",
        title: "Boundaries",
        summary: "A nested document.",
        publishedAt: "2026-09-18",
        tags: ["architecture"],
        markdown: "# Boundaries"
      }]
    });

    expect(filesystem.list(`${filesystem.home}/Blog`).map((entry) => entry.name)).toContain("notes");
    expect(filesystem.list(`${filesystem.home}/Blog/notes`).map((entry) => entry.name)).toContain("architecture");
    expect(filesystem.entry(`${filesystem.home}/Blog/notes/architecture`, "boundaries.md")?.content).toBe("# Boundaries");
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

  it("cycles keyboard shortcuts through existing sessions without creating empty tabs", () => {
    const deck = new TerminalSessionDeck();

    expect(deck.adjacentSessionIndex(1)).toBe(0);
    expect(deck.label(1)).toBe("EMPTY");
    deck.activate(2);
    expect(deck.adjacentSessionIndex(1)).toBe(0);
    expect(deck.adjacentSessionIndex(-1)).toBe(0);
    deck.activate(0);
    expect(deck.adjacentSessionIndex(1)).toBe(2);
    expect(deck.adjacentSessionIndex(-1)).toBe(2);
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

  it("quotes completed filesystem paths that contain spaces", () => {
    const deck = new TerminalSessionDeck();

    expect(deck.complete("cd Loc")).toBe("cd 'Local Storage/'");
    expect(deck.submit(deck.complete("cd Loc"))).toBe("success");
    expect(deck.current.cwd).toMatch(/\/Local Storage$/);
  });

  it("maps reference filesystem actions onto typed browser behavior", () => {
    const deck = new TerminalSessionDeck();

    expect(deck.activateFilesystemEntry("themes")).toEqual({ kind: "navigated", feedback: "success" });
    expect(deck.current.cwd).toMatch(/\/themes$/);
    expect(deck.activateFilesystemEntry("tron.json")).toEqual({
      kind: "theme",
      theme: "tron",
      accepted: true,
      feedback: "success"
    });
    expect(deck.activateFilesystemEntry("tron-disrupted.json")).toEqual({
      kind: "theme",
      theme: "tron-disrupted",
      accepted: false,
      feedback: "denied"
    });
    expect(deck.activateFilesystemEntry("Go up")).toEqual({ kind: "navigated", feedback: "success" });
    expect(deck.current.cwd).toBe(deck.filesystem.home);
    expect(deck.activateFilesystemEntry("keyboards")).toEqual({ kind: "navigated", feedback: "success" });
    expect(deck.activateFilesystemEntry("en-US.json")).toEqual({ kind: "keyboard", layout: "en-US", feedback: "success" });
  });

  it("returns typed blog preview actions instead of terminal insertion", () => {
    const deck = new TerminalSessionDeck(createSandboxFilesystem({ blogDocuments }));
    deck.activateFilesystemEntry("Blog");
    deck.activateFilesystemEntry("posts");
    const document = deck.activateFilesystemEntry("welcome.md");
    expect(document.kind).toBe("document");
    if (document.kind === "document") expect(document.entry.preview).toMatchObject({ kind: "document" });
    deck.activateFilesystemEntry("Go up");
    deck.activateFilesystemEntry("images");
    const image = deck.activateFilesystemEntry("content-flow.svg");
    expect(image.kind).toBe("image");
    if (image.kind === "image") expect(image.entry.preview).toMatchObject({ kind: "image" });
  });

  it("exposes a reversible sandbox disk view", () => {
    const deck = new TerminalSessionDeck();

    expect(deck.activateFilesystemEntry("Show disks")).toEqual({ kind: "show-disks", feedback: "info" });
    expect(deck.filesystemEntries().map((entry) => entry.name)).toEqual(["Home sandbox"]);
    expect(deck.activateFilesystemEntry("Home sandbox")).toEqual({ kind: "navigated", feedback: "success" });
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

    expect(deck.activateFilesystemEntry("missing")).toEqual({ kind: "missing", feedback: "error" });
    expect(deck.activateFilesystemEntry("Show disks")).toEqual({ kind: "show-disks", feedback: "info" });
    expect(deck.activateFilesystemEntry("missing")).toEqual({ kind: "missing", feedback: "error" });
  });

  it("reports command outcomes and keeps the canonical theme boundary explicit", () => {
    const deck = new TerminalSessionDeck();

    expect(deck.submit("theme")).toBe("info");
    expect(deck.current.entries.at(-1)?.text).toContain("ACTIVE THEME  tron");
    expect(deck.submit("theme tron")).toBe("success");
    expect(deck.submit("theme blade")).toBe("denied");
    expect(deck.current.entries.at(-1)?.text).toContain("locked to the canonical tron theme");
    expect(deck.submit("help")).toBe("info");
    expect(deck.current.entries.at(-1)?.text).toContain("clear  theme");
    expect(deck.complete("the")).toBe("theme");
    expect(deck.submit("not-a-command")).toBe("error");
    expect(deck.submit("clear")).toBe("success");
    expect(deck.submit("  ")).toBe("silent");
  });
});
