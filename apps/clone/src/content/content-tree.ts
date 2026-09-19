import { contentBasename, contentDirname, normalizeContentPath, type ContentEntry } from "./content-model.js";

export interface ContentDirectoryNode {
  readonly kind: "directory";
  readonly name: string;
  readonly relativePath: string;
  readonly children: readonly ContentTreeNode[];
}

export type ContentTreeNode = ContentDirectoryNode | ContentEntry;

export interface ContentTree {
  readonly root: ContentDirectoryNode;
  readonly byPath: ReadonlyMap<string, ContentTreeNode>;
}

interface MutableDirectoryNode {
  kind: "directory";
  name: string;
  relativePath: string;
  children: ContentTreeNode[];
}

function nodeName(node: ContentTreeNode): string {
  return node.kind === "directory" ? node.name : contentBasename(node.relativePath);
}

function sortNodes(nodes: ContentTreeNode[]): void {
  nodes.sort((left, right) => {
    if (left.kind === "directory" && right.kind !== "directory") return -1;
    if (left.kind !== "directory" && right.kind === "directory") return 1;
    return nodeName(left).localeCompare(nodeName(right));
  });
  for (const node of nodes) if (node.kind === "directory") sortNodes(node.children as ContentTreeNode[]);
}

export function buildContentTree(entries: readonly ContentEntry[]): ContentTree {
  const root: MutableDirectoryNode = { kind: "directory", name: "", relativePath: "", children: [] };
  const byPath = new Map<string, ContentTreeNode>([["", root]]);
  for (const entry of entries) {
    normalizeContentPath(entry.relativePath);
    const segments = contentDirname(entry.relativePath).split("/").filter(Boolean);
    let parent = root;
    let currentPath = "";
    for (const segment of segments) {
      currentPath = currentPath === "" ? segment : `${currentPath}/${segment}`;
      const existing = byPath.get(currentPath);
      if (existing && existing.kind !== "directory") throw new Error(`Content path collision: ${currentPath}`);
      if (existing) parent = existing as MutableDirectoryNode;
      else {
        const directory: MutableDirectoryNode = { kind: "directory", name: segment, relativePath: currentPath, children: [] };
        parent.children.push(directory);
        byPath.set(currentPath, directory);
        parent = directory;
      }
    }
    if (byPath.has(entry.relativePath)) throw new Error(`Content path collision: ${entry.relativePath}`);
    parent.children.push(entry);
    byPath.set(entry.relativePath, entry);
  }
  sortNodes(root.children);
  return Object.freeze({ root, byPath });
}

export function listContentDirectory(tree: ContentTree, relativePath: string): readonly ContentTreeNode[] {
  const normalized = normalizeContentPath(relativePath, { allowRoot: true });
  const node = tree.byPath.get(normalized);
  return node?.kind === "directory" ? node.children : [];
}

function resolveRelativePath(documentPath: string, reference: string): string | undefined {
  const rawPath = reference.split(/[?#]/u, 1)[0]!;
  if (rawPath === "" || rawPath.startsWith("/") || /^[a-z][a-z\d+.-]*:/iu.test(rawPath) || rawPath.includes("\\")) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return undefined;
  }
  const segments = contentDirname(documentPath).split("/").filter(Boolean);
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return undefined;
      segments.pop();
    } else segments.push(segment);
  }
  if (segments.length === 0) return undefined;
  return segments.join("/");
}

export function resolveContentReference(tree: ContentTree, documentPath: string, reference: string): ContentTreeNode | undefined {
  const resolved = resolveRelativePath(documentPath, reference);
  return resolved ? tree.byPath.get(resolved) : undefined;
}
