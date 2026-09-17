export interface TerminalEntry {
  kind: "command" | "output";
  text: string;
}

export interface CommandResult {
  entries: TerminalEntry[];
  clear: boolean;
}

const help = [
  "AVAILABLE COMMANDS",
  "  neofetch   display system identity",
  "  status     inspect active subsystems",
  "  files      list mounted workspace",
  "  date       show deck time",
  "  echo       print text",
  "  clear      clear terminal"
].join("\n");

export function executeCommand(rawCommand: string, now = new Date()): CommandResult {
  const command = rawCommand.trim();
  const [name = "", ...args] = command.split(/\s+/);
  const lowerName = name.toLowerCase();
  const commandEntry: TerminalEntry = { kind: "command", text: `operator@seker:~$ ${command}` };

  if (!command) return { entries: [], clear: false };
  if (lowerName === "clear") return { entries: [], clear: true };
  if (lowerName === "help") return { entries: [commandEntry, { kind: "output", text: help }], clear: false };
  if (lowerName === "echo") return { entries: [commandEntry, { kind: "output", text: args.join(" ") }], clear: false };
  if (lowerName === "date") {
    return { entries: [commandEntry, { kind: "output", text: now.toISOString() }], clear: false };
  }
  if (lowerName === "status") {
    return {
      entries: [commandEntry, { kind: "output", text: "CORE ONLINE\nTELEMETRY STREAMING\nNETWORK LINK STABLE\nINPUT MATRIX READY" }],
      clear: false
    };
  }
  if (lowerName === "files") {
    return { entries: [commandEntry, { kind: "output", text: "drwxr-xr-x  telemetry/\ndrwxr-xr-x  missions/\ndrwxr-xr-x  archives/\n-rw-r--r--  NORTH_STAR.md" }], clear: false };
  }
  if (lowerName === "neofetch") {
    return { entries: [commandEntry, { kind: "output", text: neofetchText }], clear: false };
  }

  return {
    entries: [commandEntry, { kind: "output", text: `command not found: ${name}\ntype 'help' for available commands` }],
    clear: false
  };
}

const neofetchRows: Array<[string, string]> = [
  ["       _,met$$$$$gg.", "squared@batcore-home"],
  ["    ,g$$$$$$$$$$$$$$$P.", "--------------------"],
  ["  ,g$$P\"     \"\"\"Y$$.\".", "OS: Debian GNU/Linux 9.9 (stretch) x86_64"],
  [" ,$$P'              `$$$.", "Model: G551JK 1.0"],
  ["'$$P       ,ggs.     `$$b:", "Kernel: 4.9.0-9-amd64"],
  ["`d$$'     ,$P\"'   .    $$$", "Uptime: 1d 9h 51m"],
  [" $$P      d$'     ,    $$P", "Packages: 2319"],
  [" $$:      $$.   -    ,d$$'", "Shell: bash 4.4.12"],
  [" $$;      Y$b._   _,d$P'", "Resolution: 1920x1080, 1920x1080, 1920x1080"],
  [" Y$$.    `.`\"Y$$$$P\"'", "DE: GNOME"],
  [" `$$b      \"-.__", "WM: GNOME Shell"],
  ["  `Y$$", "WM Theme: Flat-Remix-dark-miami"],
  ["   `Y$$.", "Theme: Fantome"],
  ["     `$$b.", "Icons: Flat-Remix-Dark"],
  ["       `Y$$b.", "Terminal: edex-ui"],
  ["          `\"Y$b._", "CPU: Intel i5-4200H (4) @ 3.4GHz"],
  ["              `\"\"\"\"", "GPU: NVIDIA GeForce GTX 850M"],
  ["", "Memory: 5032MB / 7871MB"],
  ["", ""],
  ["", "■ ■ ■ ■ ■ ■ ■ ■"]
];

export const neofetchText = [
  "cd ..",
  "~/.c/eDEX-UI ❯ neofetch",
  ...neofetchRows.map(([logo, info]) => `${logo.padEnd(30)}${info}`)
].join("\n");
