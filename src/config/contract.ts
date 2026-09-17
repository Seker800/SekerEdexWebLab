import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const commandSchema = z.array(z.string().min(1)).min(1);
const repositoryRelativePathSchema = z.string().min(1).refine(
  (value) => !path.isAbsolute(value) && !value.split(/[\\/]/).includes(".."),
  { message: "Path must stay inside its declared repository root" }
);

const sourceEvidenceSchema = z.object({
  repositoryUrl: z.string().url(),
  revision: z.string().min(1),
  localPath: repositoryRelativePathSchema,
  guidePath: repositoryRelativePathSchema.optional(),
  entryPaths: z.array(repositoryRelativePathSchema).min(1),
  modules: z.array(z.object({
    name: z.string().min(1),
    entryPaths: z.array(repositoryRelativePathSchema).min(1)
  }).strict()).min(1).optional()
}).strict();

export const scenarioContractSchema = z.object({
  scenarioId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  targetUrl: z.string().url().optional(),
  targetScreenshotPath: z.string().min(1).optional(),
  replicaUrl: z.string().url(),
  viewport: z.object({
    width: z.number().int().min(200).max(7680),
    height: z.number().int().min(200).max(4320)
  }),
  readySelector: z.string().min(1).optional(),
  maxDifferenceRatio: z.number().min(0).max(1),
  maxAttempts: z.number().int().min(1).max(20).default(1),
  allowedPaths: z.array(z.string().min(1)).default([]),
  validationCommands: z.array(commandSchema).default([]),
  sourceEvidence: sourceEvidenceSchema.optional()
}).strict().refine(
  (contract) => Boolean(contract.targetUrl) !== Boolean(contract.targetScreenshotPath),
  { message: "Provide exactly one of targetUrl or targetScreenshotPath" }
);

export type ScenarioContract = z.infer<typeof scenarioContractSchema>;

export async function loadContract(contractPath: string): Promise<ScenarioContract> {
  const absolutePath = path.resolve(contractPath);
  const raw: unknown = JSON.parse(await readFile(absolutePath, "utf8"));
  const contract = scenarioContractSchema.parse(raw);

  for (const allowedPath of contract.allowedPaths) {
    if (path.isAbsolute(allowedPath) || allowedPath.split(/[\\/]/).includes("..")) {
      throw new Error(`allowedPaths must stay inside the repository: ${allowedPath}`);
    }
  }

  return contract;
}
