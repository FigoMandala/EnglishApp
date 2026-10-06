export type Span = { text: string; tone: "plain" | "bold" | "code" };

export type Block =
  | { kind: "heading"; level: 2 | 3; spans: Span[] }
  | { kind: "paragraph"; spans: Span[] }
  | { kind: "list"; ordered: boolean; items: Span[][] };

const INLINE = /(`[^`\n]+`|\*\*(?!\s)[^*\n]+?(?<!\s)\*\*)/g;
const BULLET = /^\s*[-*]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^(#{2,3})\s+(.*)$/;

export function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    if (match.index > cursor) spans.push({ text: text.slice(cursor, match.index), tone: "plain" });
    if (token.startsWith("`")) spans.push({ text: token.slice(1, -1), tone: "code" });
    else spans.push({ text: token.slice(2, -2), tone: "bold" });
    cursor = match.index + token.length;
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor), tone: "plain" });
  return spans.length ? spans : [{ text, tone: "plain" }];
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  function flush() {
    if (!paragraph.length) return;
    blocks.push({ kind: "paragraph", spans: parseInline(paragraph.join("\n")) });
    paragraph = [];
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        kind: "heading",
        level: heading[1].length as 2 | 3,
        spans: parseInline(heading[2].trim()),
      });
      continue;
    }

    const isBullet = BULLET.test(line);
    const isNumbered = !isBullet && NUMBERED.test(line);
    if (isBullet || isNumbered) {
      flush();
      const marker = isBullet ? BULLET : NUMBERED;
      const items: Span[][] = [];
      for (; i < lines.length && marker.test(lines[i]); i += 1) {
        items.push(parseInline(lines[i].replace(marker, "")));
      }
      i -= 1;
      blocks.push({ kind: "list", ordered: isNumbered, items });
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    paragraph.push(line);
  }

  flush();
  return blocks;
}
