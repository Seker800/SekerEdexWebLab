import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterEach, describe, expect, it } from "vitest";
import type { PageCollector } from "../src/domain/ports.js";
import { runWorkflow } from "../src/orchestrator/run-workflow.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("workflow failure handling", () => {
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
});
