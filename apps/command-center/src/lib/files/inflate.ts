import { FileFormatError, TOO_LARGE, type InflateRaw } from './zip';

/**
 * Raw-deflate decompression with the platform's built-in DecompressionStream (all current
 * browsers; Safari from 16.4). Phones without it are told to use a CSV export instead.
 * Reading stops as soon as the output passes `maxBytes`, so a small crafted file cannot
 * expand into gigabytes and freeze the tab.
 */
export const inflateRaw: InflateRaw = async (data, maxBytes) => {
  const Stream = (globalThis as { DecompressionStream?: typeof DecompressionStream })
    .DecompressionStream;
  if (!Stream) {
    throw new FileFormatError('This browser cannot open .xlsx files. Download the CSV instead.');
  }
  const reader = new Blob([data.slice()])
    .stream()
    .pipeThrough(new Stream('deflate-raw'))
    .getReader();
  const chunks: BlobPart[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      void reader.cancel();
      throw new FileFormatError(TOO_LARGE);
    }
    chunks.push(value);
  }
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
};
