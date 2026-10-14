import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Text } from '@/components/ui';
import { SwitchRow } from '@/features/investments/components/SwitchRow';
import type { HoldingPlan } from '@/lib/domain/investments/tradebookImport';
import { formatMoney } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { quantityText, TradeHeading, TradeRow } from './ImportTradeRow';

const SHOWN = 6;

/**
 * One holding to review: the trades to add, each with a tick box (possible duplicates start
 * unticked), and what it will hold with the ticked ones.
 */
export function ImportHoldingCard({
  plan,
  selected,
  check,
  onToggle,
}: {
  plan: HoldingPlan;
  selected: ReadonlySet<string>;
  /** With the ticked trades; undefined when none is ticked. */
  check: { held: number; invested: number; covered: boolean } | undefined;
  onToggle: (ids: string[], on: boolean) => void;
}) {
  const theme = useTheme();
  const [all, setAll] = useState(false);
  const unit = plan.segment === 'funds' ? 'Units' : 'Shares';
  // Possible duplicates are always shown, so none is hidden behind "Show all".
  const trades = all ? plan.add : plan.add.filter((t, i) => i < SHOWN || t.duplicate);
  const isNew = !plan.existingId;
  const ticked = plan.add.filter((trade) => selected.has(trade.id));
  const on = ticked.length > 0;
  const flagged = plan.add.filter((trade) => trade.duplicate).length;
  const after = check ?? plan.before;
  return (
    <View
      style={{
        gap: theme.space[2],
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: !on
          ? theme.colors.border
          : check && !check.covered
            ? theme.colors.warning
            : theme.colors.accent,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <Text variant="label" numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>
          {plan.name}
        </Text>
        <Badge
          label={isNew ? (plan.segment === 'funds' ? 'New fund' : 'New stock') : 'In the app'}
          tone={isNew ? 'info' : 'neutral'}
        />
      </View>
      <Text variant="caption" color="textTertiary">
        {plan.isin}
        {plan.already ? ` · ${plan.already} already in the app` : ''}
      </Text>
      <SwitchRow
        label={
          ticked.length === plan.add.length
            ? `Add ${plan.add.length} ${plan.add.length === 1 ? 'trade' : 'trades'}`
            : `Add ${ticked.length} of ${plan.add.length} trades`
        }
        hint={
          flagged
            ? `${flagged} possible ${flagged === 1 ? 'duplicate is' : 'duplicates are'} unticked: check before adding.`
            : undefined
        }
        value={on}
        onChange={(next) =>
          onToggle(
            next
              ? plan.add.filter((t) => !t.duplicate || flagged === plan.add.length).map((t) => t.id)
              : plan.add.map((t) => t.id),
            next,
          )
        }
      />
      <View style={{ gap: 4 }}>
        <TradeHeading plan={plan} />
        {trades.map((trade) => (
          <TradeRow
            key={trade.id}
            plan={plan}
            trade={trade}
            on={selected.has(trade.id)}
            onToggle={(next) => onToggle([trade.id], next)}
          />
        ))}
        {plan.add.length > SHOWN ? (
          <Pressable role="button" onPress={() => setAll(!all)} hitSlop={8}>
            <Text variant="caption" color="accent">
              {all ? 'Show fewer' : `Show all ${plan.add.length}`}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text variant="caption" color="textSecondary">
        {unit} {quantityText(plan, plan.before.held)} → {quantityText(plan, after.held)} · Invested{' '}
        {formatMoney(plan.before.invested)} → {formatMoney(after.invested)}
      </Text>
      {check && !check.covered ? (
        <Text variant="caption" color="warning" role="alert">
          With these trades unticked, a sale is larger than what would be held. Tick the purchases
          it sells, or untick the sale.
        </Text>
      ) : null}
      {plan.leftOut.length ? (
        <Text variant="caption" color="textTertiary">
          {plan.leftOut.length} earlier {plan.leftOut.length === 1 ? 'trade is' : 'trades are'} left
          out: {plan.leftOut.length === 1 ? 'it sells' : 'they sell'} {unit.toLowerCase()} bought
          before this file starts.
        </Text>
      ) : null}
    </View>
  );
}
