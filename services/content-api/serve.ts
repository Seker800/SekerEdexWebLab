import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ContentStore } from "./content-store.js";
import { createContentHandler, type ContentHttpOptions } from "./http.js";

export interface ContentServiceConfiguration extends Omit<ContentHttpOptions, "store" | "mediaRoot"> {
  readonly dataDirectory: string;
  readonly listenHost: string;
  readonly port: number;
}

function exactOrigin(value: string, label: string, allowLocalHttp: boolean): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(`${label} must be an exact origin`); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !(allowLocalHttp && local && url.protocol === "http:"))) {
    throw new Error(`${label} must be an HTTPS origin without credentials or path`);
  }
  return url.origin;
}

export function contentServiceConfiguration(environment: Record<string, string | undefined>): ContentServiceConfiguration {
  const dataDirectory = environment.CONTENT_DATA_DIR?.trim();
  if (!dataDirectory || !path.isAbsolute(dataDirectory) || dataDirectory === path.parse(dataDirectory).root) throw new Error("CONTENT_DATA_DIR must be a dedicated absolute directory");
  const adminUsername = environment.CONTENT_ADMIN_USERNAME?.trim();
  if (!adminUsername || !/^[a-z0-9_-]{3,40}$/iu.test(adminUsername)) throw new Error("CONTENT_ADMIN_USERNAME is invalid");
  const adminPasswordHash = environment.CONTENT_ADMIN_PASSWORD_HASH?.trim();
  if (!adminPasswordHash || !/^[a-f\d]{32}:[a-f\d]{128}$/iu.test(adminPasswordHash)) throw new Error("CONTENT_ADMIN_PASSWORD_HASH is required and must be a scrypt hash");
  const listenHost = environment.CONTENT_LISTEN_HOST?.trim() || "127.0.0.1";
  const requireHttps = environment.CONTENT_REQUIRE_HTTPS !== "false";
  if (!requireHttps && !["127.0.0.1", "localhost"].includes(listenHost)) throw new Error("HTTPS may only be disabled for loopback development");
  const adminOrigin = exactOrigin(environment.CONTENT_ADMIN_ORIGIN?.trim() || "", "Admin origin", !requireHttps);
  const origins = environment.CONTENT_PUBLIC_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];
  if (origins.length === 0 || origins.length > 20) throw new Error("At least one explicit public frontend origin is required");
  const allowedOrigins = [...new Set(origins.map((origin) => exactOrigin(origin, "Public frontend origin", !requireHttps)))];
  const port = Number(environment.CONTENT_PORT ?? "4175");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("CONTENT_PORT is invalid");
  return { dataDirectory, listenHost, port, requireHttps, adminOrigin, adminUsername, adminPasswordHash, allowedOrigins };
}

async function main(): Promise<void> {
  const configuration = contentServiceConfiguration(process.env);
  const store = new ContentStore(path.join(configuration.dataDirectory, "content.sqlite"));
  const server = createServer(createContentHandler({ ...configuration, store, mediaRoot: path.join(configuration.dataDirectory, "media") }));
  server.listen(configuration.port, configuration.listenHost, () => {
    console.log(`Content API listening on ${configuration.listenHost}:${configuration.port}`);
  });
  const stop = (): void => { server.close(() => { store.close(); process.exitCode = 0; }); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Content API failed to start"); process.exitCode = 1; });
}
