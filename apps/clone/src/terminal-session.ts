import { createSandboxFilesystem, type BrowserFileEntry, type BrowserFilesystem } from "./browser-filesystem.js";
import { executeCommand, neofetchText, type TerminalEntry } from "./terminal-model.js";

const sessionCount = 5;
const localCommands = ["cat", "cd", "clear", "date", "echo", "files", "help", "history", "ls", "neofetch", "pwd", "status", "theme"] as const;

export type TerminalFeedback = "silent" | "success" | "info" | "error" | "denied";

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
  | { kind: "document"; entry: BrowserFileEntry; feedback: TerminalFeedback }
  | { kind: "image"; entry: BrowserFileEntry; feedback: TerminalFeedback }
  | { kind: "navigated"; feedback: TerminalFeedback }
  | { kind: "show-disks"; feedback: TerminalFeedback }
  | { kind: "theme"; theme: string; accepted: boolean; feedback: TerminalFeedback }
  | { kind: "keyboard"; layout: string; feedback: TerminalFeedback }
  | { kind: "missing"; feedback: TerminalFeedback };

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

function completionToken(value: string): string {
  return /\s/.test(value) ? quoteShellToken(value) : value;
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

  adjacentSessionIndex(direction: -1 | 1): number {
    const activeSessions = this.sessions.flatMap((session, index) => session ? [index] : []);
    const activePosition = activeSessions.indexOf(this.activeIndex);
    return activeSessions[(activePosition + direction + activeSessions.length) % activeSessions.length] ?? this.activeIndex;
  }

  setDraft(value: string): void {
    this.current.draft = value;
  }

  clear(): void {
    this.current.entries = [];
  }

  submit(rawCommand: string): TerminalFeedback {
    const command = rawCommand.trim();
    this.current.draft = "";
    if (command === "") return "silent";
    this.current.history.push(command);
    this.resetHistoryCursor();

    const [name = "", ...args] = shellWords(command);
    if (name === "clear") {
      this.clear();
      return "success";
    }

    if (["cd", "pwd", "ls", "history", "cat"].includes(name)) {
      return this.runFilesystemCommand(command, name, args);
    }

    if (name === "theme") {
      this.current.entries.push(promptEntry(this.current, command, this.filesystem));
      const requestedTheme = args[0];
      if (requestedTheme === undefined || requestedTheme === "list") {
        this.current.entries.push(outputEntry("ACTIVE THEME  tron\nAVAILABLE     tron"));
        return "info";
      }
      if (requestedTheme !== "tron") {
        this.current.entries.push(outputEntry(`theme: '${requestedTheme}' is unavailable; this replica is locked to the canonical tron theme`));
        return "denied";
      }
      this.current.entries.push(outputEntry("THEME tron ACTIVE"));
      return "success";
    }

    if (name === "help") {
      this.current.entries.push(
        promptEntry(this.current, command, this.filesystem),
        outputEntry("AVAILABLE COMMANDS\nhelp  ls  cd  pwd  cat  clear  theme\nhistory  echo  date  status  files  neofetch")
      );
      return "info";
    }

    const result = executeCommand(command);
    const entries = result.entries.map((entry) => entry.kind === "command" ? promptEntry(this.current, command, this.filesystem) : entry);
    this.current.entries = result.clear ? [] : [...this.current.entries, ...entries];
    return localCommands.includes(name as typeof localCommands[number]) ? "success" : "error";
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
    return `${prefix}${completionToken(completion)}`;
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
      if (name !== "Home sandbox") return { kind: "missing", feedback: "error" };
      this.changeDirectory(this.filesystem.root);
      return { kind: "navigated", feedback: "success" };
    }
    const entry = this.filesystem.entry(this.current.cwd, name);
    if (!entry) return { kind: "missing", feedback: "error" };
    if (entry.name === "Show disks") {
      this.current.filesystemView = "disks";
      return { kind: "show-disks", feedback: "info" };
    }
    if (entry.name === "Go up") {
      this.changeDirectory("..");
      return { kind: "navigated", feedback: "success" };
    }
    if (entry.category === "directory") {
      this.changeDirectory(entry.name);
      return { kind: "navigated", feedback: "success" };
    }
    if (entry.preview?.kind === "document") return { kind: "document", entry, feedback: "info" };
    if (entry.preview?.kind === "image") return { kind: "image", entry, feedback: "info" };
    if (this.current.cwd === `${this.filesystem.canonicalRoot}/themes` && entry.name.endsWith(".json")) {
      const theme = entry.name.slice(0, -5);
      const accepted = theme === "tron";
      this.current.entries.push(outputEntry(accepted
        ? "THEME tron ACTIVE"
        : `theme: '${theme}' is unavailable; this replica is locked to the canonical tron theme`));
      return { kind: "theme", theme, accepted, feedback: accepted ? "success" : "denied" };
    }
    if (this.current.cwd === `${this.filesystem.canonicalRoot}/keyboards` && entry.name.endsWith(".json")) {
      const layout = entry.name.slice(0, -5);
      this.current.entries.push(outputEntry(`KEYBOARD ${layout} ACTIVE`));
      return { kind: "keyboard", layout, feedback: "success" };
    }
    return { kind: "insert", value: quoteShellToken(entry.name) };
  }

  activateContentPath(relativePath: string): FilesystemActivation {
    const absolutePath = relativePath === "" ? this.filesystem.contentRoot : `${this.filesystem.contentRoot}/${relativePath}`;
    if (this.filesystem.isDirectory(absolutePath)) {
      this.current.cwd = absolutePath;
      this.current.filesystemView = "directory";
      return { kind: "navigated", feedback: "success" };
    }
    const entry = this.filesystem.entryByPath(absolutePath);
    if (!entry?.contentPath) return { kind: "missing", feedback: "error" };
    this.current.cwd = absolutePath.slice(0, absolutePath.lastIndexOf("/"));
    this.current.filesystemView = "directory";
    if (entry.preview?.kind === "document") return { kind: "document", entry, feedback: "info" };
    if (entry.preview?.kind === "image") return { kind: "image", entry, feedback: "info" };
    return { kind: "missing", feedback: "error" };
  }

  private createSession(index: number, entries: TerminalEntry[]): TerminalSessionState {
    return {
      index,
      cwd: this.filesystem.initialPath,
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

  private runFilesystemCommand(command: string, name: string, args: string[]): TerminalFeedback {
    const session = this.current;
    session.entries.push(promptEntry(session, command, this.filesystem));
    if (name === "pwd") {
      session.entries.push(outputEntry(session.cwd));
      return "info";
    }
    if (name === "history") {
      session.entries.push(outputEntry(session.history.map((entry, index) => `${index + 1}  ${entry}`).join("\n")));
      return "info";
    }
    if (name === "cd") {
      return this.changeDirectory(args[0] ?? this.filesystem.root, false) ? "success" : "error";
    }

    const requestedPath = args[0] ?? ".";
    const path = this.filesystem.resolve(session.cwd, requestedPath);
    if (name === "ls") {
      if (!this.filesystem.isDirectory(path)) {
        session.entries.push(outputEntry(`ls: cannot access '${requestedPath}': no such directory`));
        return "error";
      }
      session.entries.push(outputEntry(this.filesystem.list(path)
        .filter((entry) => entry.category !== "navigation")
        .map((entry) => `${entry.name}${entry.category === "directory" ? "/" : ""}`)
        .join("  ")));
      return "info";
    }

    const content = this.filesystem.read(path);
    session.entries.push(outputEntry(content ?? `cat: ${requestedPath}: no readable file`));
    return content === undefined ? "error" : "info";
  }

  private changeDirectory(requestedPath: string, recordCommand = true): boolean {
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
      return false;
    }
    session.cwd = destination;
    session.filesystemView = "directory";
    return true;
  }
}
