import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runValidationCommands(commands: string[][], cwd: string): Promise<void> {
  for (const command of commands) {
    const [executable, ...args] = command;
    if (!executable) throw new Error("Validation command cannot be empty");
    try {
      await execFileAsync(executable, args, { cwd, maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60_000 });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Validation command failed (${command.join(" ")}): ${detail}`);
    }
  }
}
