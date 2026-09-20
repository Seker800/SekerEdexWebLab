import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, loadEnv, normalizePath, searchForWorkspaceRoot, type Plugin } from "vite";
import { createContentManifest, supportedContentMediaExtensions } from "./src/content/content-registry.js";
import { discoverContentFiles } from "./content-source-files.js";

const virtualModuleId = "virtual:content-manifest";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
const repositoryRoot = path.resolve(import.meta.dirname, "../..");

export function resolveContentRoot(root: string, configuredRoot?: string): string {
  const selectedRoot = configuredRoot?.trim() || "content/blog";
  return path.resolve(root, selectedRoot);
}

function contentRelativePath(contentRoot: string, file: string): string {
  return normalizePath(path.relative(contentRoot, file));
}

function isContentFile(contentRoot: string, file: string): boolean {
  const relative = path.relative(contentRoot, file);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function contentManifestPlugin(contentRoot = path.resolve(import.meta.dirname, "../../content/blog")): Plugin {
  return {
    name: "seker-content-manifest",
    config(config) {
      const configuredProjectRoot = path.resolve(config.root ?? process.cwd());
      return {
        server: {
          fs: {
            allow: [searchForWorkspaceRoot(configuredProjectRoot), contentRoot]
          }
        }
      };
    },
    configureServer(server) {
      server.watcher.add(contentRoot);
    },
    hotUpdate(options) {
      if (!isContentFile(contentRoot, options.file)) return;
      const virtualModule = this.environment.moduleGraph.getModuleById(resolvedVirtualModuleId);
      if (virtualModule) this.environment.moduleGraph.invalidateModule(virtualModule, new Set(), options.timestamp, true);
      if (this.environment.name === "client") this.environment.hot.send({ type: "full-reload" });
      return [];
    },
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
    },
    async load(id) {
      if (id !== resolvedVirtualModuleId) return undefined;
      const files = await discoverContentFiles(contentRoot);
      for (const file of files) this.addWatchFile(file);
      const markdownFiles = files.filter((file) => file.endsWith(".md"));
      const mediaFiles = files.filter((file) => supportedContentMediaExtensions.includes(path.extname(file).slice(1).toLocaleLowerCase()));
      const markdownSources = Object.fromEntries(await Promise.all(markdownFiles.map(async (file) => [contentRelativePath(contentRoot, file), await readFile(file, "utf8")] as const)));
      const placeholderMedia = Object.fromEntries(mediaFiles.map((file) => [contentRelativePath(contentRoot, file), file]));
      const manifest = createContentManifest({ markdownSources, mediaSources: placeholderMedia });
      const mediaImports = mediaFiles.map((file, index) => `import media${index} from ${JSON.stringify(`${normalizePath(file)}?url`)};`);
      const mediaVariables = new Map(mediaFiles.map((file, index) => [contentRelativePath(contentRoot, file), `media${index}`]));
      const serializedEntries = manifest.entries.map((entry) => entry.kind === "media"
        ? `{...${JSON.stringify(entry)},url:${mediaVariables.get(entry.relativePath)}}`
        : JSON.stringify(entry));
      return `${mediaImports.join("\n")}\nexport const contentManifest=Object.freeze({entries:Object.freeze([${serializedEntries.join(",")}])});`;
    }
  };
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, repositoryRoot, "");
  return { plugins: [contentManifestPlugin(resolveContentRoot(repositoryRoot, environment.SEKER_CONTENT_ROOT))] };
});
