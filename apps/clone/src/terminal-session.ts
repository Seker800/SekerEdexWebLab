import { createSandboxFilesystem, type BrowserFileEntry, type BrowserFilesystem } from "./browser-filesystem.js";
import { executeCommand, neofetchText, type TerminalEntry } from "./terminal-model.js";

const sessionCount = 5;
const localCommands = ["cat", "cd", "clear", "date", "echo", "files", "help", "history", "ls", "neofetch", "pwd", "status"] as const;

export interface TerminalSessionState {
  readonly index: number;
  cwd: string;
  draft: string;
  entries: TerminalEntry[];
  history: string[];
  historyCursor: number;
  historyDraft: string;
  filesystemView: "directory" | "disks";
}

export type FilesystemActivation =
  | { kind: "insert"; value: string }
  | { kind: "navigated" }
  | { kind: "show-disks" }
  | { kind: "missing" };

function shellWords(value: string): string[] {
  const words: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  for (const character of value.trim()) {
    if (quote) {
      if (character === quote) quote = undefined;
      else current += character;
    } else if (character === "'" || character === '"') quote = character;
    else if (/\s/.test(character)) {
      if (current !== "") words.push(current);
      current = "";
    } else current += character;
  }
  if (current !== "") words.push(current);
  return words;
}

function promptPath(path: string, filesystem: BrowserFilesystem): string {
  return path === filesystem.root ? "~" : path.startsWith(`${filesystem.root}/`) ? `~${path.slice(filesystem.root.length)}` : path;
}

function promptEntry(session: TerminalSessionState, command: string, filesystem: BrowserFilesystem): TerminalEntry {
  return { kind: "command", text: `operator@seker:${promptPath(session.cwd, filesystem)}$ ${command}` };
}

function outputEntry(text: string): TerminalEntry {
  return { kind: "output", text };
}

function longestCommonPrefix(values: readonly string[]): string {
  if (values.length === 0) return "";
  return values.slice(1).reduce((prefix, value) => {
    let length = 0;
    while (length < prefix.length && length < value.length && prefix[length] === value[length]) length += 1;
    return prefix.slice(0, length);
  }, values[0]!);
}

