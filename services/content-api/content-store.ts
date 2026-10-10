import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const relativePath = z.string().min(1).max(400).refine((value) => {
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  return value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}, "Invalid relative path");
const common = z.object({
  relativePath,
  title: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).max(1_000_000),
  status: z.enum(["draft", "published"])
}).strict();
const documentInput = common.extend({
  kind: z.literal("document"),
  summary: z.string().max(500),
  markdown: z.string().max(1_000_000),
  publishedAt: z.iso.date(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30)
}).strict();
const linkInput = common.extend({
  kind: z.literal("link"),
  summary: z.string().max(500),
  href: z.url().refine((value) => new URL(value).protocol === "https:", "Only HTTPS links are supported")
}).strict();
const mediaInput = common.extend({
  kind: z.literal("media"),
  alt: z.string().trim().min(1).max(500),
  mediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm"]),
  storageKey: z.uuid()
}).strict();
export const contentInput = z.discriminatedUnion("kind", [documentInput, linkInput, mediaInput]);
export type ContentInput = z.infer<typeof contentInput>;
export type ContentItem = ContentInput & { readonly id: string };

interface ContentRow {
  id: string;
  kind: ContentInput["kind"];
  relative_path: string;
  title: string;
  summary: string | null;
  markdown: string | null;
  published_at: string | null;
  tags_json: string | null;
  href: string | null;
  alt: string | null;
  media_type: string | null;
  storage_key: string | null;
  sort_order: number;
  status: ContentInput["status"];
}

function fromRow(row: ContentRow): ContentItem {
  const base = { id: row.id, relativePath: row.relative_path, title: row.title, sortOrder: row.sort_order, status: row.status };
  if (row.kind === "document") return { ...base, kind: "document", summary: row.summary!, markdown: row.markdown!, publishedAt: row.published_at!, tags: JSON.parse(row.tags_json!) as string[] };
  if (row.kind === "link") return { ...base, kind: "link", summary: row.summary!, href: row.href! };
  return { ...base, kind: "media", alt: row.alt!, mediaType: row.media_type! as Extract<ContentInput, { kind: "media" }>["mediaType"], storageKey: row.storage_key! };
}

export class ContentStore {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(databasePath);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS content_items (id TEXT PRIMARY KEY, kind TEXT NOT NULL, relative_path TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT, markdown TEXT, published_at TEXT, tags_json TEXT, href TEXT, alt TEXT, media_type TEXT, storage_key TEXT, sort_order INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','published'))); CREATE INDEX IF NOT EXISTS content_public_order ON content_items(status, sort_order, relative_path);");
  }

  create(value: ContentInput): ContentItem {
    const input = contentInput.parse(value);
    const id = randomUUID();
    this.db.prepare("INSERT INTO content_items (id,kind,relative_path,title,summary,markdown,published_at,tags_json,href,alt,media_type,storage_key,sort_order,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, input.kind, input.relativePath, input.title,
        "summary" in input ? input.summary : null,
        input.kind === "document" ? input.markdown : null,
        input.kind === "document" ? input.publishedAt : null,
        input.kind === "document" ? JSON.stringify(input.tags) : null,
        input.kind === "link" ? input.href : null,
        input.kind === "media" ? input.alt : null,
        input.kind === "media" ? input.mediaType : null,
        input.kind === "media" ? input.storageKey : null,
        input.sortOrder, input.status);
    return { id, ...input };
  }

  get(id: string): ContentItem | undefined {
    const row = this.db.prepare("SELECT * FROM content_items WHERE id=?").get(id) as unknown as ContentRow | undefined;
    return row && fromRow(row);
  }

  update(id: string, patch: Partial<ContentInput>): ContentItem | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const { id: _id, ...current } = existing;
    const input = contentInput.parse({ ...current, ...patch });
    this.db.prepare("UPDATE content_items SET relative_path=?,title=?,summary=?,markdown=?,published_at=?,tags_json=?,href=?,alt=?,media_type=?,sort_order=?,status=? WHERE id=?")
      .run(input.relativePath, input.title,
        "summary" in input ? input.summary : null,
        input.kind === "document" ? input.markdown : null,
        input.kind === "document" ? input.publishedAt : null,
        input.kind === "document" ? JSON.stringify(input.tags) : null,
        input.kind === "link" ? input.href : null,
        input.kind === "media" ? input.alt : null,
        input.kind === "media" ? input.mediaType : null,
        input.sortOrder, input.status, id);
    return { id, ...input };
  }

  delete(id: string): ContentItem | undefined {
    const item = this.get(id);
    if (item) this.db.prepare("DELETE FROM content_items WHERE id=?").run(id);
    return item;
  }

  all(): ContentItem[] {
    return (this.db.prepare("SELECT * FROM content_items ORDER BY sort_order, relative_path").all() as unknown as ContentRow[]).map(fromRow);
  }

  publicEntries(): ContentItem[] {
    return (this.db.prepare("SELECT * FROM content_items WHERE status='published' ORDER BY sort_order, relative_path").all() as unknown as ContentRow[]).map(fromRow);
  }

  close(): void { this.db.close(); }
}
