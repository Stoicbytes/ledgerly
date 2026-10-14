import { Pressable, View } from 'react-native';
import { Plus } from '@/components/icons';
import { Sheet } from '@/components/overlays';
import { Button, Money, Text } from '@/components/ui';
import { PRICE_SOURCE_LABEL, SummaryGrid } from '@/features/investments/components/SummaryGrid';
import { useStocksView } from '@/features/investments/hooks/useInvestments';
import { useInteractionState } from '@/hooks/useInteractionState';
import { dayLabel } from '@/lib/domain/expenses';
import { sortTrades, type Trade } from '@/lib/domain/investments';
import { formatMoney, formatPercent } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type Props = {
  stockId: string;
  onClose: () => void;
  onAddTrade: () => void;
  onEditTrade: (id: string) => void;
  onEditStock: () => void;
};

function describe(trade: Trade): { title: string; detail: string; amount?: number } {
  const when = dayLabel(trade.date, 'short');
  switch (trade.kind) {
    case 'buy':
    case 'sell': {
      const gross = (trade.quantity ?? 0) * (trade.price ?? 0);
      const total = trade.kind === 'buy' ? -(gross + trade.charges) : gross - trade.charges;
      return {
        title: `${trade.kind === 'buy' ? 'Bought' : 'Sold'} · ${when}`,
        detail: `${trade.quantity} at ${formatMoney(trade.price ?? 0)}${trade.charges ? ` + ${formatMoney(trade.charges)} charges` : ''}`,
        amount: total,
      };
    }
    case 'dividend':
      return {
        title: `Dividend · ${when}`,
        detail: trade.note || 'Received',
        amount: trade.amount ?? 0,
      };
    case 'bonus':
      return {
        title: `Bonus · ${when}`,
        detail: `${trade.ratioTo} new for every ${trade.ratioFrom} held`,
      };
    default:
      return {
        title: `Split · ${when}`,
        detail: `${trade.ratioFrom} share${trade.ratioFrom === 1 ? '' : 's'} became ${trade.ratioTo}`,
      };
  }
}

/** One stock: what it is worth and every trade and corporate action. */
export function StockDetailSheet({
  stockId,
  onClose,
  onAddTrade,
  onEditTrade,
  onEditStock,
}: Props) {
  const theme = useTheme();
  const row = useStocksView().rows.find((item) => item.stock.id === stockId);
  if (!row) return null;
  const { stock, position, quote } = row;
  const gainPct = position.invested ? (position.unrealised / position.invested) * 100 : 0;
  return (
    <Sheet
      visible
      onClose={onClose}
      title={`${stock.symbol} · ${stock.name}`}
      description={[stock.exchange, stock.sector, stock.isin].filter(Boolean).join(' · ')}
      width={620}
      footer={
        <>
          <Button label="Edit stock" variant="secondary" onPress={onEditStock} />
          <View style={{ flex: 1 }} />
          <Button label="Add trade" icon={Plus} onPress={onAddTrade} />
        </>
      }
    >
      <View style={{ gap: theme.space[5] }}>
        <SummaryGrid
          items={[
            { label: 'Value', money: position.value },
            { label: 'Invested', money: position.invested },
            {
              label: 'Unrealised',
              money: position.unrealised,
              tone: 'auto',
              note: formatPercent(gainPct),
            },
            {
              label: 'XIRR',
              text: row.xirr === null ? '—' : formatPercent(row.xirr * 100),
              note: row.xirr === null && row.position.invested ? 'after a year' : undefined,
            },
            { label: 'Shares', text: String(position.quantity) },
            {
              label: 'Average cost',
              text: position.avgCost ? formatMoney(Math.round(position.avgCost)) : '—',
            },
            {
              label: 'Price',
              text: quote ? formatMoney(quote.price) : '—',
              note: quote
                ? `${dayLabel(quote.date, 'short')} · ${PRICE_SOURCE_LABEL[quote.source]}`
                : undefined,
            },
            {
              label: 'Realised + dividends',
              money: position.realised + position.dividends,
              tone: 'auto',
            },
          ]}
        />
        {position.realisedLots.length ? (
          <Text variant="caption" color="textSecondary">
            Realised gains here are after charges. Charges include STT, which tax rules don’t allow
            as a deduction: check your broker’s P&L statement before filing.
          </Text>
        ) : null}
        <View style={{ gap: theme.space[2] }}>
          <Text variant="title">Trades</Text>
          {row.trades.length ? (
            [...sortTrades(row.trades)]
              .reverse()
              .map((trade) => (
                <TradeLine
                  key={trade.id}
                  {...describe(trade)}
                  onPress={() => onEditTrade(trade.id)}
                />
              ))
          ) : (
            <Text variant="caption" color="textTertiary">
              No trades yet. Add your purchases to see shares, gains and XIRR.
            </Text>
          )}
        </View>
      </View>
    </Sheet>
  );
}

function TradeLine({
  title,
  detail,
  amount,
  onPress,
}: {
  title: string;
  detail: string;
  amount?: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${title}, ${detail}`}
      onPress={onPress}
      {...handlers}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: focused ? theme.colors.accent : theme.colors.border,
        backgroundColor: hovered ? theme.colors.surfaceMuted : 'transparent',
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {amount !== undefined ? <Money value={amount} variant="label" tone="auto" /> : null}
    </Pressable>
  );
}
