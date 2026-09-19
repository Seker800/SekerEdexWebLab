import { z } from "zod";
import { parse as parseYaml } from "yaml";
import MarkdownIt, { type Token } from "markdown-it";
import { contentBasename, normalizeContentPath, type ContentDocument, type ContentEntry, type ContentManifest, type ContentMedia } from "./content-model.js";
import { buildContentTree, resolveContentReference, type ContentTree } from "./content-tree.js";

const legacyTags = z.string().transform((value) => value.split(",").map((tag) => tag.trim()).filter(Boolean));
const frontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  publishedAt: z.iso.date(),
  tags: z.union([z.array(z.string().min(1)), legacyTags])
}).strict();

const mediaTypes = new Map<string, string>([
  ["avif", "image/avif"],
  ["gif", "image/gif"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["webp", "image/webp"]
]);
export const supportedContentMediaExtensions = Object.freeze([...mediaTypes.keys()]);
const markdownParser = new MarkdownIt({ html: false, linkify: true });

export interface ContentSources {
  readonly markdownSources: Readonly<Record<string, string>>;
  readonly mediaSources: Readonly<Record<string, string>>;
}

function sourceRelativePath(sourcePath: string): string {
  const normalizedSource = sourcePath.replaceAll("\\", "/");
  const marker = "/content/blog/";
  const markerIndex = normalizedSource.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Invalid content path outside content/blog: ${sourcePath}`);
  return normalizeContentPath(normalizedSource.slice(markerIndex + marker.length));
}

function parseDocument(sourcePath: string, source: string): ContentDocument {
  const normalized = source.replaceAll("\r\n", "\n");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(normalized);
  if (!match) throw new Error(`Blog document is missing frontmatter: ${sourcePath}`);
  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]!);
  } catch (error) {
    throw new Error(`Invalid YAML frontmatter in ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const metadata = frontmatterSchema.parse(parsed);
  return {
    kind: "document",
    relativePath: sourceRelativePath(sourcePath),
    ...metadata,
    tags: Object.freeze([...metadata.tags]),
    markdown: match[2]!.trim()
  };
}

function humanizeFilename(relativePath: string): string {
  const name = contentBasename(relativePath).replace(/\.[^.]+$/u, "");
  return name.replace(/[-_]+/gu, " ").trim();
}

function parseMedia(sourcePath: string, url: string): ContentMedia {
  const relativePath = sourceRelativePath(sourcePath);
  const extension = relativePath.split(".").at(-1)?.toLocaleLowerCase() ?? "";
  const mediaType = mediaTypes.get(extension);
  if (!mediaType) throw new Error(`Unsupported content media type: ${sourcePath}`);
  return { kind: "media", relativePath, url, mediaType, alt: humanizeFilename(relativePath) };
}

function validateCollisions(entries: readonly ContentEntry[]): void {
  const files = new Set(entries.map((entry) => entry.relativePath));
  if (files.size !== entries.length) throw new Error("Content path collision: duplicate file path");
  for (const file of files) {
    const segments = file.split("/");
    segments.pop();
    while (segments.length > 0) {
      const directory = segments.join("/");
      if (files.has(directory)) throw new Error(`Content path collision between file and directory: ${directory}`);
      segments.pop();
    }
  }
}

function localReference(value: string): boolean {
  return value !== "" && !value.startsWith("#") && !value.startsWith("/") && !/^[a-z][a-z\d+.-]*:/iu.test(value);
}

function validateTokenReferences(tokens: readonly Token[], document: ContentDocument, tree: ContentTree): void {
  for (const token of tokens) {
    if (token.type === "image") {
      const source = String(token.attrGet("src") ?? "");
      if (token.content.trim() === "") throw new Error(`Image alt text is required in ${document.relativePath}: ${source}`);
      const target = resolveContentReference(tree, document.relativePath, source);
      if (target?.kind !== "media") throw new Error(`Missing content reference in ${document.relativePath}: ${source}`);
    } else if (token.type === "link_open") {
      const href = String(token.attrGet("href") ?? "");
      if (localReference(href)) {
        const target = resolveContentReference(tree, document.relativePath, href);
        if (target?.kind !== "document") throw new Error(`Missing content reference in ${document.relativePath}: ${href}`);
      }
    }
    if (token.children) validateTokenReferences(token.children, document, tree);
  }
}

function validateDocumentReferences(entries: readonly ContentEntry[]): void {
  const tree = buildContentTree(entries);
  for (const entry of entries) {
    if (entry.kind === "document") validateTokenReferences(markdownParser.parse(entry.markdown, {}), entry, tree);
  }
}

export function createContentManifest(sources: ContentSources): ContentManifest {
  const entries: ContentEntry[] = [
    ...Object.entries(sources.markdownSources).map(([sourcePath, source]) => parseDocument(sourcePath, source)),
    ...Object.entries(sources.mediaSources).map(([sourcePath, url]) => parseMedia(sourcePath, url))
  ].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  validateCollisions(entries);
  validateDocumentReferences(entries);
  return Object.freeze({ entries: Object.freeze(entries) });
}
