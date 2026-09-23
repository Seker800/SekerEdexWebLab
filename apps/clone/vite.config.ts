import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, loadEnv, normalizePath, searchForWorkspaceRoot, type Plugin } from "vite";
import { createContentManifest, supportedContentMediaExtensions } from "./src/content/content-registry.js";
import { discoverContentFiles } from "./content-source-files.js";
import { loadContentSource, selectContentSource, type LoadedContentSource } from "./content-source.js";

const virtualModuleId = "virtual:content-manifest";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
const repositoryRoot = path.resolve(import.meta.dirname, "../..");

interface RuntimeContentPluginSource {
  readonly delivery: "runtime";
}

function contentRelativePath(contentRoot: string, file: string): string {
  return normalizePath(path.relative(contentRoot, file));
}

function isContentFile(contentRoot: string, file: string): boolean {
  const relative = path.relative(contentRoot, file);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function contentManifestPlugin(source: LoadedContentSource | string | RuntimeContentPluginSource = path.resolve(import.meta.dirname, "../../examples/blog")): Plugin {
  const runtime = typeof source === "object" && "delivery" in source;
  const contentRoot = runtime ? undefined : typeof source === "string" ? source : source.root;
  return {
    name: "seker-content-manifest",
    config(config) {
      if (!contentRoot) return undefined;
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
      if (contentRoot) server.watcher.add(contentRoot);
    },
    hotUpdate(options) {
      if (!contentRoot) return;
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
      if (runtime) {
        return `export const contentDelivery="runtime";\nexport const contentSource=Object.freeze({schemaVersion:1,id:"runtime-author",kind:"author",visibility:"public",defaultLicense:"All rights reserved"});\nexport const contentManifest=Object.freeze({entries:Object.freeze([])});`;
      }
      if (!contentRoot) throw new Error("Embedded content requires a content root.");
      const currentSource = typeof source === "string" ? undefined : await loadContentSource({
        repositoryRoot: source.repositoryRoot,
        contentRoot: source.root,
        expectedKind: source.expectedKind
      });
      const files = currentSource?.files ?? await discoverContentFiles(contentRoot);
      for (const file of files) this.addWatchFile(file);
      const markdownFiles = files.filter((file) => path.extname(file).toLocaleLowerCase() === ".md");
      const mediaFiles = files.filter((file) => supportedContentMediaExtensions.includes(path.extname(file).slice(1).toLocaleLowerCase()));
      const markdownSources = Object.fromEntries(await Promise.all(markdownFiles.map(async (file) => [contentRelativePath(contentRoot, file), await readFile(file, "utf8")] as const)));
      const placeholderMedia = Object.fromEntries(mediaFiles.map((file) => [contentRelativePath(contentRoot, file), file]));
      const manifest = createContentManifest({ markdownSources, mediaSources: placeholderMedia });
      const mediaImports = mediaFiles.map((file, index) => `import media${index} from ${JSON.stringify(`${normalizePath(file)}?url`)};`);
      const mediaVariables = new Map(mediaFiles.map((file, index) => [contentRelativePath(contentRoot, file), `media${index}`]));
      const serializedEntries = manifest.entries.map((entry) => entry.kind === "media"
        ? `{...${JSON.stringify(entry)},url:${mediaVariables.get(entry.relativePath)}}`
        : JSON.stringify(entry));
      const descriptor = currentSource?.descriptor ?? (typeof source === "string"
        ? { schemaVersion: 1, id: "legacy-content-source", kind: "sample", visibility: "public", defaultLicense: "unspecified" }
        : source.descriptor);
      return `${mediaImports.join("\n")}\nexport const contentDelivery="embedded";\nexport const contentSource=Object.freeze(${JSON.stringify(descriptor)});\nexport const contentManifest=Object.freeze({entries:Object.freeze([${serializedEntries.join(",")}])});`;
    }
  };
}

export default defineConfig(async ({ mode }) => {
  const environment = loadEnv(mode, repositoryRoot, "");
  const delivery = environment.SEKER_CONTENT_DELIVERY?.trim() || "embedded";
  if (delivery !== "embedded" && delivery !== "runtime") throw new Error(`Unsupported content delivery: ${delivery}`);
  if (delivery === "runtime") return { plugins: [contentManifestPlugin({ delivery: "runtime" })] };
  const configuredRoot = environment.SEKER_CONTENT_ROOT?.trim();
  const selection = selectContentSource(repositoryRoot, configuredRoot, environment.SEKER_CONTENT_PROFILE);
  const source = await loadContentSource({
    repositoryRoot,
    ...selection
  });
  return { plugins: [contentManifestPlugin(source)] };
});
