export const contentObjectPrefix = "content/";
export const contentPointerObjectKey = `${contentObjectPrefix}current.json`;
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

export function assertContentOwnedObjectKey(objectKey: string): void {
  assertObjectKey(objectKey);
  if (!objectKey.startsWith(contentObjectPrefix)) throw new Error(`Content release cannot write site-owned object: ${objectKey}`);
}

export function siteBuildEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sanitized = { ...environment };
  delete sanitized.SEKER_CONTENT_ROOT;
  delete sanitized.SEKER_CONTENT_PROFILE;
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
