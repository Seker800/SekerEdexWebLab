import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, it } from "vitest";
import type { PageCollector, RepairAgent, RepairWorkspace } from "../src/domain/ports.js";
import { runWorkflow } from "../src/orchestrator/run-workflow.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("workflow failure handling", () => {
  it("requires transactional workspace handling for live repair", async () => {
    const collector: PageCollector = {
      async capture() { throw new Error("capture should not run"); },
      async close() {}
    };
    const repairAgent: RepairAgent = {
      async repair() { throw new Error("repair should not run"); }
    };

    await expect(runWorkflow({
      contract: {
        scenarioId: "unsafe-repair",
        targetUrl: "https://target.example",
        replicaUrl: "http://replica.example",
        viewport: { width: 1, height: 1 },
        maxDifferenceRatio: 0,
        maxAttempts: 1,
        allowedPaths: ["apps/clone"],
        validationCommands: []
      },
      artifactRoot: tmpdir(),
      collector,
      repairAgent
    })).rejects.toThrow("repair workspace is required");
  });

  it("persists a blocked report when replica capture fails", async () => {
    const artifactRoot = await mkdtemp(path.join(tmpdir(), "edex-workflow-"));
    temporaryDirectories.push(artifactRoot);
    let captures = 0;
    let closed = false;
    const collector: PageCollector = {
      async capture(url, _viewport, outputPath) {
        captures += 1;
        if (captures > 1) throw new Error("replica unavailable");
        const image = new PNG({ width: 1, height: 1 });
        image.data.fill(255);
        await writeFile(outputPath, PNG.sync.write(image));
        return { screenshotPath: outputPath, diagnostics: { consoleErrors: [], pageErrors: [], finalUrl: url } };
      },
      async close() { closed = true; }
    };

    const report = await runWorkflow({
      contract: {
        scenarioId: "blocked-replica",
        targetUrl: "https://target.example",
        replicaUrl: "http://127.0.0.1:1",
        viewport: { width: 800, height: 600 },
        maxDifferenceRatio: 0,
        maxAttempts: 1,
        allowedPaths: [],
        validationCommands: []
      },
      artifactRoot,
      collector,
      runId: "blocked-run"
    });

    expect(report.status).toBe("blocked");
    expect(report.blocker).toContain("replica unavailable");
    expect(closed).toBe(true);
    const persisted = JSON.parse(await readFile(path.join(artifactRoot, "blocked-run", "final-report.json"), "utf8"));
    expect(persisted.status).toBe("blocked");
  });

  it("blocks a repair that tampers with immutable run evidence", async () => {
    const artifactRoot = await mkdtemp(path.join(tmpdir(), "edex-workflow-"));
    temporaryDirectories.push(artifactRoot);
    const targetPath = path.join(artifactRoot, "target.png");
    const targetImage = new PNG({ width: 1, height: 1 });
    targetImage.data.fill(0);
    targetImage.data[3] = 255;
    await writeFile(targetPath, PNG.sync.write(targetImage));
    const collector: PageCollector = {
      async capture(url, _viewport, outputPath) {
        const image = new PNG({ width: 1, height: 1 });
        image.data.fill(255);
        await writeFile(outputPath, PNG.sync.write(image));
        return { screenshotPath: outputPath, diagnostics: { consoleErrors: [], pageErrors: [], finalUrl: url } };
      },
      async close() {}
    };
    const repairAgent: RepairAgent = {
      async repair(request) {
        await writeFile(request.verdictPath, "forged evidence", "utf8");
        return { status: "changed", summary: "tampered", changedFiles: [], validations: [], remainingDifferences: [] };
      }
    };
    const repairWorkspace: RepairWorkspace = { async checkpoint() {}, async accept() {}, async rollback() {} };

    const report = await runWorkflow({
      contract: {
        scenarioId: "immutable-evidence",
        targetScreenshotPath: targetPath,
        replicaUrl: "http://replica.example",
        viewport: { width: 1, height: 1 },
        maxDifferenceRatio: 0,
        maxAttempts: 2,
        allowedPaths: ["apps/clone"],
        validationCommands: []
      },
      artifactRoot,
      collector,
      repairAgent,
      repairWorkspace,
      runId: "tamper-run"
    });

    expect(report.status).toBe("blocked");
    expect(report.blocker).toBe("Immutable run evidence changed during repair");
  });

  it("rejects and rolls back a repair candidate that worsens the visual score", async () => {
    const artifactRoot = await mkdtemp(path.join(tmpdir(), "edex-workflow-"));
    temporaryDirectories.push(artifactRoot);
    const targetPath = path.join(artifactRoot, "target.png");
    const targetImage = new PNG({ width: 2, height: 1 });
    targetImage.data.fill(0);
    for (let index = 3; index < targetImage.data.length; index += 4) targetImage.data[index] = 255;
    await writeFile(targetPath, PNG.sync.write(targetImage));

    let repaired = false;
    let rollbacks = 0;
    const rejectedHistoryLengths: number[] = [];
    const regionalEvidence: Array<{ name: string; differentPixels: number }> = [];
    const collector: PageCollector = {
      async capture(url, _viewport, outputPath) {
        const image = new PNG({ width: 2, height: 1 });
        image.data.fill(0);
        for (let index = 3; index < image.data.length; index += 4) image.data[index] = 255;
        image.data[0] = 255;
        image.data[1] = 255;
        image.data[2] = 255;
        if (repaired) {
          image.data[4] = 255;
          image.data[5] = 255;
          image.data[6] = 255;
        }
        await writeFile(outputPath, PNG.sync.write(image));
        return { screenshotPath: outputPath, diagnostics: { consoleErrors: [], pageErrors: [], finalUrl: url } };
      },
      async close() {}
    };
    const repairAgent: RepairAgent = {
      async repair(request) {
        rejectedHistoryLengths.push(request.rejectedRepairs.length);
        regionalEvidence.push(...(request.regionEvidence ?? []).map((region) => ({
          name: region.name,
          differentPixels: region.metrics.differentPixels
        })));
        repaired = true;
        return { status: "changed", summary: "candidate", changedFiles: ["apps/clone/a"], validations: [], remainingDifferences: [] };
      }
    };
    const repairWorkspace: RepairWorkspace = {
      async checkpoint() {},
      async accept() {},
      async rollback() {
        repaired = false;
        rollbacks += 1;
      }
    };

    const report = await runWorkflow({
      contract: {
        scenarioId: "reject-regression",
        targetScreenshotPath: targetPath,
        replicaUrl: "http://replica.example",
        viewport: { width: 2, height: 1 },
        maxDifferenceRatio: 0,
        comparisonRegions: {
          leadingPixel: { x: 0, y: 0, width: 1, height: 1 }
        },
        maxAttempts: 3,
        allowedPaths: ["apps/clone"],
        validationCommands: []
      },
      artifactRoot,
      collector,
      repairAgent,
      repairWorkspace,
      runId: "reject-run"
    });

    expect(report.attempts[0]?.verdict.metrics.differentPixels).toBe(1);
    expect(report.attempts[0]?.repairCandidate).toMatchObject({
      decision: "rejected",
      verdict: { metrics: { differentPixels: 2 } },
      regionChanges: [{
        name: "leadingPixel",
        baseline: { differentPixels: 1 },
        candidate: { differentPixels: 1 },
        differentPixelsDelta: 0
      }]
    });
    expect(report.attempts[1]?.verdict.metrics.differentPixels).toBe(1);
    expect(report.attempts[2]?.verdict.metrics.differentPixels).toBe(1);
    expect(rejectedHistoryLengths).toEqual([0, 1]);
    expect(regionalEvidence).toEqual([
      { name: "leadingPixel", differentPixels: 1 },
      { name: "leadingPixel", differentPixels: 1 }
    ]);
    const firstRegionMetrics = JSON.parse(await readFile(
      path.join(artifactRoot, "reject-run", "attempts", "1", "regions", "leadingPixel", "metrics.json"),
      "utf8"
    ));
    expect(firstRegionMetrics.differentPixels).toBe(1);
    const firstCandidateRegionMetrics = JSON.parse(await readFile(
      path.join(artifactRoot, "reject-run", "attempts", "1", "candidate", "regions", "leadingPixel", "metrics.json"),
      "utf8"
    ));
    expect(firstCandidateRegionMetrics.differentPixels).toBe(1);
    expect(rollbacks).toBe(2);
    expect(repaired).toBe(false);
  });
});
