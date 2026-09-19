import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadContract } from "../src/config/contract.js";

const expected = {
  screenshotSha256: "c72ddbab1fc89c9ceb35ab18e864084f603861ba629ec72bd072ea9015173ef4",
  sourceRevision: "66ba190ee5369523195c4012d0a798fbe4d43391",
  assetManifestSha256: "bcb606b7b8cf1a12ed6a26d2471855e4438a22d36a1235b52fb86d48e875efe4",
  viewport: { width: 1934, height: 1094 },
  allowedPaths: ["apps/clone/src", "content/blog"],
  formalRegions: {
    system: { x: 9, y: 44, width: 303, height: 669, maxDifferenceRatio: 0.07 },
    terminal: { x: 331, y: 44, width: 1265, height: 669, maxDifferenceRatio: 0.03 },
    network: { x: 1614, y: 44, width: 311, height: 684, maxDifferenceRatio: 0.07 },
    filesystem: { x: 9, y: 713, width: 834, height: 381, maxDifferenceRatio: 0.035 },
    keyboard: { x: 843, y: 713, width: 1082, height: 381, maxDifferenceRatio: 0.03 }
  },
  perceptualRegionMaximums: {
    system: 0.13,
    terminal: 0.055,
    network: 0.11,
    filesystem: 0.065,
    keyboard: 0.05
  },
  maximumFormalDifferenceRatio: 0.035,
  maximumPerceptualDifferenceRatio: 0.06,
  maximumRepairRegionRegressionRatio: 0.001
} as const;

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertEqual(label: string, actual: unknown, expectedValue: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expectedValue)) {
    throw new Error(`${label} changed\nexpected ${JSON.stringify(expectedValue)}\nactual   ${JSON.stringify(actual)}`);
  }
}

const contract = await loadContract(path.resolve("specs/edex-command-deck.contract.json"));
const provenance = JSON.parse(await readFile(path.resolve("references/edex-ui-v2.2.8/provenance.json"), "utf8")) as {
  screenshotCommit: string;
  screenshotSha256: string;
};
const screenshot = await readFile(path.resolve(contract.targetScreenshotPath!));
const assetManifest = await readFile(path.resolve("apps/clone/upstream-asset-hashes.json"));

assertEqual("Canonical viewport", contract.viewport, expected.viewport);
assertEqual("Canonical source revision", contract.sourceEvidence?.revision, expected.sourceRevision);
assertEqual("Provenance source revision", provenance.screenshotCommit, expected.sourceRevision);
assertEqual("Provenance screenshot hash", provenance.screenshotSha256, expected.screenshotSha256);
assertEqual("Canonical screenshot hash", sha256(screenshot), expected.screenshotSha256);
assertEqual("Upstream asset manifest hash", sha256(assetManifest), expected.assetManifestSha256);
assertEqual("Automated repair roots", [...contract.allowedPaths].sort(), [...expected.allowedPaths].sort());
assertEqual("Canonical formal visual regions", contract.comparisonRegions, expected.formalRegions);

if (contract.maxDifferenceRatio > expected.maximumFormalDifferenceRatio) {
  throw new Error(`Formal visual threshold was loosened to ${contract.maxDifferenceRatio}`);
}
if (!contract.perceptualComparison || contract.perceptualComparison.maxDifferenceRatio > expected.maximumPerceptualDifferenceRatio) {
  throw new Error("Perceptual visual gate is missing or looser than the canonical ceiling");
}
assertEqual(
  "Canonical perceptual region ceilings",
  contract.perceptualComparison.regionMaxDifferenceRatios,
  expected.perceptualRegionMaximums
);
if (!contract.repairComparison || contract.repairComparison.maxRegionRegressionRatio > expected.maximumRepairRegionRegressionRatio) {
  throw new Error("Repair comparison is missing or permits excessive regional regression");
}
assertEqual(
  "Canonical repair region ceilings",
  contract.repairComparison.regionMaxDifferenceRatios,
  expected.perceptualRegionMaximums
);
for (const [name, region] of Object.entries(contract.comparisonRegions ?? {})) {
  if (region.maxDifferenceRatio === undefined) throw new Error(`Formal visual region ${name} has no threshold`);
  if (contract.perceptualComparison.regionMaxDifferenceRatios[name] === undefined) {
    throw new Error(`Perceptual visual region ${name} has no threshold`);
  }
  if (contract.repairComparison.regionMaxDifferenceRatios[name] === undefined) {
    throw new Error(`Repair visual region ${name} has no threshold`);
  }
}

const requiredCommands = ["npm run assets:verify", "npm run check", "npm test", "npm run app:build"];
const actualCommands = contract.validationCommands.map((command) => command.join(" "));
for (const command of requiredCommands) {
  if (!actualCommands.includes(command)) throw new Error(`Automated repair validation is missing: ${command}`);
}

process.stdout.write("Canonical gate policy verified.\n");
