export interface ContentDocument {
  readonly kind: "document";
  readonly relativePath: string;
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;
  readonly tags: readonly string[];
  readonly markdown: string;
}

export interface ContentMedia {
  readonly kind: "media";
  readonly relativePath: string;
  readonly url: string;
  readonly mediaType: string;
  readonly alt: string;
}

export type ContentEntry = ContentDocument | ContentMedia;

export interface ContentManifest {
  readonly entries: readonly ContentEntry[];
}

export function normalizeContentPath(value: string, options: { allowRoot?: boolean } = {}): string {
  if (value.includes("\\") || value.includes("\0") || value.startsWith("/")) {
    throw new Error(`Invalid content path: ${value}`);
  }
  if (value === "" && options.allowRoot) return "";
  const segments = value.split("/");
  if (segments.length === 0 || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Invalid content path: ${value}`);
  }
  return segments.join("/");
}

export function contentBasename(relativePath: string): string {
  return relativePath.split("/").at(-1)!;
}

export function contentDirname(relativePath: string): string {
  const segments = relativePath.split("/");
  segments.pop();
  return segments.join("/");
}
