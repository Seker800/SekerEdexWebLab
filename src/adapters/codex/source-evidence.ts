import { execFile } from "node:child_process";
import { access, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { SourceEvidence } from "../../domain/types.js";

const execFileAsync = promisify(execFile);

function assertRepositoryChild(repositoryRoot: string, candidate: string, label: string): void {
  const relative = path.relative(repositoryRoot, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the repository`);
  }
}

export async function verifySourceEvidence(repositoryRoot: string, evidence: SourceEvidence): Promise<void> {
  const canonicalRepositoryRoot = await realpath(repositoryRoot);
  const sourceRoot = await realpath(path.resolve(canonicalRepositoryRoot, evidence.localPath));
  assertRepositoryChild(canonicalRepositoryRoot, sourceRoot, "Source evidence checkout");

  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: sourceRoot });
  const actualRevision = stdout.trim();
  if (actualRevision !== evidence.revision) {
    throw new Error(`Source evidence revision mismatch: expected ${evidence.revision}, found ${actualRevision}`);
  }
  const { stdout: remoteStdout } = await execFileAsync("git", ["remote", "get-url", "origin"], { cwd: sourceRoot });
  if (remoteStdout.trim() !== evidence.repositoryUrl) {
    throw new Error(`Source evidence repository mismatch: expected ${evidence.repositoryUrl}, found ${remoteStdout.trim()}`);
  }

  const sourcePaths = [
    ...evidence.entryPaths,
    ...(evidence.modules?.flatMap((module) => module.entryPaths) ?? [])
  ];
  await Promise.all([...new Set(sourcePaths)].map(async (entry) => {
    const candidate = await realpath(path.resolve(sourceRoot, entry));
    assertRepositoryChild(sourceRoot, candidate, `Source evidence path ${entry}`);
    await access(candidate);
  }));

  if (evidence.guidePath) {
    const guide = await realpath(path.resolve(canonicalRepositoryRoot, evidence.guidePath));
    assertRepositoryChild(canonicalRepositoryRoot, guide, "Source evidence guide");
    await access(guide);
  }
}
