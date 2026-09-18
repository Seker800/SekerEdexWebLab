import { z } from "zod";

export interface BlogDocument {
  relativePath: string;
  title: string;
  summary: string;
  publishedAt: string;
  tags: readonly string[];
  markdown: string;
}

const frontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  publishedAt: z.iso.date(),
  tags: z.array(z.string().min(1))
}).strict();

const markdownModules = import.meta.glob("../../../content/blog/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default"
}) as Readonly<Record<string, string>>;

function parseFrontmatter(sourcePath: string, source: string): Omit<BlogDocument, "relativePath"> {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(source.replaceAll("\r\n", "\n"));
  if (!match) throw new Error(`Blog document is missing frontmatter: ${sourcePath}`);

  const fields: Record<string, unknown> = {};
  for (const line of match[1]!.split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`Invalid blog frontmatter line in ${sourcePath}: ${line}`);
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    fields[key] = key === "tags"
      ? rawValue.split(",").map((tag) => tag.trim()).filter(Boolean)
      : rawValue;
  }

  const metadata = frontmatterSchema.parse(fields);
  return { ...metadata, markdown: match[2]!.trim() };
}

export const blogDocuments: readonly BlogDocument[] = Object.entries(markdownModules)
  .map(([sourcePath, source]) => ({
    relativePath: sourcePath.slice(sourcePath.indexOf("/content/blog/") + "/content/blog/".length),
    ...parseFrontmatter(sourcePath, source)
  }))
  .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
