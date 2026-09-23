import path from "node:path";
import { loadEnv } from "vite";
import { loadContentSource, selectContentSource } from "../apps/clone/content-source.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const expectedArgument = process.argv.at(2);
if (expectedArgument && expectedArgument !== "sample" && expectedArgument !== "author") {
  throw new Error("Usage: verify-content-source.ts [sample|author]");
}

const environment = loadEnv("production", repositoryRoot, "");
const selection = selectContentSource(
  repositoryRoot,
  environment.SEKER_CONTENT_ROOT,
  expectedArgument ?? environment.SEKER_CONTENT_PROFILE
);
const source = await loadContentSource({ repositoryRoot, ...selection });

console.log(`Verified ${source.descriptor.kind} content source ${source.descriptor.id} (${source.files.length} files, ${source.digest.slice(0, 12)}).`);
