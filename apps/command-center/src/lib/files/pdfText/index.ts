import { readContent, type ContentResult } from './content';
import { PdfDocument, type Inflate } from './document';
import { toLines, type TextLine } from './lines';
import type { Subtle } from './security';
import { Dict, nameOf, Stream } from './syntax';

export { NotPdf, PasswordNeeded, type Inflate } from './document';
export { inflateZlib } from './inflate';
export type { TextLine, TextWord } from './lines';
export { UnsupportedEncryption, type Subtle } from './security';

/** Payslips are a page or two; a combined file of a few years still fits. */
const MAX_PAGES = 60;

export type PdfText = {
  /** Lines of text per page. */
  pages: TextLine[][];
  /** Images drawn, so a page with images and no text reads as a scan. */
  images: number;
  /** Page content that could not be decoded (an unsupported compression). */
  unreadable: number;
};

export type ExtractOptions = {
  inflate: Inflate;
  /** WebCrypto, for AES-encrypted files. */
  subtle?: Subtle;
  /** The password to open the file; used for this call only and never kept. */
  password?: string;
};

/** Pages in order, each with the resources it inherits from the page tree. */
function collectPages(doc: PdfDocument) {
  const pages: { page: Dict; resources: Dict | null }[] = [];
  const seen = new Set<Dict>();
  const walk = (node: Dict | null, resources: Dict | null) => {
    if (!node || seen.has(node) || pages.length >= MAX_PAGES) return;
    seen.add(node);
    const own = doc.dict(node.get('Resources')) ?? resources;
    if (nameOf(node.get('Type')) === 'Page' || !node.get('Kids')) {
      pages.push({ page: node, resources: own });
      return;
    }
    const kids = doc.resolve(node.get('Kids'));
    for (const kid of Array.isArray(kids) ? kids : []) walk(doc.dict(kid), own);
  };
  walk(doc.dict(doc.dict(doc.trailer.get('Root'))?.get('Pages')), null);
  return pages;
}

/**
 * The text of a PDF with positions, read on this device. Throws PasswordNeeded when the
 * file is protected (or the password is wrong), NotPdf, or UnsupportedEncryption.
 */
export async function extractPdfText(bytes: Uint8Array, options: ExtractOptions): Promise<PdfText> {
  const doc = await PdfDocument.open(
    bytes,
    options.inflate,
    options.password ?? '',
    options.subtle,
  );
  const result: PdfText = { pages: [], images: 0, unreadable: 0 };
  for (const [index, { page, resources }] of collectPages(doc).entries()) {
    const contents = doc.resolve(page.get('Contents'));
    const streams = (Array.isArray(contents) ? contents : [contents]).map((item) =>
      doc.resolve(item),
    );
    const parts: Uint8Array[] = [];
    for (const stream of streams) {
      if (!(stream instanceof Stream)) continue;
      const bytes = await doc.streamBytes(stream).catch(() => null);
      if (bytes) parts.push(bytes);
      else result.unreadable += 1;
    }
    // A page's content streams are one stream split at token boundaries.
    const data = new Uint8Array(parts.reduce((total, part) => total + part.length + 1, 0));
    let at = 0;
    for (const part of parts) {
      data.set(part, at);
      data[at + part.length] = 10;
      at += part.length + 1;
    }
    const content: ContentResult = await readContent(doc, data, resources);
    result.images += content.images;
    result.pages.push(toLines(content.runs, index));
  }
  return result;
}
