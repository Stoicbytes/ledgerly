import { View } from 'react-native';
import { CircleAlert, RefreshCw } from '@/components/icons';
import { Button, Text } from '@/components/ui';
import { useToast } from '@/components/feedback';
import { dayLabel, todayIso } from '@/lib/domain/expenses';
import { priceFreshness, type PriceKind, type RefreshRun } from '@/lib/domain/investments';
import { useTheme } from '@/theme';
import { useMarketStore } from '../state/marketStore';

const SOURCES: Record<RefreshRun['source'], string> = {
  amfi: 'AMFI',
  nse: 'NSE',
  bse: 'BSE',
  mfapi: 'history',
};

/**
 * "NAVs as of Tue, 7 Oct (AMFI)": when the prices on screen are from, and where from. Warns
 * when they are older than the last trading day or the latest update failed.
 */
export function PriceStatus({ kind }: { kind: PriceKind }) {
  const theme = useTheme();
  const mode = useMarketStore((state) => state.mode);
  const runs = useMarketStore((state) => state.market.runs);
  const notice = useMarketStore((state) => state.notice);
  const fresh = priceFreshness(runs, kind, todayIso());
  const what = kind === 'funds' ? 'NAVs' : 'Closing prices';
  const text =
    mode === 'preview'
      ? `${what}: sample values`
      : fresh.dataDate && fresh.source
        ? `${what} as of ${dayLabel(fresh.dataDate, 'short')} (${SOURCES[fresh.source]})`
        : `${what}: not fetched yet`;
  const warning =
    mode === 'preview'
      ? null
      : fresh.failure
        ? `The last price update failed: ${fresh.failure}`
        : fresh.stale
          ? `${what} are out of date. Use Update prices to fetch the latest.`
          : null;
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" color="textSecondary">
        {text}
      </Text>
      {warning ? (
        <View role="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <CircleAlert size={14} color={theme.colors.warning} aria-hidden />
          <Text variant="caption" color="warning" style={{ flexShrink: 1 }}>
            {warning}
          </Text>
        </View>
      ) : null}
      {notice ? (
        <Text variant="caption" color="textSecondary" role="status">
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

/** Asks the server for the latest NAVs and closing prices, then reloads them. */
export function RefreshPricesButton() {
  const toast = useToast();
  const refreshing = useMarketStore((state) => state.refreshing);
  const mode = useMarketStore((state) => state.mode);
  return (
    <Button
      label={refreshing ? 'Updating…' : 'Update prices'}
      variant="secondary"
      icon={RefreshCw}
      disabled={refreshing || mode === 'preview'}
      onPress={async () => {
        const message = await useMarketStore.getState().refresh();
        toast.show({ message });
      }}
    />
  );
}
