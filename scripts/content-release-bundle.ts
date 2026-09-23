import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LoadedContentSource } from "../apps/clone/content-source.js";
import { contentReleaseMediaPath, contentReleaseRoot, createContentReleasePointer } from "../apps/clone/src/content/content-release.js";
import { createContentManifest, supportedContentMediaExtensions } from "../apps/clone/src/content/content-registry.js";
import type { ContentReleasePointer, PublishedContentManifest } from "../apps/clone/src/content/content-model.js";

export interface ContentMediaUpload {
  readonly localPath: string;
  readonly objectKey: string;
}

export interface ContentReleaseBundle {
  readonly pointer: ContentReleasePointer;
  readonly manifest: PublishedContentManifest;
  readonly manifestObjectKey: string;
  readonly mediaUploads: readonly ContentMediaUpload[];
}

function relativePath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

export async function createContentReleaseBundle(source: LoadedContentSource): Promise<ContentReleaseBundle> {
  if (source.descriptor.kind !== "author") throw new Error("Content releases only accept an author source.");
  const markdownFiles = source.files.filter((file) => path.extname(file).toLocaleLowerCase() === ".md");
  const mediaFiles = source.files.filter((file) => supportedContentMediaExtensions.includes(path.extname(file).slice(1).toLocaleLowerCase()));
  const markdownSources = Object.fromEntries(await Promise.all(markdownFiles.map(async (file) => [
    relativePath(source.root, file),
    await readFile(file, "utf8")
  ] as const)));
  const mediaSources = Object.fromEntries(mediaFiles.map((file) => {
    const relative = relativePath(source.root, file);
    return [relative, contentReleaseMediaPath(source.digest, relative)] as const;
  }));
  const content = createContentManifest({ markdownSources, mediaSources });
  const pointer = createContentReleasePointer(source.descriptor, source.digest);
  const releaseRoot = contentReleaseRoot(source.digest);
  return Object.freeze({
    pointer,
    manifest: Object.freeze({
      schemaVersion: 1,
      source: source.descriptor,
      digest: source.digest,
      entries: content.entries
    }),
    manifestObjectKey: `${releaseRoot}/manifest.json`,
    mediaUploads: Object.freeze(mediaFiles.map((file) => Object.freeze({
      localPath: file,
      objectKey: `${releaseRoot}/media/${relativePath(source.root, file)}`
    })))
  });
}
