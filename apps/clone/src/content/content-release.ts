import { buildContentTree } from "./content-tree.js";
import { normalizeContentPath, type ContentDocument, type ContentEntry, type ContentManifest, type ContentMedia, type ContentReleasePointer, type ContentSourceDescriptor, type PublishedContentManifest } from "./content-model.js";

const digestPattern = /^[a-f\d]{64}$/u;
const sourceIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const publishedMediaTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/svg+xml", "image/webp"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has unexpected fields.`);
  }
}

function parseSourceDescriptor(value: unknown): ContentSourceDescriptor {
  const source = record(value, "Content source");
  exactKeys(source, ["schemaVersion", "id", "kind", "visibility", "defaultLicense"], "Content source");
  if (source.schemaVersion !== 1 || source.kind !== "author" || source.visibility !== "public") {
    throw new Error("Published content must declare a public author source with schemaVersion 1.");
  }
  const id = string(source.id, "Content source id");
  if (!sourceIdPattern.test(id)) throw new Error("Content source id is invalid.");
  return Object.freeze({
    schemaVersion: 1,
    id,
    kind: "author",
    visibility: "public",
    defaultLicense: string(source.defaultLicense, "Content source license")
  });
}

export function contentReleaseRoot(digest: string): string {
  if (!digestPattern.test(digest)) throw new Error("Content digest is invalid.");
  return `content/releases/${digest}`;
}

export function contentReleaseManifestPath(digest: string): string {
  return `/${contentReleaseRoot(digest)}/manifest.json`;
}

export function contentReleaseMediaPath(digest: string, relativePath: string): string {
  const normalized = normalizeContentPath(relativePath);
  const encoded = normalized.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `/${contentReleaseRoot(digest)}/media/${encoded}`;
}

export function createContentReleasePointer(source: ContentSourceDescriptor, digest: string): ContentReleasePointer {
  if (source.kind !== "author") throw new Error("Only author content can be published.");
  return Object.freeze({ schemaVersion: 1, source, digest, manifestPath: contentReleaseManifestPath(digest) });
}

export function parseContentReleasePointer(value: unknown): ContentReleasePointer {
  const pointer = record(value, "Content release pointer");
  exactKeys(pointer, ["schemaVersion", "source", "digest", "manifestPath"], "Content release pointer");
  if (pointer.schemaVersion !== 1) throw new Error("Unsupported content release pointer schema.");
  const digest = string(pointer.digest, "Content digest");
  if (!digestPattern.test(digest)) throw new Error("Content digest is invalid.");
  const manifestPath = string(pointer.manifestPath, "Content manifest path");
  if (manifestPath !== contentReleaseManifestPath(digest)) throw new Error("Content manifest path does not match its digest.");
  return Object.freeze({ schemaVersion: 1, source: parseSourceDescriptor(pointer.source), digest, manifestPath });
}

function parseDocument(value: Record<string, unknown>): ContentDocument {
  exactKeys(value, ["kind", "relativePath", "title", "summary", "publishedAt", "tags", "markdown"], "Content document");
  if (value.kind !== "document") throw new Error("Content document kind is invalid.");
  if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== "string" || tag.length === 0)) {
    throw new Error("Content document tags are invalid.");
  }
  const publishedAt = string(value.publishedAt, "Content publication date");
  const timestamp = /^\d{4}-\d{2}-\d{2}$/u.test(publishedAt) ? Date.parse(`${publishedAt}T00:00:00.000Z`) : Number.NaN;
  const normalizedDate = Number.isNaN(timestamp) ? "" : new Date(timestamp).toISOString().slice(0, 10);
  if (normalizedDate !== publishedAt) throw new Error("Content publication date is invalid.");
  if (typeof value.markdown !== "string") throw new Error("Content document Markdown is invalid.");
  return Object.freeze({
    kind: "document",
    relativePath: normalizeContentPath(string(value.relativePath, "Content document path")),
    title: string(value.title, "Content document title"),
    summary: string(value.summary, "Content document summary"),
    publishedAt,
    tags: Object.freeze([...value.tags] as string[]),
    markdown: value.markdown
  });
}

function parseMedia(value: Record<string, unknown>, digest: string): ContentMedia {
  exactKeys(value, ["kind", "relativePath", "url", "mediaType", "alt"], "Content media");
  if (value.kind !== "media") throw new Error("Content media kind is invalid.");
  const relativePath = normalizeContentPath(string(value.relativePath, "Content media path"));
  const url = string(value.url, "Content media URL");
  if (url !== contentReleaseMediaPath(digest, relativePath)) throw new Error("Content media URL escapes its immutable release.");
  const mediaType = string(value.mediaType, "Content media type");
  if (!publishedMediaTypes.has(mediaType)) throw new Error("Content media type is invalid.");
  return Object.freeze({
    kind: "media",
    relativePath,
    url,
    mediaType,
    alt: string(value.alt, "Content media alt text")
  });
}

export function parsePublishedContentManifest(value: unknown, pointer: ContentReleasePointer): PublishedContentManifest {
  const manifest = record(value, "Published content manifest");
  exactKeys(manifest, ["schemaVersion", "source", "digest", "entries"], "Published content manifest");
  if (manifest.schemaVersion !== 1 || manifest.digest !== pointer.digest) throw new Error("Published content manifest version does not match its pointer.");
  const source = parseSourceDescriptor(manifest.source);
  if (JSON.stringify(source) !== JSON.stringify(pointer.source)) throw new Error("Published content source does not match its pointer.");
  if (!Array.isArray(manifest.entries)) throw new Error("Published content entries must be an array.");
  const entries: ContentEntry[] = manifest.entries.map((entry) => {
    const item = record(entry, "Content entry");
    if (item.kind === "document") return parseDocument(item);
    if (item.kind === "media") return parseMedia(item, pointer.digest);
    throw new Error("Content entry kind is invalid.");
  });
  buildContentTree(entries);
  return Object.freeze({ schemaVersion: 1, source, digest: pointer.digest, entries: Object.freeze(entries) });
}

export async function fetchPublishedContent(fetcher: typeof fetch = fetch): Promise<{ source: ContentSourceDescriptor; manifest: ContentManifest; digest: string }> {
  const pointerResponse = await fetcher("/content/current.json", { cache: "no-store" });
  if (!pointerResponse.ok) throw new Error(`Content pointer request failed with ${pointerResponse.status}.`);
  const pointer = parseContentReleasePointer(await pointerResponse.json());
  const manifestResponse = await fetcher(pointer.manifestPath, { cache: "force-cache" });
  if (!manifestResponse.ok) throw new Error(`Content manifest request failed with ${manifestResponse.status}.`);
  const published = parsePublishedContentManifest(await manifestResponse.json(), pointer);
  return Object.freeze({ source: published.source, manifest: Object.freeze({ entries: published.entries }), digest: published.digest });
}
