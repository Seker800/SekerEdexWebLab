import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadEnv } from "vite";
import { loadContentSource, selectContentSource } from "../apps/clone/content-source.js";
import { fetchPublishedContent } from "../apps/clone/src/content/content-release.js";
import { createContentReleaseBundle } from "./content-release-bundle.js";
import { assertContentOwnedObjectKey, contentPointerObjectKey } from "./release-boundaries.js";
import { productionOrigin, refreshProductionCdn, requireProductionReleaseTools, runCommand, uploadProductionObject } from "./production-release-target.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

async function loadAuthorSource() {
  const environment = loadEnv("production", repositoryRoot, "");
  const configuredRoot = environment.SEKER_CONTENT_ROOT?.trim();
  if (!configuredRoot) throw new Error("Set SEKER_CONTENT_ROOT in .env.local before publishing content.");
  const selection = selectContentSource(repositoryRoot, configuredRoot, "author");
  return loadContentSource({ repositoryRoot, ...selection });
}

async function verifyPublicContent(digest: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const published = await fetchPublishedContent((input, init) => {
        const relative = typeof input === "string" ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname;
        return fetch(`${productionOrigin}${relative}?content=${digest}`, init);
      });
      if (published.digest === digest && published.source.kind === "author") return;
    } catch {
      // CDN refreshes are eventually consistent; retry only bounded public reads.
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("The public content pointer did not expose the expected release after the CDN refresh.");
}

async function publishContent(): Promise<void> {
  await runCommand("npm", ["run", "release:verify"], repositoryRoot);
  const source = await loadAuthorSource();
  const bundle = await createContentReleaseBundle(source);
  await requireProductionReleaseTools();
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seker-edex-content-"));
  try {
    const manifestFile = path.join(temporaryRoot, "manifest.json");
    const pointerFile = path.join(temporaryRoot, "current.json");
    await Promise.all([
      writeFile(manifestFile, `${JSON.stringify(bundle.manifest)}\n`),
      writeFile(pointerFile, `${JSON.stringify(bundle.pointer)}\n`)
    ]);
    for (const upload of bundle.mediaUploads) {
      assertContentOwnedObjectKey(upload.objectKey);
      await uploadProductionObject("content", upload.localPath, upload.objectKey, "public,max-age=31536000,immutable", repositoryRoot);
    }
    assertContentOwnedObjectKey(bundle.manifestObjectKey);
    await uploadProductionObject("content", manifestFile, bundle.manifestObjectKey, "public,max-age=31536000,immutable", repositoryRoot);

    const stableSource = await loadAuthorSource();
    if (stableSource.digest !== source.digest) {
      throw new Error("Author content changed during upload; the public pointer was not changed. Restart from a stable content tree.");
    }

    assertContentOwnedObjectKey(contentPointerObjectKey);
    await uploadProductionObject("content", pointerFile, contentPointerObjectKey, "no-store", repositoryRoot);
    await refreshProductionCdn(`${productionOrigin}/${contentPointerObjectKey}`, "File", repositoryRoot);
    await verifyPublicContent(source.digest);
    console.log(`Published content release ${source.digest.slice(0, 12)} without changing site-owned objects.`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

await publishContent();
