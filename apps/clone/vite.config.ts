import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, normalizePath, type Plugin } from "vite";
import { createContentManifest, supportedContentMediaExtensions } from "./src/content/content-registry.js";
import { discoverContentFiles } from "./content-source-files.js";

const virtualModuleId = "virtual:content-manifest";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;

function isContentFile(contentRoot: string, file: string): boolean {
  const relative = path.relative(contentRoot, file);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function contentManifestPlugin(contentRoot = path.resolve(import.meta.dirname, "../../content/blog")): Plugin {
  return {
    name: "seker-content-manifest",
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
      const markdownSources = Object.fromEntries(await Promise.all(markdownFiles.map(async (file) => [file, await readFile(file, "utf8")] as const)));
      const placeholderMedia = Object.fromEntries(mediaFiles.map((file) => [file, file]));
      const manifest = createContentManifest({ markdownSources, mediaSources: placeholderMedia });
      const mediaImports = mediaFiles.map((file, index) => `import media${index} from ${JSON.stringify(`${normalizePath(file)}?url`)};`);
      const mediaVariables = new Map(mediaFiles.map((file, index) => [normalizePath(file).slice(normalizePath(file).indexOf("/content/blog/") + "/content/blog/".length), `media${index}`]));
      const serializedEntries = manifest.entries.map((entry) => entry.kind === "media"
        ? `{...${JSON.stringify(entry)},url:${mediaVariables.get(entry.relativePath)}}`
        : JSON.stringify(entry));
      return `${mediaImports.join("\n")}\nexport const contentManifest=Object.freeze({entries:Object.freeze([${serializedEntries.join(",")}])});`;
    }
  };
}

export default defineConfig({ plugins: [contentManifestPlugin()] });