function quoteShellToken(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export class TerminalSessionDeck {
  readonly filesystem: BrowserFilesystem;
  readonly sessions: Array<TerminalSessionState | undefined> = Array.from({ length: sessionCount });
  private activeIndex = 0;

  constructor(filesystem = createSandboxFilesystem()) {
    this.filesystem = filesystem;
    this.sessions[0] = this.createSession(0, [outputEntry(neofetchText)]);
  }

  get current(): TerminalSessionState {
    return this.sessions[this.activeIndex]!;
  }

  activate(index: number): TerminalSessionState {
    if (!Number.isInteger(index) || index < 0 || index >= sessionCount) throw new RangeError(`Invalid terminal session index: ${index}`);
    this.sessions[index] ??= this.createSession(index, []);
    this.activeIndex = index;
    return this.current;
  }

  label(index: number): string {
    if (index === 0) return "MAIN SHELL";
    return this.sessions[index] ? `#${index + 1} - SHELL` : "EMPTY";
  }

  setDraft(value: string): void {
    this.current.draft = value;
  }

  clear(): void {
    this.current.entries = [];
  }

  submit(rawCommand: string): void {
    const command = rawCommand.trim();
    this.current.draft = "";
    if (command === "") return;
    this.current.history.push(command);
    this.resetHistoryCursor();

    const [name = "", ...args] = shellWords(command);
    if (name === "clear") {
      this.clear();
      return;
    }

    if (["cd", "pwd", "ls", "history", "cat"].includes(name)) {
      this.runFilesystemCommand(command, name, args);
      return;
    }

    const result = executeCommand(command);
    const entries = result.entries.map((entry) => entry.kind === "command" ? promptEntry(this.current, command, this.filesystem) : entry);
    this.current.entries = result.clear ? [] : [...this.current.entries, ...entries];
  }

  historyPrevious(draft: string): string {
    const session = this.current;
    if (session.history.length === 0) return draft;
    if (session.historyCursor === session.history.length) session.historyDraft = draft;
    session.historyCursor = Math.max(0, session.historyCursor - 1);
    return session.history[session.historyCursor] ?? draft;
  }

  historyNext(): string {
    const session = this.current;
    if (session.historyCursor >= session.history.length) return session.historyDraft;
    session.historyCursor += 1;
    return session.historyCursor === session.history.length ? session.historyDraft : session.history[session.historyCursor] ?? session.historyDraft;
  }

  complete(value: string): string {
    const trailingWhitespace = /\s$/.test(value);
    const words = shellWords(value);
    if (words.length === 0) return value;
    if (words.length === 1 && !trailingWhitespace) {
      const matches = localCommands.filter((command) => command.startsWith(words[0]!));
      const completion = matches.length === 1 ? matches[0] : longestCommonPrefix(matches);
      return completion ? completion : value;
    }

    const command = words[0]!;
    if (!["cat", "cd", "ls"].includes(command)) return value;
    const partial = trailingWhitespace ? "" : words.at(-1)!;
    const matches = this.filesystem.complete(this.current.cwd, partial);
    if (matches.length === 0) return value;
    const completion = matches.length === 1 ? matches[0]! : longestCommonPrefix(matches);
    const prefix = trailingWhitespace ? value : value.slice(0, value.length - partial.length);
    return `${prefix}${completion}`;
  }

  filesystemEntries(): BrowserFileEntry[] {
    if (this.current.filesystemView === "disks") {
      return [{
        name: "Home sandbox",
        category: "directory",
        icon: "showDisks",
        path: this.filesystem.root
      }];
    }
    return this.filesystem.list(this.current.cwd);
  }

  activateFilesystemEntry(name: string): FilesystemActivation {
    if (this.current.filesystemView === "disks") {
      if (name !== "Home sandbox") return { kind: "missing" };
      this.changeDirectory(this.filesystem.root);
      return { kind: "navigated" };
    }
    const entry = this.filesystem.entry(this.current.cwd, name);
    if (!entry) return { kind: "missing" };
    if (entry.name === "Show disks") {
      this.current.filesystemView = "disks";
      return { kind: "show-disks" };
    }
    if (entry.name === "Go up") {
      this.changeDirectory("..");
      return { kind: "navigated" };
    }
    if (entry.category === "directory") {
      this.changeDirectory(entry.name);
      return { kind: "navigated" };
    }
    return { kind: "insert", value: quoteShellToken(entry.name) };
  }

  private createSession(index: number, entries: TerminalEntry[]): TerminalSessionState {
    return {
      index,
      cwd: this.filesystem.home,
      draft: "",
      entries,
      history: [],
      historyCursor: 0,
      historyDraft: "",
      filesystemView: "directory"
    };
  }

  private resetHistoryCursor(): void {
    this.current.historyCursor = this.current.history.length;
    this.current.historyDraft = "";
  }

  private runFilesystemCommand(command: string, name: string, args: string[]): void {
    const session = this.current;
    session.entries.push(promptEntry(session, command, this.filesystem));
    if (name === "pwd") {
      session.entries.push(outputEntry(session.cwd));
      return;
    }
    if (name === "history") {
      session.entries.push(outputEntry(session.history.map((entry, index) => `${index + 1}  ${entry}`).join("\n")));
      return;
    }
    if (name === "cd") {
      this.changeDirectory(args[0] ?? this.filesystem.root, false);
      return;
    }

    const requestedPath = args[0] ?? ".";
    const path = this.filesystem.resolve(session.cwd, requestedPath);
    if (name === "ls") {
      if (!this.filesystem.isDirectory(path)) {
        session.entries.push(outputEntry(`ls: cannot access '${requestedPath}': no such directory`));
        return;
      }
      session.entries.push(outputEntry(this.filesystem.list(path)
        .filter((entry) => entry.category !== "navigation")
        .map((entry) => `${entry.name}${entry.category === "directory" ? "/" : ""}`)
        .join("  ")));
      return;
    }

    const content = this.filesystem.read(path);
    session.entries.push(outputEntry(content ?? `cat: ${requestedPath}: no readable file`));
  }

  private changeDirectory(requestedPath: string, recordCommand = true): void {
    const session = this.current;
    if (recordCommand) {
      const command = `cd ${quoteShellToken(requestedPath)}`;
      session.history.push(command);
      session.entries.push(promptEntry(session, command, this.filesystem));
      this.resetHistoryCursor();
    }
    const destination = this.filesystem.resolve(session.cwd, requestedPath);
    if (!this.filesystem.isDirectory(destination)) {
      session.entries.push(outputEntry(`cd: ${requestedPath}: no such directory`));
      return;
    }
    session.cwd = destination;
    session.filesystemView = "directory";
  }
}
