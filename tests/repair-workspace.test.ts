import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AllowedPathRepairWorkspace } from "../src/adapters/codex/repair-workspace.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("allowed path repair workspace", () => {
  it("restores tracked content and removes files created by a rejected repair", async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), "edex-repository-"));
    temporaryDirectories.push(repositoryRoot);
    const allowedRoot = path.join(repositoryRoot, "apps", "clone");
    await mkdir(allowedRoot, { recursive: true });
    const sourcePath = path.join(allowedRoot, "source.txt");
    const createdPath = path.join(allowedRoot, "created.txt");
    await writeFile(sourcePath, "before", "utf8");

    const workspace = new AllowedPathRepairWorkspace(repositoryRoot, ["apps/clone"]);
    await workspace.checkpoint();
    await writeFile(sourcePath, "after", "utf8");
    await writeFile(createdPath, "new", "utf8");
    await workspace.rollback();

    expect(await readFile(sourcePath, "utf8")).toBe("before");
    await expect(readFile(createdPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps an accepted repair", async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), "edex-repository-"));
    temporaryDirectories.push(repositoryRoot);
    const allowedRoot = path.join(repositoryRoot, "apps", "clone");
    await mkdir(allowedRoot, { recursive: true });
    const sourcePath = path.join(allowedRoot, "source.txt");
    await writeFile(sourcePath, "before", "utf8");

    const workspace = new AllowedPathRepairWorkspace(repositoryRoot, ["apps/clone"]);
    await workspace.checkpoint();
    await writeFile(sourcePath, "after", "utf8");
    await workspace.accept();

    expect(await readFile(sourcePath, "utf8")).toBe("after");
  });
});
