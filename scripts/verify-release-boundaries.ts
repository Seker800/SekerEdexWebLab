import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string): Promise<string> => readFile(path.join(root, relativePath), "utf8");

function requireText(source: string, value: string, label: string): void {
  if (!source.includes(value)) throw new Error(`${label} must contain ${JSON.stringify(value)}.`);
}
function forbidText(source: string, value: string, label: string): void {
  if (source.includes(value)) throw new Error(`${label} must not contain ${JSON.stringify(value)}.`);
}

const [packageSource, siteScript, siteBoundary, client, deployment, siteGuide, contentGuide] = await Promise.all([
  read("package.json"), read("scripts/deploy-site.ts"), read("scripts/release-boundaries.ts"),
  read("apps/clone/src/content/content-api.ts"),
  read("docs/deployment.md"), read("docs/site-deployment.md"), read("docs/content-publishing.md")
]);
const scripts = (JSON.parse(packageSource) as { scripts: Record<string, string> }).scripts;
if (scripts.deploy !== undefined || scripts["publish:content"] !== undefined) throw new Error("Ambiguous or obsolete content deployment entry is forbidden.");
if (scripts["deploy:site"] !== "tsx scripts/deploy-site.ts") throw new Error("Site release must use its canonical entry.");
for (const name of ["content:serve", "content:hash-password", "content-api:build", "content-api:coverage"]) {
  if (scripts[name] !== undefined) throw new Error(`${name} belongs to the independent content-service repository.`);
}
if (scripts["content:integration"] !== "tsx scripts/verify-content-client.ts") throw new Error("Site integration must exercise only the public HTTP contract.");
const serviceDirectories = await readdir(path.join(root, "services")).catch((): string[] => []);
if (serviceDirectories.includes("content-api")) throw new Error("Content service source must live in its independent repository.");

requireText(siteScript, "siteBuildEnvironment", "Site release");
requireText(siteScript, "assertSiteOwnedObjectKey", "Site release");
requireText(siteScript, 'uploadProductionObject("site"', "Site release");
forbidText(siteScript, 'uploadProductionObject("content"', "Site release");
forbidText(siteScript, "loadContentSource", "Site release");
requireText(siteBoundary, '"SEKER_CONTENT_API_ORIGIN"', "Site build boundary");
forbidText(siteBoundary, "...environment", "Site build boundary");
requireText(siteBoundary, 'sanitized.SEKER_CONTENT_DELIVERY = "runtime"', "Site build boundary");
requireText(client, "credentials: \"omit\"", "Public content client");
for (const [document, label] of [[deployment, "Deployment decision"], [siteGuide, "Site guide"], [contentGuide, "Content guide"]] as const) {
  requireText(document, "npm run deploy:site", label);
  requireText(document, "SekerContentApi", label);
  forbidText(document, "npm run publish:content", label);
}
console.log("Verified independent site and content-service repositories.");
