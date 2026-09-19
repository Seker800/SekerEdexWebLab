import MarkdownIt, { type Env, type MarkdownIt as MarkdownItInstance } from "markdown-it";
import { contentHash } from "./content-location.js";
import { resolveContentReference, type ContentTree } from "./content-tree.js";

export interface MarkdownRenderContext {
  readonly documentPath: string;
  readonly tree: ContentTree;
}

interface MarkdownEnvironment extends Env {
  context: MarkdownRenderContext;
  headingCounts: Map<string, number>;
}

function escapeAttribute(markdown: MarkdownItInstance, value: string): string {
  return markdown.utils.escapeHtml(value);
}

function renderContext(environment: Env | undefined): MarkdownRenderContext {
  const context = (environment as MarkdownEnvironment | undefined)?.context;
  if (!context) throw new Error("Markdown content renderer requires a content context");
  return context;
}

function externalProtocol(value: string): string | undefined {
  try {
    return new URL(value).protocol;
  } catch {
    return undefined;
  }
}

function decodeAnchorFragment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false });
const defaultLinkOpen = markdown.renderer.rules.link_open ?? ((tokens, index, options, _environment, renderer) => renderer.renderToken(tokens, index, options));
const defaultHeadingOpen = markdown.renderer.rules.heading_open ?? ((tokens, index, options, _environment, renderer) => renderer.renderToken(tokens, index, options));

function headingSlug(value: string): string {
  return value.normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "section";
}

markdown.renderer.rules.heading_open = (tokens, index, options, environment, renderer) => {
  const token = tokens[index]!;
  const markdownEnvironment = environment as MarkdownEnvironment;
  const base = headingSlug(tokens[index + 1]?.content ?? "");
  const occurrence = (markdownEnvironment.headingCounts.get(base) ?? 0) + 1;
  markdownEnvironment.headingCounts.set(base, occurrence);
  token.attrSet("id", occurrence === 1 ? base : `${base}-${occurrence}`);
  token.attrSet("tabindex", "-1");
  return defaultHeadingOpen(tokens, index, options, environment, renderer);
};

markdown.renderer.rules.link_open = (tokens, index, options, environment, renderer) => {
  const token = tokens[index]!;
  const href = String(token.attrGet("href") ?? "");
  const protocol = externalProtocol(href);
  if (href.startsWith("#")) {
    token.attrSet("data-content-anchor", decodeAnchorFragment(href.slice(1)));
    return defaultLinkOpen(tokens, index, options, environment, renderer);
  }
  if ((/^\/(?!\/)/u).test(href)) {
    return defaultLinkOpen(tokens, index, options, environment, renderer);
  }
  if (protocol === "http:" || protocol === "https:" || protocol === "mailto:") {
    if (protocol !== "mailto:") {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
    }
    return defaultLinkOpen(tokens, index, options, environment, renderer);
  }
  const context = renderContext(environment);
  const target = resolveContentReference(context.tree, context.documentPath, href);
  if (target?.kind === "document") {
    token.attrSet("href", contentHash(target.relativePath));
    token.attrSet("data-content-path", target.relativePath);
  } else {
    token.attrSet("href", "#");
    token.attrSet("class", "content-reference--missing");
    token.attrSet("aria-disabled", "true");
  }
  return defaultLinkOpen(tokens, index, options, environment, renderer);
};

markdown.renderer.rules.image = (tokens, index, _options, environment) => {
  const token = tokens[index]!;
  const source = String(token.attrGet("src") ?? "");
  const alt = token.content.trim();
  const context = renderContext(environment);
  const target = resolveContentReference(context.tree, context.documentPath, source);
  if (target?.kind !== "media" || alt === "") {
    const label = alt === "" ? "Image requires alt text" : `Missing image: ${alt}`;
    const className = alt === "" ? "content-image--invalid" : "content-reference--missing";
    return `<span class="${className}" role="note">${escapeAttribute(markdown, label)}</span>`;
  }
  const contentPath = escapeAttribute(markdown, target.relativePath);
  if (tokens[index - 1]?.type === "link_open") {
    return `<img src="${escapeAttribute(markdown, target.url)}" alt="${escapeAttribute(markdown, alt)}" loading="lazy" decoding="async">`;
  }
  return `<button type="button" class="content-image" data-content-path="${contentPath}" aria-label="Open image: ${escapeAttribute(markdown, alt)}"><img src="${escapeAttribute(markdown, target.url)}" alt="${escapeAttribute(markdown, alt)}" loading="lazy" decoding="async"></button>`;
};

export function renderContentMarkdown(source: string, context: MarkdownRenderContext): string {
  return markdown.render(source, { context, headingCounts: new Map() } satisfies MarkdownEnvironment);
}
