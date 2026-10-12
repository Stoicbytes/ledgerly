import type { Series } from '@/lib/domain/investments';
import { callRpc, RpcError } from './rpc';

/**
 * The index fund the signed-in user compares their shares with (migration 0014), and its
 * daily NAVs from the server's market tables. The NAVs come from AMFI through the
 * market-refresh function; the app never fetches them from outside.
 */
export type Benchmark = {
  schemeCode: number;
  name: string;
  category: string;
  history: Series;
};

type Row = Record<string, unknown>;

const str = (value: unknown) => (typeof value === 'string' ? value : '');

export function benchmarkFromRemote(raw: Row | null): Benchmark | null {
  if (!raw || typeof raw !== 'object' || !Number(raw.scheme_code)) return null;
  const points = Array.isArray(raw.history) ? raw.history : [];
  const history = points.flatMap((point): Series => {
    if (!Array.isArray(point)) return [];
    const date = str(point[0]).slice(0, 10);
    const nav = Number(point[1]);
    return date && Number.isFinite(nav) && nav > 0 ? [[date, nav]] : [];
  });
  return {
    schemeCode: Number(raw.scheme_code),
    name: str(raw.name),
    category: str(raw.category),
    history,
  };
}

/** True when the database does not have the benchmark functions yet (migration 0014). */
export const benchmarkMissing = (error: unknown) =>
  error instanceof RpcError && error.status === 404;

export async function loadBenchmark(): Promise<Benchmark | null> {
  return benchmarkFromRemote(await callRpc<Row | null>('load_stock_benchmark'));
}

/** Chooses the index fund (null clears the choice). */
export async function setBenchmark(schemeCode: number | null): Promise<void> {
  await callRpc('set_stock_benchmark', { p_scheme_code: schemeCode });
}
