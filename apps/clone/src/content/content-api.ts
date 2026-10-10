import { z } from "zod";
import { buildContentTree } from "./content-tree.js";
import type { ContentEntry, ContentManifest, ContentSourceDescriptor } from "./content-model.js";

const safePath = z.string().min(1).max(400).refine((value) => !value.startsWith("/") && !value.includes("\\") && !value.includes("\0") && value.split("/").every((part) => part !== "" && part !== "." && part !== ".."));
const base = z.object({ relativePath: safePath, sortOrder: z.number().int().min(0).max(1_000_000) });
const entrySchema = z.discriminatedUnion("kind", [
  base.extend({ kind: z.literal("document"), title: z.string().min(1), summary: z.string(), publishedAt: z.iso.date(), tags: z.array(z.string()), markdown: z.string() }).strict(),
  base.extend({ kind: z.literal("link"), title: z.string().min(1), summary: z.string(), href: z.url().refine((value) => new URL(value).protocol === "https:") }).strict(),
  base.extend({ kind: z.literal("media"), url: z.string().regex(/^\/api\/v1\/media\/[a-f\d-]{36}$/iu, "Content media URL is invalid"), mediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm"]), alt: z.string().min(1) }).strict()
]);
const responseSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.object({ schemaVersion: z.literal(1), id: z.string().min(1), kind: z.literal("author"), visibility: z.literal("public"), defaultLicense: z.string().min(1) }).strict(),
  entries: z.array(entrySchema)
}).strict();

export function normalizeContentApiOrigin(value: string): string {
  const origin = new URL(value);
  const local = origin.hostname === "localhost" || origin.hostname === "127.0.0.1";
  if (origin.protocol !== "https:" && !(local && origin.protocol === "http:")) throw new Error("Content API requires HTTPS outside localhost.");
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Content API setting must be an origin without credentials or path.");
  return origin.origin;
}

export async function fetchContentApi(apiOrigin: string, fetcher: typeof fetch = fetch): Promise<{ source: ContentSourceDescriptor; manifest: ContentManifest }> {
  const origin = normalizeContentApiOrigin(apiOrigin);
  const response = await fetcher(`${origin}/api/v1/content`, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error(`Content API request failed with ${response.status}.`);
  const parsed = responseSchema.parse(await response.json());
  const entries: ContentEntry[] = parsed.entries.map((entry) => {
    if (entry.kind !== "media") return entry;
    const mediaUrl = new URL(entry.url, origin);
    if (mediaUrl.origin !== origin) throw new Error("Content media URL escapes its API origin.");
    return { ...entry, url: mediaUrl.href };
  });
  buildContentTree(entries);
  return Object.freeze({ source: Object.freeze(parsed.source), manifest: Object.freeze({ entries: Object.freeze(entries) }) });
}
