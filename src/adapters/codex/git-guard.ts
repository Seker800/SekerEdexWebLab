import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
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
    if (status.includes("R") || status.includes("C")) {
      const sourcePath = records[index + 1];
      if (sourcePath) paths.push(sourcePath);
      index += 1;
    }
  }
  return [...new Set(paths)];
}

export async function untrackedPaths(repositoryRoot: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { cwd: repositoryRoot }
  );
  return stdout.split("\0").filter(Boolean);
}

export async function restoreCleanRepository(
  repositoryRoot: string,
  preservedUntrackedPaths: ReadonlySet<string> = new Set()
): Promise<void> {
  const untracked = await untrackedPaths(repositoryRoot);
  await execFileAsync(
    "git",
    ["restore", "--source=HEAD", "--staged", "--worktree", "--", "."],
    { cwd: repositoryRoot }
  );
  await Promise.all(untracked.filter((entry) => !preservedUntrackedPaths.has(entry)).map(async (entry) => {
    const absolutePath = path.resolve(repositoryRoot, entry);
    const relative = path.relative(repositoryRoot, absolutePath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Refusing to remove an untracked path outside the repository: ${entry}`);
    }
    await rm(absolutePath, { recursive: true, force: true });
  }));
}

export function pathsOutsideAllowed(changed: string[], allowedPaths: string[]): string[] {
  const normalizedAllowed = allowedPaths.map((entry) => path.normalize(entry).replace(/[/\\]+$/, ""));
  return changed.filter((entry) => {
    const normalized = path.normalize(entry);
    return !normalizedAllowed.some((allowed) => normalized === allowed || normalized.startsWith(`${allowed}${path.sep}`));
  });
}
