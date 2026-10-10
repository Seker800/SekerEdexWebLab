import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string): Promise<string> => readFile(path.join(root, relativePath), "utf8");

function requireText(source: string, value: string, label: string): void {
  if (!source.includes(value)) throw new Error(`${label} must contain ${JSON.stringify(value)}.`);
}
function forbidText(source: string, value: string, label: string): void {
  if (source.includes(value)) throw new Error(`${label} must not contain ${JSON.stringify(value)}.`);
}

const [packageSource, siteScript, siteBoundary, server, client, deployment, siteGuide, contentGuide] = await Promise.all([
  read("package.json"), read("scripts/deploy-site.ts"), read("scripts/release-boundaries.ts"),
  read("services/content-api/serve.ts"), read("apps/clone/src/content/content-api.ts"),
  read("docs/deployment.md"), read("docs/site-deployment.md"), read("docs/content-publishing.md")
]);
const scripts = (JSON.parse(packageSource) as { scripts: Record<string, string> }).scripts;
if (scripts.deploy !== undefined || scripts["publish:content"] !== undefined) throw new Error("Ambiguous or obsolete content deployment entry is forbidden.");
if (scripts["deploy:site"] !== "tsx scripts/deploy-site.ts") throw new Error("Site release must use its canonical entry.");
if (scripts["content:serve"] !== "node --env-file=services/content-api/.env.local --import tsx services/content-api/serve.ts") throw new Error("Content service must use its canonical entry.");

requireText(siteScript, "siteBuildEnvironment", "Site release");
requireText(siteScript, "assertSiteOwnedObjectKey", "Site release");
requireText(siteScript, 'uploadProductionObject("site"', "Site release");
forbidText(siteScript, 'uploadProductionObject("content"', "Site release");
forbidText(siteScript, "loadContentSource", "Site release");
requireText(siteBoundary, '"SEKER_CONTENT_API_ORIGIN"', "Site build boundary");
forbidText(siteBoundary, "...environment", "Site build boundary");
requireText(siteBoundary, 'sanitized.SEKER_CONTENT_DELIVERY = "runtime"', "Site build boundary");
requireText(server, "CONTENT_DATA_DIR", "Content service");
requireText(server, "CONTENT_ADMIN_PASSWORD_HASH", "Content service");
forbidText(server, "deploy:site", "Content service");
requireText(client, "credentials: \"omit\"", "Public content client");
for (const [document, label] of [[deployment, "Deployment decision"], [siteGuide, "Site guide"], [contentGuide, "Content guide"]] as const) {
  requireText(document, "npm run deploy:site", label);
  requireText(document, "content:serve", label);
  forbidText(document, "npm run publish:content", label);
}
console.log("Verified separate site-code and database-content workflows.");
