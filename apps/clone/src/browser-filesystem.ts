import { canonicalFileEntries, type CanonicalFileEntry, type FileIconName } from "./filesystem-model.js";
import { buildContentTree, type ContentDirectoryNode, type ContentTree, type ContentTreeNode } from "./content/content-tree.js";
import { contentBasename, type ContentEntry } from "./content/content-model.js";

export interface BrowserFileEntry extends CanonicalFileEntry {
  path: string;
  contentPath?: string;
  size?: number;
  content?: string;
  preview?: BrowserFilePreview;
}

export interface BrowserDocumentPreview {
  kind: "document";
  contentPath: string;
  title: string;
  summary: string;
  publishedAt?: string;
  tags?: readonly string[];
  markdown: string;
}

export interface BrowserImagePreview {
  kind: "image";
  contentPath: string;
  src: string;
  alt: string;
  caption?: string;
  mediaType: string;
}

export type BrowserFilePreview = BrowserDocumentPreview | BrowserImagePreview;

export interface BrowserFilesystem {
  readonly root: string;
  readonly canonicalRoot: string;
  readonly contentRoot: string;
  readonly initialPath: string;
  complete(cwd: string, partialPath: string): string[];
  entry(cwd: string, name: string): BrowserFileEntry | undefined;
  entryByPath(path: string): BrowserFileEntry | undefined;
  isDirectory(path: string): boolean;
  list(path: string): BrowserFileEntry[];
  read(path: string): string | undefined;
  resolve(cwd: string, requestedPath: string): string;
}

interface SeedEntry {
  name: string;
  category: "directory" | "symlink" | "file";
  icon?: FileIconName;
  contentPath?: string;
  content?: string;
  preview?: BrowserFilePreview;
}

const root = "/home/squared";
const canonicalRoot = `${root}/.config/eDEX-UI`;
const contentRoot = `${root}/Blog`;

const canonicalSeedDirectories: Readonly<Record<string, readonly SeedEntry[]>> = {
  [root]: [
    { name: ".config", category: "directory" },
    { name: "Documents", category: "directory" },
    { name: "Projects", category: "directory" }
  ],
  [`${root}/.config`]: [{ name: "eDEX-UI", category: "directory" }],
  [`${canonicalRoot}/themes`]: [
    { name: "tron.json", category: "file", icon: "config", content: "{\n  \"theme\": \"tron\",\n  \"signal\": \"#AACFD1\"\n}" },
    { name: "tron-disrupted.json", category: "file", icon: "config", content: "{\n  \"theme\": \"tron-disrupted\"\n}" }
  ],
  [`${canonicalRoot}/keyboards`]: [
    { name: "en-US.json", category: "file", icon: "config", content: "{\n  \"layout\": \"en-US\"\n}" }
  ],
  [`${canonicalRoot}/fonts`]: [
    { name: "FiraMono-Regular.ttf", category: "file" },
    { name: "UnitedSansMedium.otf", category: "file" }
  ],
  [`${canonicalRoot}/Cache`]: [{ name: "index", category: "file", content: "browser cache snapshot" }],
  [`${canonicalRoot}/databases`]: [{ name: "Databases.db", category: "file" }],
  [`${canonicalRoot}/GPUCache`]: [],
  [`${canonicalRoot}/IndexedDB`]: [],
  [`${canonicalRoot}/blob_storage`]: [],
  [`${canonicalRoot}/Local Storage`]: [{ name: "leveldb", category: "directory" }],
  [`${canonicalRoot}/Local Storage/leveldb`]: [],
  [`${canonicalRoot}/webrtc_events`]: [],
  [`${root}/Documents`]: [{ name: "readme.txt", category: "file", content: "eDEX browser workspace" }],
  [`${root}/Projects`]: []
};

function contentSeed(node: Exclude<ContentTreeNode, ContentDirectoryNode>): SeedEntry {
  if (node.kind === "document") {
    return {
      name: contentBasename(node.relativePath),
      category: "file",
      contentPath: node.relativePath,
      content: node.markdown,
      preview: {
        kind: "document",
        contentPath: node.relativePath,
        title: node.title,
        summary: node.summary,
        publishedAt: node.publishedAt,
        tags: node.tags,
        markdown: node.markdown
      }
    };
  }
  return {
    name: contentBasename(node.relativePath),
    category: "file",
    contentPath: node.relativePath,
    preview: {
      kind: "image",
      contentPath: node.relativePath,
      src: node.url,
      alt: node.alt,
      mediaType: node.mediaType
    }
  };
}

function contentSeedDirectories(tree: ContentTree): Readonly<Record<string, readonly SeedEntry[]>> {
  const directories = new Map<string, SeedEntry[]>();
  const visit = (directory: ContentDirectoryNode): void => {
    const absolutePath = directory.relativePath === "" ? contentRoot : `${contentRoot}/${directory.relativePath}`;
    directories.set(absolutePath, directory.children.map((node) => node.kind === "directory"
      ? { name: node.name, category: "directory", contentPath: node.relativePath }
      : contentSeed(node)));
    for (const child of directory.children) if (child.kind === "directory") visit(child);
  };
  visit(tree.root);
  return Object.fromEntries(directories);
}

