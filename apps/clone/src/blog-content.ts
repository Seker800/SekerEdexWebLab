function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

function inlineMarkup(value: string): string {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function renderSafeMarkdown(markdown: string): string {
  const blocks: string[] = [];
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];
  let listTag: "ul" | "ol" | null = null;
  let code: string[] | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) blocks.push(`<p>${inlineMarkup(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = (): void => {
    if (list.length > 0 && listTag) blocks.push(`<${listTag}>${list.map((item) => `<li>${inlineMarkup(item)}</li>`).join("")}</${listTag}>`);
    list = [];
    listTag = null;
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (code === null) code = [];
      else {
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
      }
      continue;
    }
    if (code !== null) {
      code.push(line);
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]!.length;
      blocks.push(`<h${level}>${inlineMarkup(heading[2]!)}</h${level}>`);
      continue;
    }
    const unorderedItem = /^[-*]\s+(.+)$/.exec(line);
    const orderedItem = /^\d+\.\s+(.+)$/.exec(line);
    if (unorderedItem || orderedItem) {
      flushParagraph();
      const nextListTag = orderedItem ? "ol" : "ul";
      if (listTag && listTag !== nextListTag) flushList();
      listTag = nextListTag;
      list.push((orderedItem ?? unorderedItem)![1]!);
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (code !== null) blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return blocks.join("\n");
}
