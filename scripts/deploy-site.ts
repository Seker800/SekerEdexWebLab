import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { contentObjectPrefix, assertSiteOwnedObjectKey, createSiteFileIndex, parseSiteFileIndex, siteBuildEnvironment, siteFileIndexObjectKey } from "./release-boundaries.js";
import { productionOrigin, refreshProductionCdn, removeProductionObject, requireProductionReleaseTools, runCommand, uploadProductionObject } from "./production-release-target.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

async function requireCommittedMain(): Promise<string> {
  await runCommand("git", ["fetch", "origin", "main", "--quiet"], repositoryRoot);
  const branch = (await runCommand("git", ["branch", "--show-current"], repositoryRoot)).trim();
  const revision = (await runCommand("git", ["rev-parse", "HEAD"], repositoryRoot)).trim();
  const remoteRevision = (await runCommand("git", ["rev-parse", "origin/main"], repositoryRoot)).trim();
  if (branch !== "main") throw new Error(`Site deployment must run from main; current branch is ${branch || "detached"}.`);
  if (revision !== remoteRevision) throw new Error("Push the current main revision before deploying the site.");
  return revision;
}

async function collectFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Site deployment output must not contain symbolic links.");
    if (entry.isDirectory()) files.push(...await collectFiles(root, absolutePath));
    else if (entry.isFile()) files.push(path.relative(root, absolutePath).split(path.sep).join("/"));
  }
  return files;
}

async function verifyPublicSiteRevision(revision: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const response = await fetch(`${productionOrigin}/deployment.json?revision=${revision}`, { cache: "no-store" });
      const deployment = response.ok ? await response.json() as { schemaVersion?: number; site?: { revision?: string } } : undefined;
      if (deployment?.schemaVersion === 2 && deployment.site?.revision === revision) return;
    } catch {
      // CDN refreshes are eventually consistent; retry only this bounded public read.
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("The public site did not expose the expected site revision after the CDN refresh.");
}

async function readPreviousSiteFiles(): Promise<readonly string[]> {
  const response = await fetch(`${productionOrigin}/${siteFileIndexObjectKey}`, { cache: "no-store" });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Previous site file index request failed with ${response.status}.`);
  return parseSiteFileIndex(await response.json());
}

async function removeStaleSiteObjects(previous: readonly string[], expected: ReadonlySet<string>): Promise<void> {
  for (const key of previous.filter((file) => !expected.has(file))) {
    assertSiteOwnedObjectKey(key);
    await removeProductionObject("site", key, repositoryRoot);
  }
}

async function deploySite(): Promise<void> {
  const [revision, previousSiteFiles] = await Promise.all([requireCommittedMain(), readPreviousSiteFiles()]);
  await requireProductionReleaseTools();
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seker-edex-site-"));
  const worktree = path.join(temporaryRoot, "source");
  try {
    console.log("Preparing a content-free production site build...");
    await runCommand("git", ["worktree", "add", "--detach", worktree, revision], repositoryRoot);
    await runCommand("npm", ["ci"], worktree);
    const buildEnvironment = siteBuildEnvironment(process.env);
    await runCommand("npm", ["run", "release:verify"], worktree, buildEnvironment);
    await runCommand("npm", ["run", "check"], worktree, buildEnvironment);
    await runCommand("npm", ["test"], worktree, buildEnvironment);
    await runCommand("npm", ["run", "build"], worktree, buildEnvironment);

    const buildRoot = path.join(worktree, "dist", "clone");
    await writeFile(path.join(buildRoot, "deployment.json"), `${JSON.stringify({
      schemaVersion: 2,
      site: { revision }
    })}\n`);
    const files = [...await collectFiles(buildRoot), siteFileIndexObjectKey].sort();
    await writeFile(path.join(buildRoot, siteFileIndexObjectKey), `${JSON.stringify(createSiteFileIndex(files))}\n`);
    for (const file of files) assertSiteOwnedObjectKey(file);
    const ordinaryFiles = files.filter((file) => file !== "index.html" && file !== "deployment.json" && file !== siteFileIndexObjectKey);

    console.log(`Uploading ${files.length} site-owned files without author content...`);
    for (const file of ordinaryFiles) {
      const immutable = file.startsWith("assets/");
      await uploadProductionObject("site", path.join(buildRoot, ...file.split("/")), file, immutable ? "public,max-age=31536000,immutable" : "public,max-age=300", repositoryRoot);
    }
    await uploadProductionObject("site", path.join(buildRoot, "index.html"), "index.html", "no-cache", repositoryRoot);
    await uploadProductionObject("site", path.join(buildRoot, siteFileIndexObjectKey), siteFileIndexObjectKey, "no-store", repositoryRoot);
    await uploadProductionObject("site", path.join(buildRoot, "deployment.json"), "deployment.json", "no-store", repositoryRoot);
    await refreshProductionCdn(`${productionOrigin}/`, "Directory", repositoryRoot);
    await verifyPublicSiteRevision(revision);
    await removeStaleSiteObjects(previousSiteFiles, new Set(files));
    await refreshProductionCdn(`${productionOrigin}/`, "Directory", repositoryRoot);
    console.log(`Published site revision ${revision.slice(0, 12)} without changing ${contentObjectPrefix}.`);
  } finally {
    await runCommand("git", ["worktree", "remove", "--force", worktree], repositoryRoot).catch(() => undefined);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

await deploySite();
