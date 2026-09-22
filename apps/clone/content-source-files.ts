import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export async function discoverContentFiles(contentRoot: string): Promise<string[]> {
  const rootStats = await lstat(contentRoot);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error(`Content root must be a real directory: ${contentRoot}`);
  }
  const canonicalRoot = await realpath(contentRoot);
  const files: string[] = [];

  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      if (entry.name === ".DS_Store" || entry.name.startsWith("._")) return;
      const absolutePath = path.join(directory, entry.name);
      const stats = await lstat(absolutePath);
      if (stats.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in content: ${absolutePath}`);
      const canonicalPath = await realpath(absolutePath);
      if (!isWithinRoot(canonicalRoot, canonicalPath)) throw new Error(`Content path escapes its root: ${absolutePath}`);
      if (stats.isDirectory()) await visit(absolutePath);
      else if (stats.isFile()) files.push(absolutePath);
      else throw new Error(`Unsupported content filesystem entry: ${absolutePath}`);
    }));
  };

  await visit(contentRoot);
  return files.sort((left, right) => left.localeCompare(right));
}
