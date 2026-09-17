import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const cloneRoot = path.resolve("apps/clone");
const publicRoot = path.join(cloneRoot, "public");
const manifestPath = path.join(cloneRoot, "upstream-asset-hashes.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, string>;

for (const [relativePath, expectedHash] of Object.entries(manifest)) {
  const bytes = await readFile(path.join(publicRoot, relativePath));
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`Upstream asset changed: ${relativePath}\nexpected ${expectedHash}\nactual   ${actualHash}`);
  }
}

process.stdout.write(`Verified ${Object.keys(manifest).length} frozen upstream assets.\n`);
