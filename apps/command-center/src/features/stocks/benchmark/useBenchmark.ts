import { useCallback, useEffect, useState } from 'react';
import { useMarketStore } from '@/features/investments/state/marketStore';
import {
  benchmarkMissing,
  loadBenchmark,
  setBenchmark,
  type Benchmark,
} from '@/lib/data/benchmarkRepository';

export type BenchmarkState =
  | { status: 'preview' }
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; benchmark: Benchmark | null };

async function fetchState(): Promise<BenchmarkState> {
  try {
    return { status: 'ready', benchmark: await loadBenchmark() };
  } catch (error) {
    return { status: benchmarkMissing(error) ? 'missing' : 'error' };
  }
}

/** The chosen index fund and its NAVs, loaded when the sheet opens (signed in only). */
export function useBenchmark() {
  const mode = useMarketStore((state) => state.mode);
  const [state, setState] = useState<BenchmarkState>({ status: 'loading' });

  useEffect(() => {
    if (mode !== 'cloud') return undefined;
    let live = true;
    void fetchState().then((next) => live && setState(next));
    return () => {
      live = false;
    };
  }, [mode]);

  const reload = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchState());
  }, []);

  /** Saves the choice and loads its NAVs; returns false when it could not be saved. */
  const choose = useCallback(
    async (schemeCode: number) => {
      try {
        await setBenchmark(schemeCode);
      } catch (error) {
        setState({ status: benchmarkMissing(error) ? 'missing' : 'error' });
        return false;
      }
      await reload();
      return true;
    },
    [reload],
  );

  /** Asks the server for new prices (which also fetches the fund's older NAVs), then reloads. */
  const fetchHistory = useCallback(async () => {
    const message = await useMarketStore.getState().refresh();
    await reload();
    return message;
  }, [reload]);

  return {
    state: mode === 'cloud' ? state : ({ status: 'preview' } as const),
    reload,
    choose,
    fetchHistory,
  };
}
