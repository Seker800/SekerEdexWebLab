import { cp, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RepairWorkspace } from "../../domain/ports.js";

interface SnapshotEntry {
  repositoryPath: string;
  snapshotPath: string;
  existed: boolean;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export class AllowedPathRepairWorkspace implements RepairWorkspace {
  private snapshotRoot: string | undefined;
  private entries: SnapshotEntry[] = [];

  constructor(
    private readonly repositoryRoot: string,
    private readonly allowedPaths: string[]
  ) {}

  async checkpoint(): Promise<void> {
    if (this.snapshotRoot) throw new Error("Repair workspace already has an active checkpoint");
    this.snapshotRoot = await mkdtemp(path.join(tmpdir(), "edex-repair-"));
    this.entries = [];

    for (const [index, allowedPath] of this.allowedPaths.entries()) {
      const repositoryPath = path.resolve(this.repositoryRoot, allowedPath);
      const relative = path.relative(this.repositoryRoot, repositoryPath);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        await this.discard();
        throw new Error(`Repair path must be a repository child: ${allowedPath}`);
      }
      const snapshotPath = path.join(this.snapshotRoot, String(index));
      const existed = await exists(repositoryPath);
      if (existed) await cp(repositoryPath, snapshotPath, { recursive: true, preserveTimestamps: true });
      this.entries.push({ repositoryPath, snapshotPath, existed });
    }
  }

  async accept(): Promise<void> {
    await this.discard();
  }

  async rollback(): Promise<void> {
    if (!this.snapshotRoot) return;
    for (const entry of this.entries) {
      await rm(entry.repositoryPath, { recursive: true, force: true });
      if (entry.existed) {
        await cp(entry.snapshotPath, entry.repositoryPath, { recursive: true, preserveTimestamps: true });
      }
    }
    await this.discard();
  }

  private async discard(): Promise<void> {
    const snapshotRoot = this.snapshotRoot;
    this.snapshotRoot = undefined;
    this.entries = [];
    if (snapshotRoot) await rm(snapshotRoot, { recursive: true, force: true });
  }
}
