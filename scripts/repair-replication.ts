import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PlaywrightCollector } from "../src/adapters/browser/playwright-collector.js";
import { CodexRepairAgent } from "../src/adapters/codex/codex-repair-agent.js";
import { assertCleanRepository, changedPaths, pathsOutsideAllowed } from "../src/adapters/codex/git-guard.js";
import { AllowedPathRepairWorkspace } from "../src/adapters/codex/repair-workspace.js";
import { verifySourceEvidence } from "../src/adapters/codex/source-evidence.js";
import { runValidationCommands } from "../src/adapters/process/validation-runner.js";
import { loadContract } from "../src/config/contract.js";
import { withRepairComparison } from "../src/config/repair-contract.js";
import { runWorkflow } from "../src/orchestrator/run-workflow.js";

const repositoryRoot = process.cwd();
const configPath = path.resolve("specs/edex-command-deck.contract.json");
const artifactRoot = path.resolve("artifacts/runs");
const contract = withRepairComparison(await loadContract(configPath));

if (contract.allowedPaths.length === 0) throw new Error("Automated repair requires at least one allowed path");
await assertCleanRepository(repositoryRoot);
if (contract.sourceEvidence) await verifySourceEvidence(repositoryRoot, contract.sourceEvidence);
await mkdir(artifactRoot, { recursive: true });

const server = await createServer({
  root: path.resolve("apps/clone"),
  server: { host: "127.0.0.1", port: 4174, strictPort: true },
  logLevel: "error"
});

await server.listen();
try {
  const repairAgent = new CodexRepairAgent(
    repositoryRoot,
    path.join(repositoryRoot, "schemas/codex-repair-result.schema.json"),
    path.join(artifactRoot, "codex-last-result.json")
  );
  const report = await runWorkflow({
    contract,
    artifactRoot,
    collector: new PlaywrightCollector(),
    repairAgent,
    repairWorkspace: new AllowedPathRepairWorkspace(repositoryRoot, contract.allowedPaths),
    afterRepair: async () => {
      const changed = await changedPaths(repositoryRoot);
      const outside = pathsOutsideAllowed(changed, contract.allowedPaths);
      if (outside.length > 0) throw new Error(`Codex changed paths outside allowed paths: ${outside.join(", ")}`);
      await runValidationCommands(contract.validationCommands, repositoryRoot);
    },
    runId: `edex-repair-${Date.now()}`
  });

  process.stdout.write(`Automated eDEX repair ${report.status}: ${path.join(report.artifactDirectory, "final-report.json")}\n`);
  process.exitCode = report.status === "passed" ? 0 : report.status === "failed" ? 1 : 2;
} finally {
  await server.close();
}
