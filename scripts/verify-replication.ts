import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { PlaywrightCollector } from "../src/adapters/browser/playwright-collector.js";
import { loadContract } from "../src/config/contract.js";
import { runWorkflow } from "../src/orchestrator/run-workflow.js";

const configPath = path.resolve("specs/edex-command-deck.contract.json");
const artifactRoot = path.resolve("artifacts/runs");
await mkdir(artifactRoot, { recursive: true });

const server = await createServer({
  root: path.resolve("apps/clone"),
  server: { host: "127.0.0.1", port: 4174, strictPort: true },
  logLevel: "error"
});

await server.listen();
try {
  const report = await runWorkflow({
    contract: await loadContract(configPath),
    artifactRoot,
    collector: new PlaywrightCollector(),
    runId: `edex-${Date.now()}`
  });
  process.stdout.write(`Replication workflow ${report.status}: ${path.join(report.artifactDirectory, "final-report.json")}\n`);
  process.exitCode = report.status === "passed" ? 0 : report.status === "failed" ? 1 : 2;
} finally {
  await server.close();
}