function join(parent: string, name: string): string {
  return parent === "/" ? `/${name}` : `${parent}/${name}`;
}

function seededEntry(parent: string, seed: SeedEntry): BrowserFileEntry {
  return {
    name: seed.name,
    category: seed.category,
    icon: seed.icon ?? (seed.category === "directory" ? "dir" : seed.category === "symlink" ? "symlink" : "file"),
    path: join(parent, seed.name),
    ...(seed.contentPath !== undefined && { contentPath: seed.contentPath }),
    ...(seed.content !== undefined && { content: seed.content }),
    ...(seed.preview !== undefined && { preview: seed.preview })
  };
}

function canonicalEntry(entry: CanonicalFileEntry): BrowserFileEntry {
  return { ...entry, path: join(canonicalRoot, entry.name) };
}

function normalizeWithinRoot(cwd: string, requestedPath: string): string {
  const absolute = requestedPath.startsWith("/");
  if (absolute && requestedPath !== root && !requestedPath.startsWith(`${root}/`)) return root;
  const base = absolute ? [] : cwd.slice(root.length).split("/").filter(Boolean);
  const relativeRequest = absolute ? requestedPath.slice(root.length) : requestedPath;
  const requested = relativeRequest.replace(/^\/+/, "").split("/").filter((segment) => segment !== "" && segment !== ".");
  const segments = [...base];
  let escaped = false;
  for (const segment of requested) {
    if (segment === "..") {
      if (segments.length === 0) escaped = true;
      else segments.pop();
    } else segments.push(segment);
  }
  if (escaped) return root;
  return segments.length === 0 ? root : `${root}/${segments.join("/")}`;
}

export function createSandboxFilesystem(options: { contentEntries?: readonly ContentEntry[]; startInContent?: boolean } = {}): BrowserFilesystem {
  const contentEntries = options.contentEntries ?? [];
  const hasContent = contentEntries.length > 0;
  const contentDirectories = hasContent ? contentSeedDirectories(buildContentTree(contentEntries)) : {};
  const rootSeeds = [
    ...canonicalSeedDirectories[root]!,
    ...(hasContent ? [{ name: "Blog", category: "directory" as const }] : [])
  ];
  const directorySeeds = new Map<string, readonly SeedEntry[]>([
    ...Object.entries(canonicalSeedDirectories),
    ...Object.entries(contentDirectories)
  ]);
  directorySeeds.set(root, rootSeeds);
  const canonical = canonicalFileEntries.map(canonicalEntry);
  const files = new Map<string, BrowserFileEntry>();
  for (const [directory, seeds] of directorySeeds) {
    for (const seed of seeds) files.set(join(directory, seed.name), seededEntry(directory, seed));
  }
  for (const entry of canonical) files.set(entry.path, entry);

  const initialPath = hasContent && options.startInContent ? contentRoot : canonicalRoot;
  const isDirectory = (path: string): boolean => path === canonicalRoot || directorySeeds.has(path);
  const resolve = (cwd: string, requestedPath: string): string => {
    if (requestedPath === "~") return root;
    if (requestedPath.startsWith("~/")) return normalizeWithinRoot(root, requestedPath.slice(2));
    return normalizeWithinRoot(cwd, requestedPath);
  };
  const list = (path: string): BrowserFileEntry[] => {
    if (path === canonicalRoot) return canonical.map((entry) => ({ ...entry }));
    const seeds = directorySeeds.get(path);
    if (!seeds) return [];
    return [
      { name: "Show disks", category: "navigation", icon: "showDisks", path },
      ...(path === root ? [] : [{ name: "Go up", category: "navigation" as const, icon: "up" as const, path: resolve(path, "..") }]),
      ...seeds.map((seed) => seededEntry(path, seed))
    ];
  };
  const entry = (cwd: string, name: string): BrowserFileEntry | undefined => list(cwd).find((candidate) => candidate.name === name);
  const entryByPath = (path: string): BrowserFileEntry | undefined => files.get(path);
  const read = (path: string): string | undefined => files.get(path)?.content;
  const complete = (cwd: string, partialPath: string): string[] => {
    const slash = partialPath.lastIndexOf("/");
    const directoryPart = slash >= 0 ? partialPath.slice(0, slash + 1) : "";
    const namePart = slash >= 0 ? partialPath.slice(slash + 1) : partialPath;
    const directory = directoryPart === "" ? cwd : resolve(cwd, directoryPart);
    return list(directory)
      .filter((candidate) => candidate.category !== "navigation" && candidate.name.toLocaleLowerCase().startsWith(namePart.toLocaleLowerCase()))
      .map((candidate) => `${directoryPart}${candidate.name}${candidate.category === "directory" ? "/" : ""}`)
      .sort((left, right) => left.localeCompare(right));
  };

  return { root, canonicalRoot, contentRoot, initialPath, complete, entry, entryByPath, isDirectory, list, read, resolve };
}
