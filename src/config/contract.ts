import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const commandSchema = z.array(z.string().min(1)).min(1);
const repositoryRelativePathSchema = z.string().min(1).refine(
  (value) => value !== "." && !path.isAbsolute(value) && !value.split(/[\\/]/).includes(".."),
  { message: "Path must stay inside its declared repository root" }
);

const protectedRepairPaths = [
  ".git",
  ".cache",
  "artifacts",
  "references",
  "schemas",
  "specs",
  "src/adapters/codex",
  "src/config",
  "src/judge",
  "src/orchestrator",
  "apps/clone/public",
  "apps/clone/upstream-asset-hashes.json",
  "apps/clone/licenses",
  "apps/clone/UPSTREAM_ASSETS.md",
  "apps/clone/UPSTREAM_LICENSE",
  "LICENSE",
  "NOTICE.md"
] as const;

function pathsOverlap(left: string, right: string): boolean {
  const normalize = (value: string): string => path.normalize(value.replaceAll("\\", path.sep)).replace(/[/\\]+$/, "");
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft === normalizedRight
    || normalizedLeft.startsWith(`${normalizedRight}${path.sep}`)
    || normalizedRight.startsWith(`${normalizedLeft}${path.sep}`);
}

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

const screenshotRegionSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  maxDifferenceRatio: z.number().min(0).max(1).optional()
}).strict();

const comparisonProfileSchema = z.object({
  maxDifferenceRatio: z.number().min(0).max(1),
  comparisonOptions: z.object({
    threshold: z.number().min(0).max(1),
    includeAA: z.boolean()
  }).strict(),
  regionMaxDifferenceRatios: z.record(z.string().min(1), z.number().min(0).max(1)).default({}),
  maxRegionRegressionRatio: z.number().min(0).max(1).default(0)
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
  comparisonOptions: z.object({
    threshold: z.number().min(0).max(1),
    includeAA: z.boolean()
  }).strict().optional(),
  comparisonRegions: z.record(z.string().min(1), screenshotRegionSchema).optional(),
  perceptualComparison: comparisonProfileSchema.optional(),
  repairComparison: comparisonProfileSchema.optional(),
  maxRegionRegressionRatio: z.number().min(0).max(1).optional(),
  maxAttempts: z.number().int().min(1).max(20).default(1),
  allowedPaths: z.array(repositoryRelativePathSchema).default([]),
  validationCommands: z.array(commandSchema).default([]),
  sourceEvidence: sourceEvidenceSchema.optional()
}).strict().superRefine((contract, context) => {
  if (Boolean(contract.targetUrl) === Boolean(contract.targetScreenshotPath)) {
    context.addIssue({ code: "custom", message: "Provide exactly one of targetUrl or targetScreenshotPath" });
  }
  for (const allowedPath of contract.allowedPaths) {
    const protectedPath = protectedRepairPaths.find((entry) => pathsOverlap(allowedPath, entry));
    if (protectedPath) {
      context.addIssue({
        code: "custom",
        path: ["allowedPaths"],
        message: `Repair path ${allowedPath} overlaps protected path ${protectedPath}`
      });
    }
  }
  for (const [profileName, profile] of [
    ["perceptualComparison", contract.perceptualComparison],
    ["repairComparison", contract.repairComparison]
  ] as const) {
    for (const regionName of Object.keys(profile?.regionMaxDifferenceRatios ?? {})) {
      if (!contract.comparisonRegions?.[regionName]) {
        context.addIssue({
          code: "custom",
          path: [profileName, "regionMaxDifferenceRatios", regionName],
          message: `Comparison profile references unknown region ${regionName}`
        });
      }
    }
  }
});

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
