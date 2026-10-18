import { isIP } from "node:net";
import { resolveSiteConfiguration } from "../apps/clone/site-configuration.js";

export const contentObjectPrefix = "content/";
export const siteFileIndexObjectKey = "site-files.json";

function assertObjectKey(objectKey: string): void {
  if (objectKey.startsWith("/") || objectKey.includes("\\") || objectKey.includes("\0")
    || objectKey.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Unsafe release object key: ${objectKey}`);
  }
}

export function assertSiteOwnedObjectKey(objectKey: string): void {
  assertObjectKey(objectKey);
  if (objectKey.startsWith(contentObjectPrefix)) throw new Error(`Site release cannot write content-owned object: ${objectKey}`);
}

export function siteBuildEnvironment(environment: NodeJS.ProcessEnv, configuration?: unknown): NodeJS.ProcessEnv {
  const configured = configuration === undefined ? undefined : resolveSiteConfiguration(configuration);
  const permitted = ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "CI", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "NPM_CONFIG_CACHE"];
  const sanitized: NodeJS.ProcessEnv = {};
  for (const key of permitted) if (environment[key] !== undefined) sanitized[key] = environment[key];
  if (configured?.delivery === "embedded") {
    sanitized.SEKER_CONTENT_DELIVERY = "embedded";
    return sanitized;
  }
  const configuredOrigin = configured?.apiOrigin ?? environment.SEKER_CONTENT_API_ORIGIN?.trim();
  if (!configuredOrigin) throw new Error("Content API origin (SEKER_CONTENT_API_ORIGIN) is required for the site build");
  let apiOrigin: URL;
  try { apiOrigin = new URL(configuredOrigin); }
  catch { throw new Error("Site content API origin must be a public HTTPS domain"); }
  if (apiOrigin.protocol !== "https:" || apiOrigin.username || apiOrigin.password || apiOrigin.pathname !== "/" || apiOrigin.search || apiOrigin.hash || isIP(apiOrigin.hostname) !== 0 || !apiOrigin.hostname.includes(".") || apiOrigin.hostname.endsWith(".local") || apiOrigin.hostname.endsWith(".localhost")) {
    throw new Error("Site content API origin must be a public HTTPS domain without path or credentials");
  }
  sanitized["SEKER_CONTENT_API_ORIGIN"] = apiOrigin.origin;
  sanitized.SEKER_CONTENT_DELIVERY = "runtime";
  return sanitized;
}

export function createSiteFileIndex(files: readonly string[]): { schemaVersion: 1; files: readonly string[] } {
  const unique = [...new Set(files)].sort();
  for (const file of unique) assertSiteOwnedObjectKey(file);
  return Object.freeze({ schemaVersion: 1, files: Object.freeze(unique) });
}

export function parseSiteFileIndex(value: unknown): readonly string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Site file index must be an object.");
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.files)
    || Object.keys(candidate).sort().join(",") !== "files,schemaVersion") {
    throw new Error("Site file index has an invalid schema.");
  }
  if (candidate.files.some((file) => typeof file !== "string")) throw new Error("Site file index contains an invalid path.");
  return createSiteFileIndex(candidate.files as string[]).files;
}
