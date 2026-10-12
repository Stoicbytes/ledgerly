import { safeUrl } from './parse';

/**
 * A small Markdown subset for text written in the dashboard: paragraphs, ### headings,
 * lists, > quotes, ``` code, **bold**, *italic*, `code` and [links](https://…). It
 * produces a tree that React renders as elements (never as HTML strings), and links
 * keep only https, mailto or this site's own paths.
 */
export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong' | 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'br' };

export type Block =
  | { type: 'p'; children: Inline[] }
  | { type: 'h'; level: 3 | 4; children: Inline[] }
  | { type: 'ul' | 'ol'; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'code'; text: string };

const LIST_ITEM = /^\s*(?:[-*•]|\d{1,3}[.)])\s+/;
const ORDERED = /^\s*\d{1,3}[.)]\s+/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.trim().startsWith('```')) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```'))
        code.push(lines[i++] ?? '');
      i += 1;
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'h',
        level: (heading[1] ?? '').length <= 2 ? 3 : 4,
        children: parseInline(heading[2] ?? ''),
      });
      i += 1;
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const ordered = ORDERED.test(line);
      const items: Inline[][] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i] ?? '')) {
        items.push(parseInline((lines[i] ?? '').replace(LIST_ITEM, '')));
        i += 1;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('>'))
        quote.push((lines[i++] ?? '').replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', children: parseInline(quote.join('\n')) });
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() &&
      !LIST_ITEM.test(lines[i] ?? '') &&
      !/^(#{1,4}\s|>|```)/.test(lines[i] ?? '')
    ) {
      paragraph.push((lines[i++] ?? '').trim());
    }
    blocks.push({ type: 'p', children: parseInline(paragraph.join('\n')) });
  }
  return blocks;
}

const TOKEN =
  /(\*\*[^*]+?\*\*|__[^_]+?__|\*[^*\s][^*]*?\*|_[^_\s][^_]*?_|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\n)/;

function linkHref(raw: string): string | null {
  if (/^\/(?!\/)[\w\-./#?=&%]*$/.test(raw)) return raw;
  return safeUrl(raw);
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  for (const part of text.split(TOKEN)) {
    if (!part) continue;
    if (part === '\n') out.push({ type: 'br' });
    else if (/^(\*\*|__).+\1$/s.test(part))
      out.push({ type: 'strong', children: parseInline(part.slice(2, -2)) });
    else if (/^([*_]).+\1$/s.test(part))
      out.push({ type: 'em', children: parseInline(part.slice(1, -1)) });
    else if (/^`.+`$/s.test(part)) out.push({ type: 'code', text: part.slice(1, -1) });
    else if (/^\[[^\]]+\]\([^)\s]+\)$/.test(part)) {
      const [, label = '', href = ''] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part) ?? [];
      const safe = linkHref(href);
      out.push(
        safe
          ? { type: 'link', href: safe, children: parseInline(label) }
          : { type: 'text', text: label },
      );
    } else out.push({ type: 'text', text: part });
  }
  return out;
}

const inlineText = (nodes: Inline[]): string =>
  nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'code') return node.text;
      if (node.type === 'br') return ' ';
      return inlineText(node.children);
    })
    .join('');

/** The words only (for meta descriptions and previews). */
export function toPlainText(source: string, max = 300): string {
  const text = parseMarkdown(source)
    .map((block) => {
      if (block.type === 'code') return block.text;
      if ('items' in block) return block.items.map(inlineText).join('; ');
      return inlineText(block.children);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : text;
}
