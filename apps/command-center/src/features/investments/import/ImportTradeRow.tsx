import { Pressable, View } from 'react-native';
import { Square, SquareCheck } from '@/components/icons';
import { Text } from '@/components/ui';
import { parseIsoDate } from '@/lib/domain/expenses';
import type { HoldingPlan, PlannedTrade } from '@/lib/domain/investments/tradebookImport';
import { formatMoney } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

// Tradebooks span years, so every trade shows its year.
const tradeDay = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export const quantityText = (plan: Pick<HoldingPlan, 'segment'>, quantity: number) =>
  plan.segment === 'funds'
    ? quantity.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 4 })
    : quantity.toLocaleString('en-IN');

const priceText = (plan: HoldingPlan, price: number) =>
  `₹${price.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: plan.segment === 'funds' ? 4 : 2,
  })}`;

const BOX = 22;

function Cells({ cells, tone }: { cells: string[]; tone?: 'income' | 'expense' | 'textTertiary' }) {
  const theme = useTheme();
  const cell = { flex: 1, minWidth: 0 } as const;
  const [date, kind, quantity, price, amount] = cells;
  const heading = tone === 'textTertiary';
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: theme.space[2] }}>
      <Text variant="caption" color={heading ? tone : undefined} style={cell}>
        {date}
      </Text>
      <Text variant="caption" color={tone} style={{ width: 34 }}>
        {kind}
      </Text>
      {[quantity, price, amount].map((text, index) => (
        <Text
          key={index}
          variant="caption"
          color={heading ? tone : undefined}
          style={{ ...cell, textAlign: 'right' }}
        >
          {text}
        </Text>
      ))}
    </View>
  );
}

export function TradeHeading({ plan }: { plan: HoldingPlan }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
      <View style={{ width: BOX }} />
      <Cells
        tone="textTertiary"
        cells={[
          'Date',
          '',
          plan.segment === 'funds' ? 'Units' : 'Shares',
          plan.segment === 'funds' ? 'NAV' : 'Price',
          'Amount',
        ]}
      />
    </View>
  );
}

/** One trade with its tick box, and why it may be a duplicate. */
export function TradeRow({
  plan,
  trade,
  on,
  onToggle,
}: {
  plan: HoldingPlan;
  trade: PlannedTrade;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  const theme = useTheme();
  const date = tradeDay.format(parseIsoDate(trade.date));
  const kind = trade.kind === 'buy' ? 'Buy' : 'Sell';
  const Icon = on ? SquareCheck : Square;
  return (
    <Pressable
      role="checkbox"
      aria-checked={on}
      accessibilityLabel={`${kind} ${quantityText(plan, trade.quantity)} on ${date}`}
      onPress={() => onToggle(!on)}
      style={{ gap: 2, opacity: on ? 1 : 0.6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <Icon size={18} color={on ? theme.colors.textPrimary : theme.colors.textTertiary} />
        <View style={{ width: BOX - 18 }} />
        <Cells
          tone={trade.kind === 'buy' ? 'income' : 'expense'}
          cells={[
            date,
            kind,
            quantityText(plan, trade.quantity),
            priceText(plan, trade.price),
            formatMoney(trade.amount),
          ]}
        />
      </View>
      {trade.duplicate ? (
        <Text variant="caption" color="warning" style={{ marginLeft: BOX + theme.space[2] }}>
          {trade.duplicate}
        </Text>
      ) : null}
    </Pressable>
  );
}
