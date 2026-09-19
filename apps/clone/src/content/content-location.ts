import { normalizeContentPath } from "./content-model.js";

const prefix = "#/blog/";

export function contentHash(relativePath: string): string {
  const normalized = normalizeContentPath(relativePath, { allowRoot: true });
  return `${prefix}${normalized.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`;
}

export function parseContentHash(hash: string): string | undefined {
  if (!hash.startsWith(prefix)) return undefined;
  const encoded = hash.slice(prefix.length);
  if (encoded === "") return "";
  try {
    const decoded = encoded.split("/").map((segment) => decodeURIComponent(segment));
    if (decoded.some((segment) => segment.includes("/") || segment.includes("\\"))) return undefined;
    return normalizeContentPath(decoded.join("/"));
  } catch {
    return undefined;
  }
}
