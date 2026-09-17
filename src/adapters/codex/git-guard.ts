import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function assertCleanRepository(repositoryRoot: string): Promise<void> {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd: repositoryRoot });
  if (stdout.trim()) throw new Error("Live repair requires a clean Git working tree");
}

export async function changedPaths(repositoryRoot: string): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain", "-z"], { cwd: repositoryRoot });
  const records = stdout.split("\0").filter(Boolean);
  const paths: string[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    const status = record.slice(0, 2);
    paths.push(record.slice(3));
    if (status.includes("R") || status.includes("C")) index += 1;
  }
  return paths;
}

export function pathsOutsideAllowed(changed: string[], allowedPaths: string[]): string[] {
  const normalizedAllowed = allowedPaths.map((entry) => path.normalize(entry).replace(/[/\\]+$/, ""));
  return changed.filter((entry) => {
    const normalized = path.normalize(entry);
    return !normalizedAllowed.some((allowed) => normalized === allowed || normalized.startsWith(`${allowed}${path.sep}`));
  });
}
