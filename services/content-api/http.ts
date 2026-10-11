import { createReadStream } from "node:fs";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
import { z } from "zod";
import { ContentStore, contentInput, type ContentItem } from "./content-store.js";

export interface ContentHttpOptions {
  readonly store: ContentStore;
  readonly mediaRoot: string;
  readonly allowedOrigins: readonly string[];
  readonly adminOrigin: string;
  readonly adminUsername: string;
  readonly adminPasswordHash: string;
  readonly requireHttps: boolean;
}

const maximumJsonBytes = 1_100_000;
const maximumMediaBytes = 250 * 1024 * 1024;
const mediaExtensions: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
  "image/avif": ".avif", "video/mp4": ".mp4", "video/webm": ".webm"
};
const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/iu;

function send(response: ServerResponse, status: number, body: unknown): void {
  const data = Buffer.from(JSON.stringify(body));
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": data.length });
  response.end(data);
}

function fail(response: ServerResponse, status: number, message: string): void { send(response, status, { error: message }); }

async function readLimited(request: IncomingMessage, maximum: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const part of request) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    total += chunk.length;
    if (total > maximum) throw new HttpError(413, "Request body is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json") throw new HttpError(415, "JSON is required");
  const data = await readLimited(request, maximumJsonBytes);
  try { return JSON.parse(data.toString("utf8")) as unknown; }
  catch { throw new HttpError(400, "Invalid JSON"); }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function hashAdminPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  if (password.length < 16) throw new Error("Admin password must have at least 16 characters");
  return `${salt}:${scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex")}`;
}

function checkPassword(password: string, encoded: string): boolean {
  const [salt, digest] = encoded.split(":");
  if (!salt || !digest || !/^[a-f\d]{32}$/iu.test(salt) || !/^[a-f\d]{128}$/iu.test(digest)) throw new Error("Invalid admin password hash configuration");
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, "hex"), 64), Buffer.from(digest, "hex"));
}

function authorized(request: IncomingMessage, options: ContentHttpOptions): boolean {
  const value = request.headers.authorization;
  if (!value?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  return decoded.slice(0, separator) === options.adminUsername && checkPassword(decoded.slice(separator + 1), options.adminPasswordHash);
}

function assertAdminMutationOrigin(request: IncomingMessage, options: ContentHttpOptions): void {
  if (request.headers.origin !== options.adminOrigin) throw new HttpError(403, "Admin origin is not allowed");
}

function decodedUploadHeader(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  try { return decodeURIComponent(value); }
  catch { throw new HttpError(400, "Invalid media metadata encoding"); }
}

function mediaSignatureMatches(data: Buffer, mediaType: string): boolean {
  if (mediaType === "image/jpeg") return data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mediaType === "image/png") return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mediaType === "image/gif") return ["GIF87a", "GIF89a"].includes(data.toString("ascii", 0, 6));
  if (mediaType === "image/webp") return data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  if (mediaType === "image/avif") return data.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(data.toString("ascii", 8, 12));
  if (mediaType === "video/mp4") return data.toString("ascii", 4, 8) === "ftyp";
  if (mediaType === "video/webm") return data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

function publicEntry(item: ContentItem): Record<string, unknown> {
  if (item.kind === "document") return { kind: "document", relativePath: item.relativePath, title: item.title, summary: item.summary, publishedAt: item.publishedAt, tags: item.tags, markdown: item.markdown, sortOrder: item.sortOrder };
  if (item.kind === "link") return { kind: "link", relativePath: item.relativePath, title: item.title, summary: item.summary, href: item.href, sortOrder: item.sortOrder };
  return { kind: "media", relativePath: item.relativePath, url: `/api/v1/media/${item.id}`, mediaType: item.mediaType, alt: item.alt, sortOrder: item.sortOrder };
}

async function sendMedia(request: IncomingMessage, response: ServerResponse, options: ContentHttpOptions, id: string): Promise<void> {
  const item = options.store.get(id);
  if (!item || item.kind !== "media" || item.status !== "published") throw new HttpError(404, "Media not found");
  const file = path.join(options.mediaRoot, item.storageKey);
  let size: number;
  try { size = (await stat(file)).size; }
  catch { throw new HttpError(404, "Media not found"); }
  const range = request.headers.range;
  let start = 0;
  let end = size - 1;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/u.exec(range);
    if (!match) throw new HttpError(416, "Unsupported range");
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= size) throw new HttpError(416, "Invalid range");
  }
  response.writeHead(range ? 206 : 200, {
    "Content-Type": item.mediaType, "Content-Length": end - start + 1,
    "Accept-Ranges": "bytes", "Cache-Control": "no-store",
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {})
  });
  createReadStream(file, { start, end }).pipe(response);
}

