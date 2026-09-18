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

export interface BrowserFilesystem {
  readonly root: string;
  readonly home: string;
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
const welcomeMarkdown = `# Welcome to the command deck

This folder is the content entrance for the future blog. Articles remain ordinary files, while the center panel provides a focused reading view.

## How it works

- Select a folder to browse its children.
- Select a Markdown file to read it in the center panel.
- Select an image to open the media viewer.

The terminal can still read the same source with \`cat\`, so navigation and content share one filesystem model.`;
const architectureMarkdown = `# Building a blog inside eDEX

The blog keeps the single screen command deck and gives each region a useful role.

## Content flow

1. The filesystem exposes folders and typed file previews.
2. The command deck controller owns the selected article.
3. The reader renders escaped Markdown in the terminal region.
4. The image viewer owns zoom, sequence navigation, and dismissal.

This keeps content data separate from DOM rendering and makes a future file based content pipeline straightforward.`;
const projectMarkdown = `# SekerEdexWebLab

An unofficial browser implementation inspired by eDEX-UI. The current prototype studies its full screen layout, terminal interaction, filesystem behavior, keyboard feedback, audio, and telemetry.

## Current focus

- Preserve the fixed 1920 × 1080 desktop composition.
- Connect visible modules through typed commands and events.
- Add blog reading without weakening the reference capture path.`;
const aboutMarkdown = `# About this prototype

This is a neutral starter page for the future blog. Replace the sample articles with real Markdown content when the editorial structure is ready.

The interface is an unofficial implementation and is not endorsed by eDEX-UI or its author.`;

function documentSeed(name: string, title: string, summary: string, markdown: string, tags: readonly string[]): SeedEntry {
  return { name, category: "file", icon: "file", content: markdown, preview: { kind: "document", title, summary, publishedAt: "2026-09-18", tags, markdown } };
}

const blogSeedDirectories: Readonly<Record<string, readonly SeedEntry[]>> = {
  [blogRoot]: [
    { name: "posts", category: "directory" },
    { name: "projects", category: "directory" },
    { name: "images", category: "directory" },
    documentSeed("about.md", "About this prototype", "A starting point for the future blog.", aboutMarkdown, ["about"])
  ],
  [`${blogRoot}/posts`]: [
    documentSeed("welcome.md", "Welcome to the command deck", "Using the filesystem as a blog navigation model.", welcomeMarkdown, ["notes", "interface"]),
    documentSeed("building-edex-web.md", "Building a blog inside eDEX", "The content architecture behind the command deck.", architectureMarkdown, ["engineering", "design"])
  ],
  [`${blogRoot}/projects`]: [
    documentSeed("SekerEdexWebLab.md", "SekerEdexWebLab", "Project notes for the browser based eDEX study.", projectMarkdown, ["project", "web"])
  ],
  [`${blogRoot}/images`]: [
    { name: "command-deck.svg", category: "file", icon: "file", preview: { kind: "image", src: "/blog/command-deck.svg", alt: "Diagram of the blog command deck regions", caption: "Filesystem, reader, telemetry, and keyboard share one command deck.", mediaType: "image/svg+xml" } },
    { name: "content-flow.svg", category: "file", icon: "file", preview: { kind: "image", src: "/blog/content-flow.svg", alt: "Diagram of the typed blog content flow", caption: "A typed activation flows from the filesystem to either the reader or media viewer.", mediaType: "image/svg+xml" } }
  ]
};

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

export function createSandboxFilesystem(options: { includeBlogContent?: boolean } = {}): BrowserFilesystem {
  const includeBlogContent = options.includeBlogContent ?? true;
  const directorySeeds = new Map<string, readonly SeedEntry[]>([
    ...Object.entries(baseSeedDirectories),
    ...(includeBlogContent ? Object.entries(blogSeedDirectories) : [])
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
    if (path === home) return [...canonical.map((entry) => ({ ...entry })), ...(includeBlogContent ? [{ ...blogEntry }] : [])];
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

  return { root, home, complete, entry, isDirectory, list, read, resolve };
}
