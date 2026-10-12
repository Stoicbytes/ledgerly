import { FileFormatError, type InflateRaw } from './zip';

/**
 * Raw-deflate decompression with the platform's built-in DecompressionStream (all current
 * browsers; Safari from 16.4). Phones without it are told to use a CSV export instead.
 */
export const inflateRaw: InflateRaw = async (data) => {
  const Stream = (globalThis as { DecompressionStream?: typeof DecompressionStream })
    .DecompressionStream;
  if (!Stream) {
    throw new FileFormatError('This browser cannot open .xlsx files. Download the CSV instead.');
  }
  const stream = new Blob([data.slice()]).stream().pipeThrough(new Stream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};
