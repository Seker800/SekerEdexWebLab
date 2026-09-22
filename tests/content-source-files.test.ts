import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverContentFiles } from "../apps/clone/content-source-files.js";
import { contentManifestPlugin, resolveContentRoot } from "../apps/clone/vite.config.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("content source discovery", () => {
  it("resolves a private content root relative to the repository without changing the public default", () => {
    const repositoryRoot = path.join(tmpdir(), "SekerEdexWebLab");

    expect(resolveContentRoot(repositoryRoot)).toBe(path.join(repositoryRoot, "content", "blog"));
    expect(resolveContentRoot(repositoryRoot, "../SekerEdexContent/blog"))
      .toBe(path.join(tmpdir(), "SekerEdexContent", "blog"));
    expect(resolveContentRoot(repositoryRoot, path.join(tmpdir(), "private-blog")))
      .toBe(path.join(tmpdir(), "private-blog"));
  });

  it("returns deterministic regular files and refuses symbolic links", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "seker-content-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, "posts"));
    await writeFile(path.join(root, "posts", "b.md"), "b");
    await writeFile(path.join(root, "a.md"), "a");
    await writeFile(path.join(root, ".DS_Store"), "finder metadata");
    await writeFile(path.join(root, "._a.md"), "appledouble metadata");

    await expect(discoverContentFiles(root)).resolves.toEqual([
      path.join(root, "a.md"),
      path.join(root, "posts", "b.md")
    ]);

    const outside = path.join(root, "..", `${path.basename(root)}-outside.md`);
    await writeFile(outside, "secret");
    temporaryDirectories.push(outside);
    await symlink(outside, path.join(root, "leak.md"));
    await expect(discoverContentFiles(root)).rejects.toThrow(/symbolic link/i);
  });

  it("watches the content root and invalidates the virtual manifest for all Vite 7 file event types", () => {
    const root = path.join(tmpdir(), "content-root");
    const plugin = contentManifestPlugin(root);
    const watched: string[] = [];
    const invalidated: unknown[] = [];
    const messages: unknown[] = [];
    const virtualModule = {};
    const server = {
      watcher: { add: (file: string) => { watched.push(file); } },
      moduleGraph: {
        getModuleById: (id: string) => id === "\0virtual:content-manifest" ? virtualModule : undefined,
        invalidateModule: (module: unknown) => { invalidated.push(module); }
      },
      ws: { send: (message: unknown) => { messages.push(message); } }
    };
    if (typeof plugin.configureServer !== "function" || typeof plugin.hotUpdate !== "function") {
      throw new Error("Content plugin is missing its development-server hooks");
    }
    const hotUpdate = plugin.hotUpdate;

    Reflect.apply(plugin.configureServer, {}, [server]);
    const environment = {
      name: "client",
      moduleGraph: server.moduleGraph,
      hot: server.ws
    };
    const results = (["create", "update", "delete"] as const).map((type) => Reflect.apply(hotUpdate, { environment }, [{
      type,
      file: path.join(root, "new.md"),
      server,
      timestamp: Date.now(),
      modules: [],
      read: () => ""
    }]));

    expect(watched).toEqual([root]);
    expect(invalidated).toEqual([virtualModule, virtualModule, virtualModule]);
    expect(messages).toEqual(Array.from({ length: 3 }, () => ({ type: "full-reload" })));
    expect(results).toEqual([[], [], []]);
  });

});
