import { execFile as execFileCallback } from "node:child_process";
import { lstat, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { loadEnv } from "vite";

const execFile = promisify(execFileCallback);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const bucket = "seker-edex-web";
const region = "cn-beijing";
const publicOrigin = "https://www.seker.wang";
const aliyunProfile = "seker-edex-local";
const aliyunExecutable = path.join(homedir(), ".local", "bin", "aliyun");

async function run(command: string, args: string[], cwd = repositoryRoot, environment?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout, stderr } = await execFile(command, args, {
    cwd,
    env: environment ?? process.env,
    maxBuffer: 20 * 1024 * 1024
  });
  if (stderr.trim()) process.stderr.write(stderr);
  return stdout;
}

async function requireCommittedMain(): Promise<string> {
  await run("git", ["fetch", "origin", "main", "--quiet"]);
  const branch = (await run("git", ["branch", "--show-current"])).trim();
  const revision = (await run("git", ["rev-parse", "HEAD"])).trim();
  const remoteRevision = (await run("git", ["rev-parse", "origin/main"])).trim();
  if (branch !== "main") throw new Error(`Production deployment must run from main; current branch is ${branch || "detached"}.`);
  if (revision !== remoteRevision) throw new Error("Push the current main revision before deploying it.");
  return revision;
}

function resolvePrivateContentRoot(): string {
  const environment = loadEnv("production", repositoryRoot, "");
  const configuredRoot = environment.SEKER_CONTENT_ROOT?.trim();
  if (!configuredRoot) throw new Error("Set SEKER_CONTENT_ROOT in .env.local before deploying.");
  const contentRoot = path.resolve(repositoryRoot, configuredRoot);
  const relative = path.relative(repositoryRoot, contentRoot);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..")) {
    throw new Error("Production content must live outside the public repository.");
  }
  return contentRoot;
}

async function collectFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Deployment output must not contain symbolic links.");
    if (entry.isDirectory()) files.push(...await collectFiles(root, absolutePath));
    else if (entry.isFile()) files.push(path.relative(root, absolutePath).split(path.sep).join("/"));
  }
  return files;
}

async function uploadFile(buildRoot: string, relativePath: string, cacheControl: string): Promise<void> {
  await run(aliyunExecutable, [
    "oss", "cp", path.join(buildRoot, ...relativePath.split("/")), `oss://${bucket}/${relativePath}`,
    "--profile", aliyunProfile,
    "--region", region,
    "--force",
    "--yes",
    "--cli-non-interactive",
    "--meta", `Cache-Control:${cacheControl}`
  ]);
}

async function listRemoteObjects(): Promise<string[]> {
  const output = await run(aliyunExecutable, [
    "oss", "ls", `oss://${bucket}/`,
    "--profile", aliyunProfile,
    "--region", region,
    "--cli-output", "json",
    "--limited-num", "1000"
  ]);
  const result = JSON.parse(output) as { complete?: boolean; items?: Array<{ kind?: string; key?: string }> };
  if (result.complete !== true) throw new Error("The OSS object listing exceeded the deployment safety bound.");
  return (result.items ?? []).filter((item) => item.kind === "object" && item.key).map((item) => item.key as string);
}

async function removeStaleObjects(expected: Set<string>): Promise<void> {
  const staleObjects = (await listRemoteObjects()).filter((key) => !expected.has(key));
  for (const key of staleObjects) {
    await run(aliyunExecutable, [
      "oss", "rm", `oss://${bucket}/${key}`,
      "--profile", aliyunProfile,
      "--region", region,
      "--force",
      "--yes",
      "--cli-non-interactive"
    ]);
  }
}

async function verifyPublicRevision(revision: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const response = await fetch(`${publicOrigin}/deployment.json?revision=${revision}`, { cache: "no-store" });
      if (response.ok && (await response.json() as { revision?: string }).revision === revision) return;
    } catch {
      // CDN refreshes are eventually consistent; retry only this bounded public read.
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("The public site did not expose the expected revision after the CDN refresh.");
}

async function deploy(): Promise<void> {
  const [revision, contentRoot] = await Promise.all([requireCommittedMain(), Promise.resolve(resolvePrivateContentRoot())]);
  if (!(await lstat(contentRoot)).isDirectory()) throw new Error("SEKER_CONTENT_ROOT must point to a directory.");
  await lstat(aliyunExecutable);

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seker-edex-deploy-"));
  const worktree = path.join(temporaryRoot, "source");
  try {
    console.log("Preparing a clean production build...");
    await run("git", ["worktree", "add", "--detach", worktree, revision]);
    await run("npm", ["ci"], worktree);
    const buildEnvironment = { ...process.env, SEKER_CONTENT_ROOT: contentRoot };
    await run("npm", ["run", "check"], worktree, buildEnvironment);
    await run("npm", ["test"], worktree, buildEnvironment);
    await run("npm", ["run", "build"], worktree, buildEnvironment);

    const buildRoot = path.join(worktree, "dist", "clone");
    const deploymentFile = path.join(buildRoot, "deployment.json");
    await writeFile(deploymentFile, `${JSON.stringify({ revision })}\n`);
    const files = await collectFiles(buildRoot);
    const ordinaryFiles = files.filter((file) => file !== "index.html" && file !== "deployment.json");

    console.log(`Uploading ${files.length} production files...`);
    for (const file of ordinaryFiles) {
      const immutable = file.startsWith("assets/");
      await uploadFile(buildRoot, file, immutable ? "public,max-age=31536000,immutable" : "public,max-age=300");
    }
    await uploadFile(buildRoot, "index.html", "no-cache");
    await uploadFile(buildRoot, "deployment.json", "no-store");

    await run(aliyunExecutable, [
      "cdn", "RefreshObjectCaches",
      "--profile", aliyunProfile,
      "--region", region,
      "--ObjectPath", `${publicOrigin}/`,
      "--ObjectType", "Directory"
    ]);
    await verifyPublicRevision(revision);
    await removeStaleObjects(new Set(files));
    await run(aliyunExecutable, [
      "cdn", "RefreshObjectCaches",
      "--profile", aliyunProfile,
      "--region", region,
      "--ObjectPath", `${publicOrigin}/`,
      "--ObjectType", "Directory"
    ]);
    console.log(`Published ${revision.slice(0, 12)} to ${publicOrigin}.`);
  } finally {
    await run("git", ["worktree", "remove", "--force", worktree]).catch(() => undefined);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

await deploy();
