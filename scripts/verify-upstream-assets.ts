import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const cloneRoot = path.resolve("apps/clone");
const publicRoot = path.join(cloneRoot, "public");
const manifestPath = path.join(cloneRoot, "upstream-asset-hashes.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, string>;
const provenancePath = path.resolve("references/edex-ui-v2.2.8/provenance.json");
const provenance = JSON.parse(await readFile(provenancePath, "utf8")) as { screenshotSha256: string };

for (const [relativePath, expectedHash] of Object.entries(manifest)) {
  const bytes = await readFile(path.join(publicRoot, relativePath));
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`Upstream asset changed: ${relativePath}\nexpected ${expectedHash}\nactual   ${actualHash}`);
  }
}

const targetScreenshotPath = path.resolve("references/edex-ui-v2.2.8/screenshot_default.png");
const targetScreenshotHash = createHash("sha256").update(await readFile(targetScreenshotPath)).digest("hex");
if (targetScreenshotHash !== provenance.screenshotSha256) {
  throw new Error(`Frozen target screenshot changed\nexpected ${provenance.screenshotSha256}\nactual   ${targetScreenshotHash}`);
}

process.stdout.write(`Verified ${Object.keys(manifest).length} frozen upstream assets and target screenshot provenance.\n`);
