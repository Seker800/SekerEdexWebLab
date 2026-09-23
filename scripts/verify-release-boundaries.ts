import { readFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

async function read(relativePath: string): Promise<string> {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function requireText(source: string, expected: string, label: string): void {
  if (!source.includes(expected)) throw new Error(`${label} must contain ${JSON.stringify(expected)}.`);
}

function forbidText(source: string, forbidden: string, label: string): void {
  if (source.includes(forbidden)) throw new Error(`${label} must not contain ${JSON.stringify(forbidden)}.`);
}

const [packageSource, siteScript, contentScript, deploymentIndex, siteGuide, contentGuide] = await Promise.all([
  read("package.json"),
  read("scripts/deploy-site.ts"),
  read("scripts/publish-content.ts"),
  read("docs/deployment.md"),
  read("docs/site-deployment.md"),
  read("docs/content-publishing.md")
]);
const packageJson = JSON.parse(packageSource) as { scripts?: Record<string, string> };
const scripts = packageJson.scripts ?? {};

if (scripts.deploy !== undefined) throw new Error("The ambiguous npm run deploy entry is forbidden; choose deploy:site or publish:content.");
if (scripts["deploy:site"] !== "tsx scripts/deploy-site.ts") throw new Error("deploy:site must use the canonical site release entry.");
if (scripts["publish:content"] !== "tsx scripts/publish-content.ts") throw new Error("publish:content must use the canonical content release entry.");

requireText(siteScript, "siteBuildEnvironment", "Site release");
requireText(siteScript, "assertSiteOwnedObjectKey", "Site release");
requireText(siteScript, 'uploadProductionObject("site"', "Site release");
forbidText(siteScript, 'uploadProductionObject("content"', "Site release");
forbidText(siteScript, "loadContentSource", "Site release");
forbidText(siteScript, "createContentReleaseBundle", "Site release");
forbidText(siteScript, "contentPointerObjectKey", "Site release");

requireText(contentScript, "createContentReleaseBundle", "Content release");
requireText(contentScript, "assertContentOwnedObjectKey", "Content release");
requireText(contentScript, 'uploadProductionObject("content"', "Content release");
forbidText(contentScript, 'uploadProductionObject("site"', "Content release");
forbidText(contentScript, "git\", [\"worktree", "Content release");
forbidText(contentScript, "deployment.json", "Content release");

for (const [source, label] of [[deploymentIndex, "Deployment decision gate"], [siteGuide, "Site guide"], [contentGuide, "Content guide"]] as const) {
  requireText(source, "npm run deploy:site", label);
  requireText(source, "npm run publish:content", label);
  requireText(source, "不得", label);
}

console.log("Verified independent site and content release boundaries.");
