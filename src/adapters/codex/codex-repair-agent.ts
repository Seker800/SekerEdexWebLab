import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
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

function runProcess(command: string, args: string[], cwd: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Codex repair timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Codex exited with ${code ?? signal}: ${stderr}`));
    });
  });
}

export function buildRepairPrompt(request: RepairRequest): string {
  const sourceInstructions = request.sourceEvidence ? [
    `Read the source evidence first. The canonical repository is ${request.sourceEvidence.repositoryUrl} at revision ${request.sourceEvidence.revision}, checked out at ${request.sourceEvidence.localPath}.`,
    ...(request.sourceEvidence.guidePath ? [`Read the source port guide at ${request.sourceEvidence.guidePath}.`] : []),
    `Inspect these upstream entry points before editing: ${request.sourceEvidence.entryPaths.map((entry) => path.join(request.sourceEvidence!.localPath, entry)).join(", ")}.`,
    "Port source structure, styles, assets, timing, and behavior before applying browser compatibility corrections.",
    "Use screenshots to calibrate runtime state and verify the port; do not infer source-visible structure from pixels."
  ] : [];
  const rejectedRepairInstructions = request.rejectedRepairs.length > 0 ? [
    "The controller already rejected the following repairs because deterministic recapture did not improve the result. Treat them as regression counterexamples and do not repeat them:",
    ...request.rejectedRepairs.map((entry) =>
      `- Attempt ${entry.attempt}: ${entry.summary}; files: ${entry.changedFiles.join(", ") || "none"}; ${entry.reason}`
    )
  ] : [];

  return [
    `Repair visual replication scenario ${request.scenarioId}, attempt ${request.attempt}.`,
    `Read the frozen contract at ${request.contractPath}.`,
    ...sourceInstructions,
    ...rejectedRepairInstructions,
    `Inspect the target screenshot ${request.targetScreenshotPath}, replica screenshot ${request.replicaScreenshotPath}, diff ${request.diffScreenshotPath}, and verdict ${request.verdictPath}.`,
    `You may edit only these repository paths: ${request.allowedPaths.join(", ")}.`,
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
    const prompt = buildRepairPrompt(request);

    await runProcess(
      "codex",
      [
        "exec",
        "--sandbox", "workspace-write",
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
