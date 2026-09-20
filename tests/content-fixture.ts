import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createContentManifest, supportedContentMediaExtensions } from "../apps/clone/src/content/content-registry.js";

const contentRoot = path.resolve("content/blog");

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolutePath) : [absolutePath];
  }).sort((left, right) => left.localeCompare(right));
}

const files = filesBelow(contentRoot);
const markdownSources = Object.fromEntries(files
  .filter((file) => file.endsWith(".md"))
  .map((file) => [path.relative(contentRoot, file).replaceAll(path.sep, "/"), readFileSync(file, "utf8")]));
const mediaSources = Object.fromEntries(files
  .filter((file) => supportedContentMediaExtensions.includes(path.extname(file).slice(1).toLocaleLowerCase()))
  .map((file) => [path.relative(contentRoot, file).replaceAll(path.sep, "/"), `/test-content/${path.relative(contentRoot, file)}`]));

export const fixtureContentManifest = createContentManifest({ markdownSources, mediaSources });
