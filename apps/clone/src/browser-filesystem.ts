import { canonicalFileEntries, type CanonicalFileEntry, type FileIconName } from "./filesystem-model.js";

export interface BrowserFileEntry extends CanonicalFileEntry {
  path: string;
  size?: number;
  content?: string;
  preview?: BrowserFilePreview;
}

export interface BrowserDocumentPreview {
  kind: "document";
  title: string;
  summary: string;
  publishedAt?: string;
  tags?: readonly string[];
  markdown: string;
}

export interface BrowserImagePreview {
  kind: "image";
  src: string;
  alt: string;
  caption?: string;
  mediaType: string;
}

export type BrowserFilePreview = BrowserDocumentPreview | BrowserImagePreview;

export interface BrowserDocumentSource {
  relativePath: string;
  title: string;
  summary: string;
  publishedAt: string;
  tags: readonly string[];
  markdown: string;
}

export interface BrowserFilesystem {
  readonly root: string;
  readonly home: string;
  readonly initialPath: string;
  complete(cwd: string, partialPath: string): string[];
  entry(cwd: string, name: string): BrowserFileEntry | undefined;
  isDirectory(path: string): boolean;
  list(path: string): BrowserFileEntry[];
  read(path: string): string | undefined;
  resolve(cwd: string, requestedPath: string): string;
}

interface SeedEntry {
  name: string;
  category: "directory" | "symlink" | "file";
  icon?: FileIconName;
  content?: string;
  preview?: BrowserFilePreview;
}

const root = "/home/squared";
const home = `${root}/.config/eDEX-UI`;

const baseSeedDirectories: Readonly<Record<string, readonly SeedEntry[]>> = {
  [root]: [
    { name: ".config", category: "directory" },
    { name: "Documents", category: "directory" },
    { name: "Projects", category: "directory" }
  ],
  [`${root}/.config`]: [{ name: "eDEX-UI", category: "directory" }],
  [`${home}/themes`]: [
    { name: "tron.json", category: "file", icon: "config", content: "{\n  \"theme\": \"tron\",\n  \"signal\": \"#AACFD1\"\n}" },
    { name: "tron-disrupted.json", category: "file", icon: "config", content: "{\n  \"theme\": \"tron-disrupted\"\n}" }
  ],
  [`${home}/keyboards`]: [
    { name: "en-US.json", category: "file", icon: "config", content: "{\n  \"layout\": \"en-US\"\n}" }
  ],
  [`${home}/fonts`]: [
    { name: "FiraMono-Regular.ttf", category: "file" },
    { name: "UnitedSansMedium.otf", category: "file" }
  ],
  [`${home}/Cache`]: [{ name: "index", category: "file", content: "browser cache snapshot" }],
  [`${home}/databases`]: [{ name: "Databases.db", category: "file" }],
  [`${home}/GPUCache`]: [],
  [`${home}/IndexedDB`]: [],
  [`${home}/blob_storage`]: [],
  [`${home}/Local Storage`]: [{ name: "leveldb", category: "directory" }],
  [`${home}/Local Storage/leveldb`]: [],
  [`${home}/webrtc_events`]: [],
  [`${root}/Documents`]: [{ name: "readme.txt", category: "file", content: "eDEX browser workspace" }],
  [`${root}/Projects`]: []
};

const blogRoot = `${home}/Blog`;

function documentSeed(document: BrowserDocumentSource): SeedEntry {
  const name = document.relativePath.split("/").at(-1)!;
  return {
    name,
    category: "file",
    icon: "file",
    content: document.markdown,
    preview: {
      kind: "document",
      title: document.title,
      summary: document.summary,
      publishedAt: document.publishedAt,
      tags: document.tags,
      markdown: document.markdown
    }
  };
}

