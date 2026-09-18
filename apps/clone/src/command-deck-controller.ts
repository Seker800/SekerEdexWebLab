import type { BrowserFileEntry } from "./browser-filesystem.js";
import { TerminalSessionDeck, type FilesystemActivation, type TerminalFeedback } from "./terminal-session.js";
import type { TerminalEntry } from "./terminal-model.js";

export type DeckModifier = "capsLock" | "shift" | "ctrl" | "alt" | "fn";

export type CommandDeckIntent =
  | { type: "set-draft"; value: string }
  | { type: "submit"; value: string }
  | { type: "clear-output" }
  | { type: "history-previous"; draft: string }
  | { type: "history-next" }
  | { type: "complete"; value: string }
  | { type: "activate-session"; index: number }
  | { type: "activate-adjacent-session"; direction: -1 | 1 }
  | { type: "activate-filesystem-entry"; name: string }
  | { type: "toggle-modifier"; modifier: DeckModifier }
  | { type: "clear-momentary-modifiers" };

export interface CommandDeckSnapshot {
  readonly current: {
    readonly index: number;
    readonly cwd: string;
    readonly draft: string;
    readonly entries: readonly Readonly<TerminalEntry>[];
    readonly filesystemView: "directory" | "disks";
  };
  readonly filesystem: { readonly root: string; readonly home: string; readonly entries: readonly Readonly<BrowserFileEntry>[] };
  readonly tabs: readonly { readonly label: string; readonly active: boolean }[];
  readonly modifiers: Readonly<Record<DeckModifier, boolean>>;
}

export interface CommandDeckResult {
  readonly feedback?: TerminalFeedback;
  readonly value?: string;
  readonly sessionIndex?: number;
  readonly filesystem?: FilesystemActivation;
}

export class CommandDeckController {
  private readonly terminal = new TerminalSessionDeck();
  private readonly modifiers: Record<DeckModifier, boolean> = {
    capsLock: false,
    shift: false,
    ctrl: false,
    alt: false,
    fn: false
  };

  dispatch(intent: CommandDeckIntent): CommandDeckResult {
    switch (intent.type) {
      case "set-draft":
        this.terminal.setDraft(intent.value);
        return {};
      case "submit":
        return { feedback: this.terminal.submit(intent.value) };
      case "clear-output":
        this.terminal.clear();
        return {};
      case "history-previous":
        return { value: this.terminal.historyPrevious(intent.draft) };
      case "history-next":
        return { value: this.terminal.historyNext() };
      case "complete":
        return { value: this.terminal.complete(intent.value) };
      case "activate-session":
        this.terminal.activate(intent.index);
        return { sessionIndex: intent.index };
      case "activate-adjacent-session": {
        const sessionIndex = this.terminal.adjacentSessionIndex(intent.direction);
        this.terminal.activate(sessionIndex);
        return { sessionIndex };
      }
      case "activate-filesystem-entry": {
        const filesystem = this.terminal.activateFilesystemEntry(intent.name);
        return {
          filesystem,
          ...("feedback" in filesystem ? { feedback: filesystem.feedback } : {})
        };
      }
      case "toggle-modifier":
        this.modifiers[intent.modifier] = !this.modifiers[intent.modifier];
        return {};
      case "clear-momentary-modifiers":
        this.modifiers.shift = false;
        this.modifiers.ctrl = false;
        this.modifiers.alt = false;
        this.modifiers.fn = false;
        return {};
    }
  }

  snapshot(): CommandDeckSnapshot {
    const current = this.terminal.current;
    return Object.freeze({
      current: Object.freeze({
        index: current.index,
        cwd: current.cwd,
        draft: current.draft,
        entries: Object.freeze(current.entries.map((entry) => Object.freeze({ ...entry }))),
        filesystemView: current.filesystemView
      }),
      filesystem: Object.freeze({
        root: this.terminal.filesystem.root,
        home: this.terminal.filesystem.home,
        entries: Object.freeze(this.terminal.filesystemEntries().map((entry) => Object.freeze({ ...entry })))
      }),
      tabs: Object.freeze(Array.from({ length: 5 }, (_, index) => Object.freeze({
        label: this.terminal.label(index),
        active: current.index === index
      }))),
      modifiers: Object.freeze({ ...this.modifiers })
    });
  }
}

export type { TerminalFeedback };
