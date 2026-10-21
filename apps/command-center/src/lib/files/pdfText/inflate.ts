import { MAX_STREAM_BYTES } from './document';

/**
 * zlib (FlateDecode) with the browser's DecompressionStream, stopping past `maxBytes` so a
 * crafted file cannot expand into gigabytes. What was read is kept when a stream ends badly
 * (PDF writers often leave a stray byte after the data). A sibling of lib/files/inflate,
 * kept separate so the PDF reader and the spreadsheet reader download independently.
 */
export async function inflateZlib(
  data: Uint8Array,
  maxBytes = MAX_STREAM_BYTES,
): Promise<Uint8Array> {
  const Stream = (globalThis as { DecompressionStream?: typeof DecompressionStream })
    .DecompressionStream;
  if (!Stream) throw new Error('This browser cannot read PDF files.');
  const reader = new Blob([data.slice()]).stream().pipeThrough(new Stream('deflate')).getReader();
  const chunks: BlobPart[] = [];
  let total = 0;
  for (;;) {
    let result: Awaited<ReturnType<typeof reader.read>>;
    try {
      result = await reader.read();
    } catch (error) {
      if (total > 0) break;
      throw error;
    }
    if (result.done) break;
    total += result.value.byteLength;
    if (total > maxBytes) {
      void reader.cancel();
      throw new Error('This PDF is too large to read here.');
    }
    chunks.push(result.value);
  }
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}
