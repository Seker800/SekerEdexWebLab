import { canonicalFileEntries, type CanonicalFileEntry, type FileIconName } from "./filesystem-model.js";

export interface BrowserFileEntry extends CanonicalFileEntry {
  path: string;
  size?: number;
  content?: string;
}

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
}

const root = "/home/squared";
const home = `${root}/.config/eDEX-UI`;

const seedDirectories: Readonly<Record<string, readonly SeedEntry[]>> = {
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

function join(parent: string, name: string): string {
  return parent === "/" ? `/${name}` : `${parent}/${name}`;
}

function seededEntry(parent: string, seed: SeedEntry): BrowserFileEntry {
  return {
    name: seed.name,
    category: seed.category,
    icon: seed.icon ?? (seed.category === "directory" ? "dir" : seed.category === "symlink" ? "symlink" : "file"),
    path: join(parent, seed.name),
    ...(seed.content !== undefined && { content: seed.content })
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

export function createSandboxFilesystem(): BrowserFilesystem {
  const directorySeeds = new Map<string, readonly SeedEntry[]>(Object.entries(seedDirectories));
  const canonical = canonicalFileEntries.map(canonicalEntry);
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
    if (path === home) return canonical.map((entry) => ({ ...entry }));
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
