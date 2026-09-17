export interface SourceKeyboardKey {
  name: string;
  cmd: string;
  shift_name?: string;
  shift_cmd?: string;
  ctrl_cmd?: string;
  alt_name?: string;
  alt_cmd?: string;
  altshift_name?: string;
  altshift_cmd?: string;
  fn_name?: string;
  fn_cmd?: string;
  capslck_cmd?: string;
}

export interface KeyboardKey {
  key: string;
  label: string;
  icon?: string;
  shift?: string;
  alt?: string;
  altShift?: string;
  fn?: string;
  command: string;
  shiftCommand?: string;
  ctrlCommand?: string;
  altCommand?: string;
  altShiftCommand?: string;
  fnCommand?: string;
  capsLockCommand?: string;
}

export interface KeyboardModifiers {
  shift?: boolean;
  capsLock?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  fn?: boolean;
}

const rowNames = ["row_numbers", "row_1", "row_2", "row_3", "row_space"] as const;
const controlSequences = ["", "\u001b", "\u001c", "\u001d", "\u001e", "\u001f", "\u0011", "\u0017", "\u0012", "\u0012", "\u0019", "\u0015", "\u0010", "\u0001", "\u0013", "\u0004", "\u0006", "\u001a", "\u0018", "\u0003", "\u0016", "\u0002"] as const;
const iconPrefix = "ESCAPED|-- ICON: ";
const icons: Readonly<Record<string, string>> = {
  ARROW_UP: "↑",
  ARROW_LEFT: "←",
  ARROW_DOWN: "↓",
  ARROW_RIGHT: "→"
};

function expandControlSequences(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.replace(/~~~CTRLSEQ(\d+)~~~/g, (token, indexText: string) => {
    const sequence = controlSequences[Number(indexText)];
    return sequence ?? token;
  });
}

function isSourceKey(value: unknown): value is SourceKeyboardKey {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.name === "string" && typeof candidate.cmd === "string";
}

function browserIdentity(key: SourceKeyboardKey, rowIndex: number, keyIndex: number): { key: string; label: string; icon?: string } {
  if (key.name.startsWith(iconPrefix)) {
    const icon = icons[key.name.slice(iconPrefix.length)];
    if (!icon) throw new Error(`Unsupported upstream keyboard icon: ${key.name}`);
    return { key: icon, label: "", icon };
  }
  if (rowIndex === 2 && keyIndex === 13) return { key: "ENTER_LOWER", label: "" };
  if (rowIndex === 3 && keyIndex === 12) return { key: "SHIFT_RIGHT", label: key.name };
  if (rowIndex === 4 && keyIndex === 2) return { key: "SPACE", label: "" };
  if (rowIndex === 4 && keyIndex === 4) return { key: "CTRL_RIGHT", label: key.name };
  return { key: key.name, label: key.name };
}

function adaptKey(source: SourceKeyboardKey, rowIndex: number, keyIndex: number): KeyboardKey {
  return {
    ...browserIdentity(source, rowIndex, keyIndex),
    command: expandControlSequences(source.cmd)!,
    ...(source.shift_name !== undefined && { shift: source.shift_name }),
    ...(source.alt_name !== undefined && { alt: source.alt_name }),
    ...(source.altshift_name !== undefined && { altShift: source.altshift_name }),
    ...(source.fn_name !== undefined && { fn: source.fn_name }),
    ...(source.shift_cmd !== undefined && { shiftCommand: expandControlSequences(source.shift_cmd)! }),
    ...(source.ctrl_cmd !== undefined && { ctrlCommand: expandControlSequences(source.ctrl_cmd)! }),
    ...(source.alt_cmd !== undefined && { altCommand: expandControlSequences(source.alt_cmd)! }),
    ...(source.altshift_cmd !== undefined && { altShiftCommand: expandControlSequences(source.altshift_cmd)! }),
    ...(source.fn_cmd !== undefined && { fnCommand: expandControlSequences(source.fn_cmd)! }),
    ...(source.capslck_cmd !== undefined && { capsLockCommand: expandControlSequences(source.capslck_cmd)! })
  };
}

export function parseKeyboardLayout(value: unknown): KeyboardKey[][] {
  if (!value || typeof value !== "object") throw new Error("Upstream keyboard layout must be an object");
  const layout = value as Record<string, unknown>;
  return rowNames.map((rowName, rowIndex) => {
    const row = layout[rowName];
    if (!Array.isArray(row) || !row.every(isSourceKey)) throw new Error(`Invalid upstream keyboard row: ${rowName}`);
    return row.map((key, keyIndex) => adaptKey(key, rowIndex, keyIndex));
  });
}

export async function loadKeyboardLayout(url = "/keyboard/en-US.json"): Promise<KeyboardKey[][]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load upstream keyboard layout (${response.status})`);
  return parseKeyboardLayout(await response.json());
}

export function resolveKeyboardCommand(key: KeyboardKey, modifiers: KeyboardModifiers): string {
  let command = key.command;
  if ((modifiers.shift || modifiers.capsLock) && key.shiftCommand !== undefined) command = key.shiftCommand;
  if (modifiers.capsLock && key.capsLockCommand !== undefined) command = key.capsLockCommand;
  if (modifiers.ctrl && key.ctrlCommand !== undefined) command = key.ctrlCommand;
  if (modifiers.alt && key.altCommand !== undefined) command = key.altCommand;
  if (modifiers.alt && modifiers.shift && key.altShiftCommand !== undefined) command = key.altShiftCommand;
  if (modifiers.fn && key.fnCommand !== undefined) command = key.fnCommand;
  return command;
}
