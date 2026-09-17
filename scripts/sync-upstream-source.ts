import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repository = "https://github.com/GitSquared/edex-ui.git";
const tag = "v2.2.8";
const commit = "7a9205bf934914407394442f57475d4fefd3213b";
const sourceDirectory = path.resolve(".cache/upstream/edex-ui-v2.2.8");

function git(args: string[], cwd = process.cwd()): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `git exited with ${result.status ?? "no status"}`;
    throw new Error(detail);
  }
  return result.stdout.trim();
}

await mkdir(path.dirname(sourceDirectory), { recursive: true });
if (!existsSync(path.join(sourceDirectory, ".git"))) {
  git(["clone", "--depth", "1", "--branch", tag, repository, sourceDirectory]);
}

const actualCommit = git(["rev-parse", "HEAD"], sourceDirectory);
if (actualCommit !== commit) {
  throw new Error(`Cached eDEX-UI source is ${actualCommit}; expected ${commit}. Remove ${sourceDirectory} and run the command again.`);
}

const requiredPaths = [
  "src/_renderer.js",
  "src/assets/css/main.css",
  "src/assets/css/main_shell.css",
  "src/assets/css/filesystem.css",
  "src/assets/css/keyboard.css",
  "src/assets/themes/tron.json",
  "src/classes/keyboard.class.js",
  "src/classes/filesystem.class.js",
  "src/classes/audiofx.class.js",
  "src/classes/locationGlobe.class.js"
];
for (const requiredPath of requiredPaths) {
  if (!existsSync(path.join(sourceDirectory, requiredPath))) {
    throw new Error(`Frozen upstream source is incomplete: ${requiredPath}`);
  }
}

process.stdout.write(`eDEX-UI ${tag} source ready at ${sourceDirectory}\ncommit ${actualCommit}\n`);