export function createContentHandler(options: ContentHttpOptions): RequestListener {
  const allowed = new Set(options.allowedOrigins);
  const failedAdminAuth = new Map<string, { count: number; expiresAt: number }>();
  return (request, response) => {
    void (async () => {
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Vary", "Origin");
      const url = new URL(request.url ?? "/", "http://internal.invalid");
      const origin = request.headers.origin;
      if (origin && allowed.has(origin) && (url.pathname === "/api/v1/content" || url.pathname.startsWith("/api/v1/media/"))) {
        response.setHeader("Access-Control-Allow-Origin", origin);
      }
      if (url.pathname === "/health/live" && request.method === "GET") return send(response, 200, { status: "ok" });
      if (options.requireHttps && request.headers["x-forwarded-proto"] !== "https") throw new HttpError(403, "HTTPS is required");
      if (url.pathname === "/api/v1/content" && request.method === "GET") {
        return send(response, 200, { schemaVersion: 1, source: { schemaVersion: 1, id: "seker-content", kind: "author", visibility: "public", defaultLicense: "All rights reserved" }, entries: options.store.publicEntries().map(publicEntry) });
      }
      const mediaMatch = /^\/api\/v1\/media\/([a-f\d-]+)$/iu.exec(url.pathname);
      if (mediaMatch && request.method === "GET" && uuidPattern.test(mediaMatch[1]!)) return sendMedia(request, response, options, mediaMatch[1]!);

      const adminRoute = url.pathname === "/admin" || url.pathname === "/admin/app.js" || url.pathname === "/admin/style.css" || url.pathname.startsWith("/api/v1/admin/");
      if (!adminRoute) throw new HttpError(404, "Not found");
      const peer = request.socket.remoteAddress ?? "unknown";
      const now = Date.now();
      const previous = failedAdminAuth.get(peer);
      if (previous && previous.expiresAt <= now) failedAdminAuth.delete(peer);
      const current = failedAdminAuth.get(peer);
      if (current && current.count >= 9) throw new HttpError(429, "Too many authentication attempts");
      if (!authorized(request, options)) {
        failedAdminAuth.set(peer, { count: (current?.count ?? 0) + 1, expiresAt: now + 15 * 60_000 });
        if (failedAdminAuth.size > 10_000) failedAdminAuth.delete(failedAdminAuth.keys().next().value!);
        response.setHeader("WWW-Authenticate", 'Basic realm="Seker Content", charset="UTF-8"');
        throw new HttpError(401, "Authentication required");
      }
      failedAdminAuth.delete(peer);
      if (url.pathname === "/admin" && request.method === "GET") {
        response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'");
        const html = await readFile(path.join(import.meta.dirname, "admin.html"));
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(html); return;
      }
      if (url.pathname === "/admin/app.js" && request.method === "GET") {
        const script = await readFile(path.join(import.meta.dirname, "admin.js"));
        response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" }); response.end(script); return;
      }
      if (url.pathname === "/admin/style.css" && request.method === "GET") {
        const style = await readFile(path.join(import.meta.dirname, "style.css"));
        response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" }); response.end(style); return;
      }
      if (url.pathname === "/api/v1/admin/items" && request.method === "GET") return send(response, 200, { items: options.store.all() });
      if (request.method !== "GET") assertAdminMutationOrigin(request, options);
      if (url.pathname === "/api/v1/admin/items" && request.method === "POST") {
        const input = contentInput.parse(await readJson(request));
        if (input.kind === "media") throw new HttpError(400, "Use the media upload endpoint");
        return send(response, 201, options.store.create(input));
      }
      const itemMatch = /^\/api\/v1\/admin\/items\/([a-f\d-]+)$/iu.exec(url.pathname);
      if (itemMatch && uuidPattern.test(itemMatch[1]!)) {
        const id = itemMatch[1]!;
        if (request.method === "PATCH") {
          const patch = z.record(z.string(), z.unknown()).parse(await readJson(request));
          if ("kind" in patch || "storageKey" in patch || "id" in patch) throw new HttpError(400, "Immutable item field");
          const updated = options.store.update(id, patch);
          if (!updated) throw new HttpError(404, "Item not found");
          return send(response, 200, updated);
        }
        if (request.method === "DELETE") {
          const deleted = options.store.delete(id);
          if (!deleted) throw new HttpError(404, "Item not found");
          if (deleted.kind === "media") await rm(path.join(options.mediaRoot, deleted.storageKey), { force: true });
          return send(response, 200, { deleted: id });
        }
      }
      if (url.pathname === "/api/v1/admin/media" && request.method === "POST") {
        const mediaType = request.headers["content-type"]?.split(";")[0] ?? "";
        if (!(mediaType in mediaExtensions)) throw new HttpError(415, "Unsupported media type");
        const input = contentInput.parse({ kind: "media", relativePath: decodedUploadHeader(request.headers["x-content-path"]), title: decodedUploadHeader(request.headers["x-content-title"]), alt: decodedUploadHeader(request.headers["x-content-alt"]), mediaType, storageKey: randomUUID(), sortOrder: Number(request.headers["x-content-sort-order"] ?? 0), status: "draft" });
        if (input.kind !== "media" || !input.relativePath.toLowerCase().endsWith(mediaExtensions[mediaType]!)) throw new HttpError(400, "Media path extension does not match type");
        const data = await readLimited(request, maximumMediaBytes);
        if (data.length === 0 || !mediaSignatureMatches(data, mediaType)) throw new HttpError(415, "Media signature does not match its type");
        await mkdir(options.mediaRoot, { recursive: true, mode: 0o700 });
        const temporary = path.join(options.mediaRoot, `${input.storageKey}.tmp`);
        const destination = path.join(options.mediaRoot, input.storageKey);
        const file = await open(temporary, "wx", 0o600);
        try { await file.writeFile(data); } finally { await file.close(); }
        try { await rename(temporary, destination); return send(response, 201, options.store.create(input)); }
        catch (error) { await rm(temporary, { force: true }); await rm(destination, { force: true }); throw error; }
      }
      throw new HttpError(404, "Not found");
    })().catch((error: unknown) => {
      if (response.headersSent) { response.destroy(); return; }
      if (error instanceof HttpError) return fail(response, error.status, error.message);
      if (error instanceof z.ZodError) return fail(response, 400, "Invalid content data");
      if (error instanceof Error && /UNIQUE constraint failed|Content path collision/u.test(error.message)) return fail(response, 409, "Content path collision");
      if (error instanceof Error && /immutable/u.test(error.message)) return fail(response, 400, "Immutable item field");
      console.error("Content API request failed", error instanceof Error ? error.name : "unknown");
      fail(response, 500, "Internal server error");
    });
  };
}
