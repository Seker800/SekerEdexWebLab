import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ScenarioContract } from "../config/contract.js";
import type { PageCollector, RepairAgent, RepairWorkspace } from "../domain/ports.js";
import type { AttemptReport, FinalReport, RepairRequest } from "../domain/types.js";
import { compareScreenshotRegion, compareScreenshots } from "../comparison/visual-comparator.js";
import { judgeVisualResult } from "../judge/visual-judge.js";

export interface WorkflowOptions {
  contract: ScenarioContract;
  artifactRoot: string;
  collector: PageCollector;
  repairAgent?: RepairAgent;
  repairWorkspace?: RepairWorkspace;
  afterRepair?: () => Promise<void>;
  runId?: string;
}

function defaultRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function evidenceManifest(directory: string): Promise<Record<string, string>> {
  const manifest: Record<string, string> = {};
  const visit = async (currentDirectory: string): Promise<void> => {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile()) manifest[path.relative(directory, absolutePath)] = await sha256(absolutePath);
    }));
  };
  await visit(directory);
  return Object.fromEntries(Object.entries(manifest).sort(([left], [right]) => left.localeCompare(right)));
}

async function assertEvidenceUnchanged(directory: string, expected: Record<string, string>): Promise<void> {
  const actual = await evidenceManifest(directory);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Immutable run evidence changed during repair");
  }
}

