import path from "node:path";
import { loadContentSource, resolveContentRoot } from "../apps/clone/content-source.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const expectedArgument = process.argv.at(2);
if (expectedArgument && expectedArgument !== "sample") {
  throw new Error("Usage: verify-content-source.ts [sample]");
}

const source = await loadContentSource({ repositoryRoot, contentRoot: resolveContentRoot(repositoryRoot), expectedKind: "sample" });

console.log(`Verified ${source.descriptor.kind} content source ${source.descriptor.id} (${source.files.length} files, ${source.digest.slice(0, 12)}).`);
