import { useMemo } from 'react';
import { View } from 'react-native';
import { Chip, ScrollRow, Text } from '@/components/ui';
import {
  addMonths,
  monthBounds,
  monthOf,
  sortAccounts,
  todayIso,
  topLevelCategories,
  type TransactionKind,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { useLedger } from '../hooks/useLedger';
import { useSearchStore, type SearchPeriod } from '../state/searchStore';

const KINDS: { value: TransactionKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfers' },
];

const PERIODS: { value: SearchPeriod; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'month', label: 'This month' },
  { value: 'three', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
  { value: 'lastYear', label: 'Last year' },
];

/** The dates a period chip stands for, counted from today. */
export function periodRange(period: SearchPeriod, today = todayIso()) {
  const month = monthOf(today);
  const year = Number(today.slice(0, 4));
  switch (period) {
    case 'month':
      return { from: monthBounds(month).start, to: monthBounds(month).end };
    case 'three':
      return { from: monthBounds(addMonths(month, -2)).start, to: monthBounds(month).end };
    case 'year':
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case 'lastYear':
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    default:
      return { from: null, to: null };
  }
}

/** Type, period, category and account filters for the search. */
export function SearchFilterChips() {
  const theme = useTheme();
  const { accounts, categories } = useLedger();
  const filters = useSearchStore((state) => state.filters);
  const period = useSearchStore((state) => state.period);
  const update = useSearchStore((state) => state.update);
  const setPeriod = useSearchStore((state) => state.setPeriod);
  const ordered = useMemo(() => sortAccounts(accounts), [accounts]);
  const kind = filters.kind;
  const groups =
    kind === 'expense' || kind === 'income' ? topLevelCategories(categories, kind) : [];
  return (
    <View style={{ gap: theme.space[2] }}>
      <ScrollRow accessibilityLabel="Type">
        {KINDS.map((item) => (
          <Chip
            key={item.value}
            label={item.label}
            selected={kind === item.value}
            onPress={() => update({ kind: item.value, categoryId: null })}
          />
        ))}
      </ScrollRow>
      <ScrollRow accessibilityLabel="Period">
        {PERIODS.map((item) => (
          <Chip
            key={item.value}
            label={item.label}
            selected={period === item.value}
            onPress={() => setPeriod(item.value, periodRange(item.value))}
          />
        ))}
      </ScrollRow>
      {groups.length ? (
        <ScrollRow accessibilityLabel="Category">
          <Chip
            label="All categories"
            selected={!filters.categoryId}
            onPress={() => update({ categoryId: null })}
          />
          {groups.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              selected={filters.categoryId === category.id}
              onPress={() =>
                update({ categoryId: filters.categoryId === category.id ? null : category.id })
              }
            />
          ))}
        </ScrollRow>
      ) : (
        <Text variant="caption" color="textTertiary">
          Choose Expenses or Income to filter by category.
        </Text>
      )}
      <ScrollRow accessibilityLabel="Account">
        <Chip
          label="All accounts"
          selected={!filters.accountId}
          onPress={() => update({ accountId: null })}
        />
        {ordered.map((account) => (
          <Chip
            key={account.id}
            label={account.name}
            selected={filters.accountId === account.id}
            onPress={() =>
              update({ accountId: filters.accountId === account.id ? null : account.id })
            }
          />
        ))}
      </ScrollRow>
    </View>
  );
}
