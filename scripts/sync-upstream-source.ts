import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repository = "https://github.com/GitSquared/edex-ui.git";
const implementationSource = {
  label: "v2.2.8 implementation source",
  revision: "7a9205bf934914407394442f57475d4fefd3213b",
  directory: path.resolve(".cache/upstream/edex-ui-v2.2.8"),
  cloneRef: "v2.2.8"
};
const visualSource = {
  label: "exact screenshot source",
  revision: "66ba190ee5369523195c4012d0a798fbe4d43391",
  directory: path.resolve(".cache/upstream/edex-ui-visual-66ba190")
};
const targetScreenshot = path.resolve("references/edex-ui-v2.2.8/screenshot_default.png");
const targetScreenshotHash = "c72ddbab1fc89c9ceb35ab18e864084f603861ba629ec72bd072ea9015173ef4";

function git(args: string[], cwd = process.cwd()): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `git exited with ${result.status ?? "no status"}`;
    throw new Error(detail);
  }
  return result.stdout.trim();
}

async function ensureImplementationSource(): Promise<void> {
  await mkdir(path.dirname(implementationSource.directory), { recursive: true });
  if (!existsSync(path.join(implementationSource.directory, ".git"))) {
    git(["clone", "--depth", "1", "--branch", implementationSource.cloneRef, repository, implementationSource.directory]);
  }
}

async function ensureVisualSource(): Promise<void> {
  await mkdir(visualSource.directory, { recursive: true });
  if (!existsSync(path.join(visualSource.directory, ".git"))) {
    git(["init"], visualSource.directory);
    git(["remote", "add", "origin", repository], visualSource.directory);
    git(["fetch", "--depth", "1", "origin", visualSource.revision], visualSource.directory);
    git(["checkout", "--detach", "FETCH_HEAD"], visualSource.directory);
  }
}

const requiredPaths = [
  "src/_renderer.js",
  "src/assets/css/main.css",
  "src/assets/css/main_shell.css",
  "src/assets/css/filesystem.css",
  "src/assets/css/keyboard.css",
  "src/assets/kb_layouts/en-US.json",
  "src/assets/themes/tron.json",
  "src/classes/keyboard.class.js",
  "src/classes/filesystem.class.js",
  "src/classes/audiofx.class.js",
  "src/classes/locationGlobe.class.js"
];

function verifyCheckout(label: string, directory: string, revision: string): void {
  const actualCommit = git(["rev-parse", "HEAD"], directory);
  if (actualCommit !== revision) {
    throw new Error(`${label} is ${actualCommit}; expected ${revision}. Remove ${directory} and run the command again.`);
  }
  for (const requiredPath of requiredPaths) {
    if (!existsSync(path.join(directory, requiredPath))) {
      throw new Error(`${label} is incomplete: ${requiredPath}`);
    }
  }
}

await Promise.all([ensureImplementationSource(), ensureVisualSource()]);
verifyCheckout(implementationSource.label, implementationSource.directory, implementationSource.revision);
verifyCheckout(visualSource.label, visualSource.directory, visualSource.revision);

const [upstreamScreenshot, frozenScreenshot] = await Promise.all([
  readFile(path.join(visualSource.directory, "media/screenshot_default.png")),
  readFile(targetScreenshot)
]);
const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const upstreamHash = hash(upstreamScreenshot);
const frozenHash = hash(frozenScreenshot);
if (upstreamHash !== targetScreenshotHash || frozenHash !== targetScreenshotHash) {
  throw new Error(`Target screenshot provenance mismatch: upstream ${upstreamHash}, frozen ${frozenHash}, expected ${targetScreenshotHash}`);
}

process.stdout.write([
  `${visualSource.label} ready at ${visualSource.directory}`,
  `commit ${visualSource.revision}`,
  `${implementationSource.label} ready at ${implementationSource.directory}`,
  `commit ${implementationSource.revision}`,
  `target screenshot verified ${targetScreenshotHash}`
].join("\n") + "\n");
