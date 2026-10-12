import { useState } from 'react';
import { View } from 'react-native';
import { ChartLine } from '@/components/icons';
import { Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import { useStocksView } from '@/features/investments/hooks/useInvestments';
import { FundSearch } from '@/features/mutual-funds/FundSearch';
import { compareWithIndex } from '@/lib/domain/investments';
import { useTheme } from '@/theme';
import { BenchmarkResult, dateText } from './BenchmarkResult';
import { useBenchmark } from './useBenchmark';

const SEARCH = 'nifty 50 index direct growth';

/**
 * Your shares against an index fund you choose (a Nifty 50 index fund to begin with), from
 * the fund's NAVs on the server. Needs migration 0014 when signed in.
 */
export function BenchmarkSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const { state, reload, choose, fetchHistory } = useBenchmark();
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { rows, totals, today } = useStocksView();

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      const message = await work();
      if (typeof message === 'string') setNotice(message);
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (state.status === 'preview') {
    body = (
      <Text color="textSecondary">
        The comparison uses an index fund&apos;s NAVs stored on the server, so it works when you are
        signed in.
      </Text>
    );
  } else if (state.status === 'loading') {
    body = <Text color="textSecondary">Loading…</Text>;
  } else if (state.status === 'missing') {
    body = (
      <Text color="textSecondary">
        This needs the database update 202610150014_stock_benchmark.sql. Run it in the Supabase SQL
        Editor (see SUPABASE_SETUP.md), then open this again.
      </Text>
    );
  } else if (state.status === 'error') {
    body = (
      <View style={{ gap: theme.space[3], alignItems: 'flex-start' }}>
        <Text color="textSecondary">The comparison could not be loaded.</Text>
        <Button label="Try again" variant="secondary" onPress={() => void reload()} />
      </View>
    );
  } else if (!state.benchmark || changing) {
    body = (
      <View style={{ gap: theme.space[3] }}>
        <Text color="textSecondary">
          Choose the index fund to compare with. A Nifty 50 index fund (direct plan, growth option)
          shows how your shares did against the Nifty 50, after the fund&apos;s small costs.
        </Text>
        <FundSearch
          initialQuery={SEARCH}
          noMatchText="No match. Try other words, like 'nifty 50 index'."
          onPick={(match) =>
            void run(async () => {
              if (await choose(match.schemeCode)) setChanging(false);
            })
          }
        />
        {changing ? (
          <Button
            label="Keep the current fund"
            variant="ghost"
            onPress={() => setChanging(false)}
          />
        ) : null}
      </View>
    );
  } else {
    const { benchmark } = state;
    const result = compareWithIndex(
      rows.flatMap((row) => row.position.flows),
      totals.value,
      benchmark.history,
      today,
    );
    body = (
      <View style={{ gap: theme.space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
          <Text variant="label" numberOfLines={2} style={{ flex: 1 }}>
            {benchmark.name}
          </Text>
          <Button label="Change" variant="ghost" size="sm" onPress={() => setChanging(true)} />
        </View>
        {result.status === 'ok' ? (
          <BenchmarkResult result={result} fundName={benchmark.name} />
        ) : result.status === 'empty' ? (
          <Text color="textSecondary">Add share trades to compare them with the index.</Text>
        ) : (
          <View style={{ gap: theme.space[3], alignItems: 'flex-start' }}>
            <Text color="textSecondary">
              {result.firstNavDate
                ? `The fund's stored NAVs start on ${dateText(result.firstNavDate)} or have a gap, and your first trade was on ${dateText(result.firstTradeDate)}. Update prices to fetch older NAVs. If the fund started after your first trade, choose an older index fund.`
                : "This fund's NAV history is not stored yet. Update prices to fetch it."}
            </Text>
            <Button
              label={busy ? 'Updating…' : 'Update prices'}
              variant="secondary"
              disabled={busy}
              onPress={() => void run(fetchHistory)}
            />
          </View>
        )}
      </View>
    );
  }
  return (
    <Sheet visible onClose={onClose} title="Shares vs index" width={640}>
      <View style={{ gap: theme.space[4] }}>
        {body}
        {notice ? (
          <Text variant="caption" color="textSecondary" role="status">
            {notice}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

export function BenchmarkButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="vs Index" variant="secondary" icon={ChartLine} onPress={() => setOpen(true)} />
      {open ? <BenchmarkSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
