import type * as SampleData from './sampleData';

/**
 * The preview's sample data is loaded with import() only in preview mode, so signed-in
 * users never download it. Stores read it through `samples()`: until it has loaded they
 * start empty.
 */
export type Samples = typeof SampleData;

let loaded: Samples | null = null;
let pending: Promise<Samples> | null = null;

export const samples = (): Samples | null => loaded;

/** Tests hand the module over directly, so stores start with sample data as before. */
export function provideSamples(module: Samples) {
  loaded = module;
}

export function loadSamples(): Promise<Samples> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= import('./sampleData').then(
    (module) => (loaded = module),
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}
