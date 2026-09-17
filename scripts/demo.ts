import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { loadContract } from "../src/config/contract.js";
import { PlaywrightCollector } from "../src/adapters/browser/playwright-collector.js";
import { runWorkflow } from "../src/orchestrator/run-workflow.js";

const [targetPage, replicaPage] = await Promise.all([
  readFile(path.resolve("examples/reference/page.html")),
  readFile(path.resolve("examples/replica/page.html"))
]);
const server = createServer((request, response) => {
  if (request.url === "/target" || request.url === "/replica") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(request.url === "/target" ? targetPage : replicaPage);
    return;
  }
  response.writeHead(404);
  response.end("Not found");
});

await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(4173, "127.0.0.1", resolve);
});

try {
  const contractPath = path.resolve("examples/demo.contract.json");
  const contract = await loadContract(contractPath);
  const artifactRoot = path.resolve("artifacts/runs");
  await mkdir(artifactRoot, { recursive: true });
  const report = await runWorkflow({
    contract,
    artifactRoot,
    collector: new PlaywrightCollector(),
    runId: `demo-${Date.now()}`
  });
  process.stdout.write(`Demo ${report.status}: ${path.join(report.artifactDirectory, "final-report.json")}\n`);
  if (report.status !== "passed") process.exitCode = 1;
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
