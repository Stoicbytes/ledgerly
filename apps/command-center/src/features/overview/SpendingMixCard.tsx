import { Link, router, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PieChart } from '@/components/charts';
import { Card, CardHeader, Text } from '@/components/ui';
import { formatShare, SliceRow } from '@/features/expenses/components/SliceRow';
import { useSliceColors } from '@/features/expenses/sliceColors';
import { useExpenseUi } from '@/features/expenses/state/expenseUi';
import type { SpendingRow } from '@/lib/domain/insights';
import { formatMoneyWhole as money } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';

type SpendingMixCardProps = {
  spending: { rows: SpendingRow[]; total: number; previousTotal: number };
  /** What "last month" means here, e.g. "vs 1–21 Sep". */
  comparison: string;
  index?: number;
};

const STATS = '/dashboard/expenses/stats' as Href;

const change = (now: number, before: number) => {
  if (!before) return now ? 'new this month' : '';
  const delta = now - before;
  if (!delta) return 'no change';
  return `${delta > 0 ? 'up' : 'down'} ${money(Math.abs(delta))}`;
};

/**
 * This month's spending by category, drawn like Expenses → Stats: a pie in rank colours
 * (largest first, "Other" grey) and the ranking with share badges, each with the change
 * against the same days of last month. Pressing a category opens it in Stats.
 */
export function SpendingMixCard({ spending, comparison, index = 9 }: SpendingMixCardProps) {
  const theme = useTheme();
  const { rows, total, previousTotal } = spending;
  const colors = useSliceColors(rows);
  const drillInto = useExpenseUi((state) => state.drillInto);
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <Card index={index} style={{ gap: theme.space[3], flex: 1 }}>
      <CardHeader
        title="Spending by category"
        subtitle={
          total
            ? `${money(total)} this month${previousTotal ? ` · ${change(total, previousTotal)} ${comparison}` : ''}`
            : 'Nothing spent yet this month'
        }
        action={
          <Link href={STATS} accessibilityLabel="Open spending stats">
            <Text variant="label" color="accent">
              Stats
            </Text>
          </Link>
        }
      />
      {rows.length ? (
        <PieChart
          height={240}
          segments={rows.map((row, at) => ({
            label: row.name,
            value: row.amount,
            color: colors[at],
          }))}
          activeLabel={hovered}
          accessibilityLabel={`Spending by category this month, ${money(total)}. ${rows
            .slice(0, 4)
            .map((row) => `${row.name} ${formatShare(row.share)}`)
            .join(', ')}.`}
        />
      ) : null}
      <View>
        {rows.map((row, at) => {
          const caption = `${change(row.amount, row.previous)}${row.previous ? ` ${comparison}` : ''}`;
          return (
            <View
              key={row.id}
              accessibilityLabel={`${row.name}: ${money(row.amount)}, ${Math.round(row.share * 100)}% of spending, ${caption}.`}
            >
              <SliceRow
                slice={row}
                color={colors[at]}
                caption={caption}
                active={hovered === row.name}
                onHover={setHovered}
                onPress={
                  row.category
                    ? () => {
                        drillInto(row.id);
                        router.push(STATS);
                      }
                    : undefined
                }
              />
            </View>
          );
        })}
      </View>
    </Card>
  );
}
