import { spawn } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { RepairAgent } from "../../domain/ports.js";
import type { RepairRequest, RepairResult } from "../../domain/types.js";

const repairResultSchema = z.object({
  status: z.enum(["changed", "no_change", "blocked"]),
  summary: z.string(),
  changedFiles: z.array(z.string()),
  validations: z.array(z.object({ command: z.string(), passed: z.boolean(), summary: z.string() }).strict()),
  remainingDifferences: z.array(z.string())
}).strict();

function signalProcess(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) return;
  try {
    if (process.platform === "win32") process.kill(pid, signal);
    else process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") return;
  }
}

export function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  terminationGraceMs = 2_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      detached: process.platform !== "win32",
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    let timedOut = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4000);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      signalProcess(child.pid, "SIGTERM");
      forceKillTimer = setTimeout(() => signalProcess(child.pid, "SIGKILL"), terminationGraceMs);
    }, timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (timedOut) reject(new Error(`Codex repair timed out after ${timeoutMs}ms and exited with ${code ?? signal}`));
      else if (code === 0) resolve();
      else reject(new Error(`Codex exited with ${code ?? signal}: ${stderr}`));
    });
  });
}

async function writableRoots(repositoryRoot: string, allowedPaths: string[]): Promise<string[]> {
  const canonicalRepositoryRoot = await realpath(repositoryRoot);
  return Promise.all(allowedPaths.map(async (allowedPath) => {
    const candidate = path.resolve(canonicalRepositoryRoot, allowedPath);
    const canonicalCandidate = await realpath(candidate);
    const relative = path.relative(canonicalRepositoryRoot, canonicalCandidate);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Repair path must be a repository child: ${allowedPath}`);
    }
    const metadata = await lstat(candidate);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`Live repair allowedPaths entries must be existing directories: ${allowedPath}`);
    }
    return canonicalCandidate;
  }));
}

export function buildRepairPrompt(request: RepairRequest, repositoryRoot?: string): string {
  const sourceModules = request.sourceEvidence?.modules?.flatMap((module) => [
    `Source module ${module.name}:`,
    ...module.entryPaths.map((entry) => `- ${path.join(request.sourceEvidence!.localPath, entry)}`)
  ]) ?? [];
  const sourceInstructions = request.sourceEvidence ? [
    `Read the source evidence first. The canonical repository is ${request.sourceEvidence.repositoryUrl} at revision ${request.sourceEvidence.revision}, checked out at ${request.sourceEvidence.localPath}.`,
    ...(request.sourceEvidence.guidePath ? [`Read the source port guide at ${request.sourceEvidence.guidePath}.`] : []),
    `Inspect these shared upstream entry points before editing: ${request.sourceEvidence.entryPaths.map((entry) => path.join(request.sourceEvidence!.localPath, entry)).join(", ")}.`,
    ...(sourceModules.length > 0 ? [
      "Use the diff to identify the highest-impact visual module, then read every source entry declared for that module before editing its browser port.",
      ...sourceModules
    ] : []),
    "Port source structure, styles, assets, timing, and behavior before applying browser compatibility corrections.",
    "Use screenshots to calibrate runtime state and verify the port; do not infer source-visible structure from pixels."
  ] : [];
  const rejectedRepairInstructions = request.rejectedRepairs.length > 0 ? [
    "The controller already rejected the following repairs because deterministic recapture did not improve the result. Treat them as regression counterexamples and do not repeat them:",
    ...request.rejectedRepairs.map((entry) =>
      `- Attempt ${entry.attempt}: ${entry.summary}; files: ${entry.changedFiles.join(", ") || "none"}; ${entry.reason}`
    )
  ] : [];
  const regionInstructions = request.regionEvidence?.length ? [
    "Prioritize these regional differences by mismatched pixel count. Inspect the named diff before selecting its matching source module:",
    ...request.regionEvidence.map((region) =>
      `- ${region.name}: ${region.metrics.differentPixels} pixels (${(region.metrics.differenceRatio * 100).toFixed(3)}%); diff ${region.diffScreenshotPath}`
    )
  ] : [];

  return [
    `Repair visual replication scenario ${request.scenarioId}, attempt ${request.attempt}.`,
    ...(repositoryRoot ? [`The repository root is ${repositoryRoot}.`] : []),
    `Read the frozen contract at ${request.contractPath}.`,
    ...sourceInstructions,
    ...rejectedRepairInstructions,
    ...regionInstructions,
    `Inspect the target screenshot ${request.targetScreenshotPath}, replica screenshot ${request.replicaScreenshotPath}, diff ${request.diffScreenshotPath}, and verdict ${request.verdictPath}.`,
    `You may edit only these repository paths: ${request.allowedPaths.map((entry) => repositoryRoot ? path.resolve(repositoryRoot, entry) : entry).join(", ")}.`,
    `Run these validation commands after editing: ${request.validationCommands.map((command) => command.join(" ")).join("; ")}.`,
    "Do not edit the contract, target evidence, judge, thresholds, schemas, or run artifacts.",
    "Do not add styles or behavior that only apply during screenshot capture or static mode to reduce the score.",
    "Every visual repair must improve the normal interactive application and remain faithful to the upstream source.",
    "Fix the shared root cause. Return the required structured result."
  ].join("\n");
}

export class CodexRepairAgent implements RepairAgent {
  constructor(
    private readonly repositoryRoot: string,
    private readonly schemaPath: string,
    private readonly outputPath: string,
    private readonly timeoutMs = 15 * 60_000
  ) {}

  async repair(request: RepairRequest): Promise<RepairResult> {
    const prompt = buildRepairPrompt(request, this.repositoryRoot);
    const roots = await writableRoots(this.repositoryRoot, request.allowedPaths);
    const [primaryRoot, ...additionalRoots] = roots;
    if (!primaryRoot) throw new Error("Live repair requires at least one writable root");

    await runProcess(
      "codex",
      [
        "exec",
        "--sandbox", "workspace-write",
        "--cd", primaryRoot,
        ...additionalRoots.flatMap((root) => ["--add-dir", root]),
        "--output-schema", path.resolve(this.schemaPath),
        "--output-last-message", path.resolve(this.outputPath),
        prompt
      ],
      this.repositoryRoot,
      this.timeoutMs
    );

    const raw: unknown = JSON.parse(await readFile(this.outputPath, "utf8"));
    return repairResultSchema.parse(raw);
  }
}