function createBlogSeedDirectories(documents: readonly BrowserDocumentSource[]): Readonly<Record<string, readonly SeedEntry[]>> {
  const directories = new Map<string, SeedEntry[]>([[blogRoot, []]]);
  const ensureDirectory = (relativeDirectory: string): SeedEntry[] => {
    const absoluteDirectory = relativeDirectory === "" ? blogRoot : `${blogRoot}/${relativeDirectory}`;
    const existing = directories.get(absoluteDirectory);
    if (existing) return existing;

    const segments = relativeDirectory.split("/");
    const name = segments.pop()!;
    const parentRelative = segments.join("/");
    ensureDirectory(parentRelative).push({ name, category: "directory" });
    const entries: SeedEntry[] = [];
    directories.set(absoluteDirectory, entries);
    return entries;
  };

  for (const document of documents) {
    const segments = document.relativePath.split("/");
    segments.pop();
    ensureDirectory(segments.join("/")).push(documentSeed(document));
  }

  ensureDirectory("images").push(
    { name: "command-deck.svg", category: "file", icon: "file", preview: { kind: "image", src: "/blog/command-deck.svg", alt: "Diagram of the blog command deck regions", caption: "Filesystem, reader, telemetry, and keyboard share one command deck.", mediaType: "image/svg+xml" } },
    { name: "content-flow.svg", category: "file", icon: "file", preview: { kind: "image", src: "/blog/content-flow.svg", alt: "Diagram of the typed blog content flow", caption: "A typed activation flows from the filesystem to either the reader or media viewer.", mediaType: "image/svg+xml" } }
  );

  const rootOrder = new Map(["posts", "projects", "images"].map((name, index) => [name, index]));
  for (const [directory, entries] of directories) {
    entries.sort((left, right) => {
      const categoryOrder = Number(right.category === "directory") - Number(left.category === "directory");
      if (categoryOrder !== 0) return categoryOrder;
      if (directory === blogRoot) {
        const leftOrder = rootOrder.get(left.name) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = rootOrder.get(right.name) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      }
      return left.name.localeCompare(right.name);
    });
  }

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
    ...(seed.content !== undefined && { content: seed.content }),
    ...(seed.preview !== undefined && { preview: seed.preview })
  };
}

function canonicalEntry(entry: CanonicalFileEntry): BrowserFileEntry {
  return { ...entry, path: join(home, entry.name) };
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
    } else {
      segments.push(segment);
    }
  }

  if (escaped) return root;
  return segments.length === 0 ? root : `${root}/${segments.join("/")}`;
}

export function createSandboxFilesystem(options: { blogDocuments?: readonly BrowserDocumentSource[]; startInBlog?: boolean } = {}): BrowserFilesystem {
  const documents = options.blogDocuments ?? [];
  const hasBlogContent = documents.length > 0;
  const initialPath = hasBlogContent && options.startInBlog ? blogRoot : home;
  const directorySeeds = new Map<string, readonly SeedEntry[]>([
    ...Object.entries(baseSeedDirectories),
    ...(hasBlogContent ? Object.entries(createBlogSeedDirectories(documents)) : [])
  ]);
  const canonical = canonicalFileEntries.map(canonicalEntry);
  const blogEntry = seededEntry(home, { name: "Blog", category: "directory" });
  const files = new Map<string, BrowserFileEntry>();

  for (const [directory, seeds] of directorySeeds) {
    for (const seed of seeds) files.set(join(directory, seed.name), seededEntry(directory, seed));
  }
  for (const entry of canonical) files.set(entry.path, entry);

  const isDirectory = (path: string): boolean => path === home || directorySeeds.has(path);
  const resolve = (cwd: string, requestedPath: string): string => {
    if (requestedPath === "~") return root;
    if (requestedPath.startsWith("~/")) return normalizeWithinRoot(root, requestedPath.slice(2));
    return normalizeWithinRoot(cwd, requestedPath);
  };

  const list = (path: string): BrowserFileEntry[] => {
    if (path === home) return [...canonical.map((entry) => ({ ...entry })), ...(hasBlogContent ? [{ ...blogEntry }] : [])];
    const seeds = directorySeeds.get(path);
    if (!seeds) return [];
    return [
      { name: "Show disks", category: "navigation", icon: "showDisks", path },
      ...(path === root ? [] : [{ name: "Go up", category: "navigation" as const, icon: "up" as const, path: resolve(path, "..") }]),
      ...seeds.map((seed) => seededEntry(path, seed))
    ];
  };

  const entry = (cwd: string, name: string): BrowserFileEntry | undefined => list(cwd).find((candidate) => candidate.name === name);
  const read = (path: string): string | undefined => files.get(path)?.content;
  const complete = (cwd: string, partialPath: string): string[] => {
    const slash = partialPath.lastIndexOf("/");
    const directoryPart = slash >= 0 ? partialPath.slice(0, slash + 1) : "";
    const namePart = slash >= 0 ? partialPath.slice(slash + 1) : partialPath;
    const directory = directoryPart === "" ? cwd : resolve(cwd, directoryPart);
    return list(directory)
      .filter((candidate) => candidate.category !== "navigation" && candidate.name.toLocaleLowerCase().startsWith(namePart.toLocaleLowerCase()))
      .map((candidate) => `${directoryPart}${candidate.name}${candidate.category === "directory" ? "/" : ""}`)
      .sort((a, b) => a.localeCompare(b));
  };

  return { root, home, initialPath, complete, entry, isDirectory, list, read, resolve };
}
