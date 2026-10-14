import { Text } from '@/components/ui';
import { useMarketStore } from '@/features/investments/state/marketStore';
import { dayLabel, todayIso } from '@/lib/domain/expenses';
import { priceFreshness, type PriceKind } from '@/lib/domain/investments';

/**
 * "Prices as of Tue, 7 Oct" under the net worth, for the kinds of holdings you have: the
 * older date when funds and shares were priced on different days.
 */
export function PricesAsOf({ kinds }: { kinds: PriceKind[] }) {
  const mode = useMarketStore((state) => state.mode);
  const runs = useMarketStore((state) => state.market.runs);
  if (mode === 'preview' || !kinds.length) return null;
  const today = todayIso();
  const fresh = kinds.map((kind) => priceFreshness(runs, kind, today));
  const dates = fresh.map((item) => item.dataDate);
  const known = dates.filter((date): date is string => !!date).sort();
  const behind = fresh.some((item) => item.stale || item.failure) || known.length < dates.length;
  const text = known.length
    ? `Prices as of ${dayLabel(known[0], 'short')}${behind ? ' · may be out of date' : ''}`
    : 'Prices not fetched yet';
  return (
    <Text variant="caption" color={behind ? 'warning' : 'textSecondary'}>
      {text}
    </Text>
  );
}
