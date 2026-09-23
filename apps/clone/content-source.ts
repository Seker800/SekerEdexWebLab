import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { discoverContentFiles } from "./content-source-files.js";
import { supportedContentMediaExtensions } from "./src/content/content-registry.js";
import type { ContentSourceDescriptor, ContentSourceKind } from "./src/content/content-model.js";

export const contentSourceDescriptorFilename = "content-source.json";
export const defaultSampleContentRoot = path.join("examples", "blog");

const descriptorSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  kind: z.enum(["sample", "author"]),
  visibility: z.literal("public"),
  defaultLicense: z.string().min(1)
}).strict();

export interface LoadedContentSource {
  readonly repositoryRoot: string;
  readonly root: string;
  readonly expectedKind: ContentSourceKind;
  readonly descriptor: ContentSourceDescriptor;
  readonly files: readonly string[];
  readonly digest: string;
}

export interface LoadContentSourceOptions {
  readonly repositoryRoot: string;
  readonly contentRoot: string;
  readonly expectedKind: ContentSourceKind;
}

export interface ContentSourceSelection {
  readonly contentRoot: string;
  readonly expectedKind: ContentSourceKind;
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function isPublishableContentFile(file: string): boolean {
  const extension = path.extname(file).slice(1).toLocaleLowerCase();
  return extension === "md" || supportedContentMediaExtensions.includes(extension);
}

export function resolveContentRoot(repositoryRoot: string, configuredRoot?: string): string {
  return path.resolve(repositoryRoot, configuredRoot?.trim() || defaultSampleContentRoot);
}

export function selectContentSource(
  repositoryRoot: string,
  configuredRoot?: string,
  profile?: string
): ContentSourceSelection {
  const normalizedProfile = profile?.trim();
  if (normalizedProfile && normalizedProfile !== "sample" && normalizedProfile !== "author") {
    throw new Error(`Unsupported content profile: ${normalizedProfile}`);
  }
  const expectedKind: ContentSourceKind = normalizedProfile === "sample" || normalizedProfile === "author"
    ? normalizedProfile
    : configuredRoot?.trim() ? "author" : "sample";
  if (expectedKind === "sample") {
    return { contentRoot: resolveContentRoot(repositoryRoot), expectedKind };
  }
  if (!configuredRoot?.trim()) throw new Error("Author content requires SEKER_CONTENT_ROOT.");
  return { contentRoot: resolveContentRoot(repositoryRoot, configuredRoot), expectedKind };
}

export async function loadContentSource(options: LoadContentSourceOptions): Promise<LoadedContentSource> {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const contentRoot = path.resolve(options.contentRoot);
  const rootStats = await lstat(contentRoot);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error(`Content root must be a real directory: ${contentRoot}`);
  }

  const descriptorPath = path.join(contentRoot, contentSourceDescriptorFilename);
  let descriptorSource: string;
  try {
    const descriptorStats = await lstat(descriptorPath);
    if (descriptorStats.isSymbolicLink() || !descriptorStats.isFile()) throw new Error("not a regular file");
    descriptorSource = await readFile(descriptorPath, "utf8");
  } catch (error) {
    throw new Error(`Content source descriptor is missing or invalid: ${descriptorPath}`, { cause: error });
  }

  let descriptorValue: unknown;
  try {
    descriptorValue = JSON.parse(descriptorSource);
  } catch (error) {
    throw new Error(`Content source descriptor is not valid JSON: ${descriptorPath}`, { cause: error });
  }
  const descriptor = descriptorSchema.parse(descriptorValue);

  if (descriptor.kind !== options.expectedKind) {
    throw new Error(`Expected ${options.expectedKind} content but ${descriptorPath} declares ${descriptor.kind}.`);
  }
  const [canonicalRepositoryRoot, canonicalContentRoot] = await Promise.all([
    realpath(repositoryRoot),
    realpath(contentRoot)
  ]);
  const insideRepository = isWithinRoot(canonicalRepositoryRoot, canonicalContentRoot);
  if (descriptor.kind === "sample" && contentRoot !== path.join(repositoryRoot, defaultSampleContentRoot)) {
    throw new Error(`Sample content must use the repository example root: ${path.join(repositoryRoot, defaultSampleContentRoot)}`);
  }
  if (descriptor.kind === "author" && insideRepository) {
    throw new Error("Author content must live outside the public repository.");
  }

  const discoveredFiles = await discoverContentFiles(contentRoot);
  const files = discoveredFiles.filter((file) => file !== descriptorPath);
  const unsupported = files.find((file) => !isPublishableContentFile(file));
  if (unsupported) {
    throw new Error(`Unsupported content file in publishable root: ${path.relative(contentRoot, unsupported)}`);
  }

  const digest = createHash("sha256");
  digest.update(`${JSON.stringify(descriptor)}\0`);
  for (const file of files) {
    digest.update(`${path.relative(contentRoot, file).split(path.sep).join("/")}\0`);
    digest.update(await readFile(file));
    digest.update("\0");
  }

  return Object.freeze({
    repositoryRoot,
    root: contentRoot,
    expectedKind: options.expectedKind,
    descriptor: Object.freeze(descriptor),
    files: Object.freeze(files),
    digest: digest.digest("hex")
  });
}