export async function runWorkflow(options: WorkflowOptions): Promise<FinalReport> {
  const { contract, collector } = options;
  if (options.repairAgent && !options.repairWorkspace) {
    throw new Error("A repair workspace is required when live repair is enabled");
  }
  const runId = options.runId ?? defaultRunId();
  const runDirectory = path.resolve(options.artifactRoot, runId);
  const startedAt = new Date().toISOString();
  const attempts: AttemptReport[] = [];
  await mkdir(runDirectory, { recursive: false });

  const frozenContractPath = path.join(runDirectory, "contract.json");
  await writeJson(frozenContractPath, contract);

  let target;
  try {
    const targetPath = path.join(runDirectory, "target.png");
    if (contract.targetScreenshotPath) {
      const sourcePath = path.resolve(contract.targetScreenshotPath);
      await copyFile(sourcePath, targetPath);
      target = {
        screenshotPath: targetPath,
        diagnostics: { consoleErrors: [], pageErrors: [], finalUrl: `file://${sourcePath}` }
      };
    } else {
      target = await collector.capture(
        contract.targetUrl!,
        contract.viewport,
        targetPath,
        contract.readySelector
      );
    }
    await writeJson(path.join(runDirectory, "target-browser.json"), target.diagnostics);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const blocked: FinalReport = {
      runId,
      scenarioId: contract.scenarioId,
      status: "blocked",
      startedAt,
      finishedAt: new Date().toISOString(),
      target: {
        screenshotPath: path.join(runDirectory, "target.png"),
        diagnostics: { consoleErrors: [], pageErrors: [message], finalUrl: contract.targetUrl ?? contract.targetScreenshotPath ?? "unknown" }
      },
      attempts,
      artifactDirectory: runDirectory,
      blocker: `Target capture failed: ${message}`
    };
    await writeJson(path.join(runDirectory, "final-report.json"), blocked);
    await collector.close();
    return blocked;
  }

  let blocker: string | undefined;
  const frozenContractHash = await sha256(frozenContractPath);
  const frozenTargetHash = await sha256(target.screenshotPath);
  try {
    for (let attempt = 1; attempt <= contract.maxAttempts; attempt += 1) {
      const attemptDirectory = path.join(runDirectory, "attempts", String(attempt));
      await mkdir(attemptDirectory, { recursive: true });
      const replica = await collector.capture(
        contract.replicaUrl,
        contract.viewport,
        path.join(attemptDirectory, "replica.png"),
        contract.readySelector
      );
      await writeJson(path.join(attemptDirectory, "browser.json"), replica.diagnostics);

      const diffPath = path.join(attemptDirectory, "diff.png");
      const metrics = await compareScreenshots(
        target.screenshotPath,
        replica.screenshotPath,
        diffPath,
        contract.comparisonOptions
      );
      await writeJson(path.join(attemptDirectory, "metrics.json"), metrics);
      const verdict = judgeVisualResult(metrics, replica.diagnostics, contract.maxDifferenceRatio);
      const verdictPath = path.join(attemptDirectory, "verdict.json");
      await writeJson(verdictPath, verdict);
      const regionEvidence = (await Promise.all(
        Object.entries(contract.comparisonRegions ?? {}).map(async ([name, region]) => {
          const regionDirectory = path.join(attemptDirectory, "regions", name);
          await mkdir(regionDirectory, { recursive: true });
          const diffScreenshotPath = path.join(regionDirectory, "diff.png");
          const regionMetrics = await compareScreenshotRegion(
            target.screenshotPath,
            replica.screenshotPath,
            diffScreenshotPath,
            region,
            contract.comparisonOptions
          );
          await writeJson(path.join(regionDirectory, "metrics.json"), regionMetrics);
          return { name, diffScreenshotPath, metrics: regionMetrics };
        })
      )).sort((left, right) => right.metrics.differentPixels - left.metrics.differentPixels);

      const attemptReport: AttemptReport = { attempt, replica, verdict };
      attempts.push(attemptReport);
      if (verdict.status === "passed") break;
      if (!options.repairAgent || attempt === contract.maxAttempts) continue;

      const repairRequest: RepairRequest = {
        scenarioId: contract.scenarioId,
        attempt,
        contractPath: frozenContractPath,
        targetScreenshotPath: target.screenshotPath,
        replicaScreenshotPath: replica.screenshotPath,
        diffScreenshotPath: diffPath,
        verdictPath,
        allowedPaths: contract.allowedPaths,
        validationCommands: contract.validationCommands,
        rejectedRepairs: attempts.flatMap((previousAttempt) => {
          if (previousAttempt.repairCandidate?.decision !== "rejected") return [];
          return [{
            attempt: previousAttempt.attempt,
            summary: previousAttempt.repair?.summary ?? "Rejected repair",
            changedFiles: previousAttempt.repair?.changedFiles ?? [],
            reason: previousAttempt.repairCandidate.reason,
            baselineDifferenceRatio: previousAttempt.verdict.metrics.differenceRatio,
            candidateDifferenceRatio: previousAttempt.repairCandidate.verdict.metrics.differenceRatio
          }];
        }),
        ...(regionEvidence.length > 0 ? { regionEvidence } : {}),
        ...(contract.sourceEvidence ? { sourceEvidence: contract.sourceEvidence } : {})
      };

      try {
        const immutableEvidence = await evidenceManifest(runDirectory);
        await options.repairWorkspace?.checkpoint();
        attemptReport.repair = await options.repairAgent.repair(repairRequest);
        if (attemptReport.repair.status === "blocked") {
          await options.repairWorkspace?.rollback();
          await assertEvidenceUnchanged(runDirectory, immutableEvidence);
          await writeJson(path.join(attemptDirectory, "repair.json"), attemptReport.repair);
          blocker = attemptReport.repair.summary;
          break;
        }
        if (options.afterRepair) await options.afterRepair();
        if (await sha256(frozenContractPath) !== frozenContractHash) {
          throw new Error("Frozen contract changed during repair");
        }
        if (await sha256(target.screenshotPath) !== frozenTargetHash) {
          throw new Error("Target evidence changed during repair");
        }
        await assertEvidenceUnchanged(runDirectory, immutableEvidence);
        await writeJson(path.join(attemptDirectory, "repair.json"), attemptReport.repair);

        const candidateDirectory = path.join(attemptDirectory, "candidate");
        await mkdir(candidateDirectory, { recursive: true });
        const candidateReplica = await collector.capture(
          contract.replicaUrl,
          contract.viewport,
          path.join(candidateDirectory, "replica.png"),
          contract.readySelector
        );
        await writeJson(path.join(candidateDirectory, "browser.json"), candidateReplica.diagnostics);
        const candidateMetrics = await compareScreenshots(
          target.screenshotPath,
          candidateReplica.screenshotPath,
          path.join(candidateDirectory, "diff.png"),
          contract.comparisonOptions
        );
        await writeJson(path.join(candidateDirectory, "metrics.json"), candidateMetrics);
        const candidateVerdict = judgeVisualResult(
          candidateMetrics,
          candidateReplica.diagnostics,
          contract.maxDifferenceRatio
        );
        await writeJson(path.join(candidateDirectory, "verdict.json"), candidateVerdict);
        const candidateRegionMetrics = await Promise.all(
          Object.entries(contract.comparisonRegions ?? {}).map(async ([name, region]) => {
            const regionDirectory = path.join(candidateDirectory, "regions", name);
            await mkdir(regionDirectory, { recursive: true });
            const regionMetrics = await compareScreenshotRegion(
              target.screenshotPath,
              candidateReplica.screenshotPath,
              path.join(regionDirectory, "diff.png"),
              region,
              contract.comparisonOptions
            );
            await writeJson(path.join(regionDirectory, "metrics.json"), regionMetrics);
            return { name, metrics: regionMetrics };
          })
        );
        const baselineRegionMetrics = new Map(regionEvidence.map((region) => [region.name, region.metrics]));
        const regionChanges = candidateRegionMetrics.flatMap(({ name, metrics: candidate }) => {
          const baseline = baselineRegionMetrics.get(name);
          return baseline ? [{
            name,
            baseline,
            candidate,
            differentPixelsDelta: candidate.differentPixels - baseline.differentPixels
          }] : [];
        }).sort((left, right) => left.differentPixelsDelta - right.differentPixelsDelta);

        const candidateHealthy = candidateReplica.diagnostics.consoleErrors.length === 0
          && candidateReplica.diagnostics.pageErrors.length === 0;
        const improved = candidateMetrics.dimensionsMatch
          && candidateHealthy
          && candidateMetrics.differenceRatio < metrics.differenceRatio;
        const scoreChange = `${(metrics.differenceRatio * 100).toFixed(3)}% to ${(candidateMetrics.differenceRatio * 100).toFixed(3)}%`;
        const reason = improved
          ? `Visual difference improved from ${scoreChange}`
          : !candidateMetrics.dimensionsMatch
            ? "Candidate screenshot dimensions do not match the target"
            : !candidateHealthy
              ? "Candidate browser diagnostics contain errors"
              : `Visual difference did not improve: ${scoreChange}`;
        attemptReport.repairCandidate = {
          replica: candidateReplica,
          verdict: candidateVerdict,
          decision: improved ? "accepted" : "rejected",
          reason,
          ...(regionChanges.length > 0 ? { regionChanges } : {})
        };
        await writeJson(path.join(candidateDirectory, "decision.json"), {
          decision: attemptReport.repairCandidate.decision,
          reason,
          ...(regionChanges.length > 0 ? { regionChanges } : {})
        });
        if (improved) await options.repairWorkspace?.accept();
        else await options.repairWorkspace?.rollback();
      } catch (error) {
        await options.repairWorkspace?.rollback();
        blocker = error instanceof Error ? error.message : String(error);
        break;
      }
    }
  } catch (error) {
    blocker = error instanceof Error ? error.message : String(error);
  } finally {
    await collector.close();
  }

  const finalAttempt = attempts.at(-1);
  const status = blocker ? "blocked" : finalAttempt?.verdict.status === "passed" ? "passed" : "failed";
  const report: FinalReport = {
    runId,
    scenarioId: contract.scenarioId,
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    target,
    attempts,
    artifactDirectory: runDirectory,
    ...(blocker ? { blocker } : {})
  };
  await writeJson(path.join(runDirectory, "final-report.json"), report);
  return report;
}
