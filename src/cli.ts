#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { loadContract } from "./config/contract.js";
import { PlaywrightCollector } from "./adapters/browser/playwright-collector.js";
import { CodexRepairAgent } from "./adapters/codex/codex-repair-agent.js";
import { assertCleanRepository, changedPaths, pathsOutsideAllowed } from "./adapters/codex/git-guard.js";
import { runValidationCommands } from "./adapters/process/validation-runner.js";
import { runWorkflow } from "./orchestrator/run-workflow.js";

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] !== "run") {
    throw new Error("Usage: npm run run -- --config <file> [--repair] [--artifacts <directory>]");
  }
  const configPath = valueAfter(args, "--config");
  if (!configPath) throw new Error("Missing --config <file>");

  const repositoryRoot = process.cwd();
  const contract = await loadContract(configPath);
  const artifactRoot = path.resolve(valueAfter(args, "--artifacts") ?? "artifacts/runs");
  await mkdir(artifactRoot, { recursive: true });
  const liveRepair = args.includes("--repair");
  let repairAgent;
  let afterRepair: (() => Promise<void>) | undefined;

  if (liveRepair) {
    if (contract.allowedPaths.length === 0) throw new Error("Live repair requires at least one allowedPaths entry");
    await assertCleanRepository(repositoryRoot);
    const codexOutput = path.join(artifactRoot, "codex-last-result.json");
    repairAgent = new CodexRepairAgent(
      repositoryRoot,
      path.join(repositoryRoot, "schemas/codex-repair-result.schema.json"),
      codexOutput
    );
    afterRepair = async () => {
      const changed = await changedPaths(repositoryRoot);
      const outside = pathsOutsideAllowed(changed, contract.allowedPaths);
      if (outside.length > 0) throw new Error(`Codex changed paths outside allowedPaths: ${outside.join(", ")}`);
      await runValidationCommands(contract.validationCommands, repositoryRoot);
    };
  }

  const report = await runWorkflow({
    contract,
    artifactRoot,
    collector: new PlaywrightCollector(),
    ...(repairAgent ? { repairAgent } : {}),
    ...(afterRepair ? { afterRepair } : {})
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === "passed" ? 0 : report.status === "failed" ? 1 : 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 2;
});
