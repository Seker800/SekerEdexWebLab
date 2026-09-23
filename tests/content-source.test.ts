import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  contentSourceDescriptorFilename,
  loadContentSource,
  resolveContentRoot
} from "../apps/clone/content-source.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(name: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), name));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeDescriptor(root: string, kind: "sample" | "author", id = `${kind}-content`): Promise<void> {
  await writeFile(path.join(root, contentSourceDescriptorFilename), `${JSON.stringify({
    schemaVersion: 1,
    id,
    kind,
    visibility: "public",
    defaultLicense: kind === "sample" ? "documented-per-file" : "All rights reserved"
  }, null, 2)}\n`);
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("content source identity", () => {
  it("selects the repository sample only when no author root is configured", () => {
    const repositoryRoot = path.join(tmpdir(), "SekerEdexWebLab");

    expect(resolveContentRoot(repositoryRoot)).toBe(path.join(repositoryRoot, "examples", "blog"));
    expect(resolveContentRoot(repositoryRoot, "../SekerEdexContent/published"))
      .toBe(path.join(tmpdir(), "SekerEdexContent", "published"));
  });

  it("accepts the declared repository sample in sample mode", async () => {
    const repositoryRoot = await temporaryDirectory("seker-repository-");
    const contentRoot = path.join(repositoryRoot, "examples", "blog");
    await mkdir(contentRoot, { recursive: true });
    await writeDescriptor(contentRoot, "sample", "seker-edex-samples");
    await writeFile(path.join(contentRoot, "welcome.md"), "sample");

    const source = await loadContentSource({ repositoryRoot, contentRoot, expectedKind: "sample" });

    expect(source.descriptor).toMatchObject({ id: "seker-edex-samples", kind: "sample" });
    expect(source.files).toEqual([path.join(contentRoot, "welcome.md")]);
  });

  it("accepts an empty external author source without falling back to samples", async () => {
    const repositoryRoot = await temporaryDirectory("seker-repository-");
    const contentRoot = await temporaryDirectory("seker-author-content-");
    await writeDescriptor(contentRoot, "author");

    const source = await loadContentSource({ repositoryRoot, contentRoot, expectedKind: "author" });

    expect(source.descriptor.kind).toBe("author");
    expect(source.files).toEqual([]);
    expect(source.digest).toMatch(/^[a-f\d]{64}$/u);
  });

  it("produces a deterministic content digest that changes with publishable content", async () => {
    const repositoryRoot = await temporaryDirectory("seker-repository-");
    const contentRoot = await temporaryDirectory("seker-author-content-");
    await writeDescriptor(contentRoot, "author");
    const articlePath = path.join(contentRoot, "about.md");
    await writeFile(articlePath, "first revision");

    const first = await loadContentSource({ repositoryRoot, contentRoot, expectedKind: "author" });
    const repeated = await loadContentSource({ repositoryRoot, contentRoot, expectedKind: "author" });
    await writeFile(articlePath, "second revision");
    const changed = await loadContentSource({ repositoryRoot, contentRoot, expectedKind: "author" });

    expect(repeated.digest).toBe(first.digest);
    expect(changed.digest).not.toBe(first.digest);
  });

  it("rejects missing or mismatched identities and author content inside the public repository", async () => {
    const repositoryRoot = await temporaryDirectory("seker-repository-");
    const externalRoot = await temporaryDirectory("seker-external-content-");
    const internalRoot = path.join(repositoryRoot, "content", "author");
    await mkdir(internalRoot, { recursive: true });

    await expect(loadContentSource({ repositoryRoot, contentRoot: externalRoot, expectedKind: "author" }))
      .rejects.toThrow(/descriptor/i);

    await writeDescriptor(externalRoot, "sample");
    await expect(loadContentSource({ repositoryRoot, contentRoot: externalRoot, expectedKind: "author" }))
      .rejects.toThrow(/expected.*author.*sample/i);

    await writeDescriptor(internalRoot, "author");
    await expect(loadContentSource({ repositoryRoot, contentRoot: internalRoot, expectedKind: "author" }))
      .rejects.toThrow(/outside.*repository/i);
  });

  it("rejects unknown files instead of silently omitting possible drafts or originals", async () => {
    const repositoryRoot = await temporaryDirectory("seker-repository-");
    const contentRoot = await temporaryDirectory("seker-author-content-");
    await writeDescriptor(contentRoot, "author");
    await writeFile(path.join(contentRoot, "private-notes.txt"), "do not publish");

    await expect(loadContentSource({ repositoryRoot, contentRoot, expectedKind: "author" }))
      .rejects.toThrow(/unsupported content file.*private-notes\.txt/i);
  });
});
