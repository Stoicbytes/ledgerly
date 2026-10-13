import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { ListRow } from '@/features/salary/components/ListRow';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import { HIT_LABELS, searchEverything, type SearchHit } from '@/lib/domain/search';
import { useTheme } from '@/theme';

/** Matches outside the expense ledger, grouped by where they live; a tap opens that screen. */
export function EverythingResults({ query, onOpen }: { query: string; onOpen: () => void }) {
  const theme = useTheme();
  const notes = useNotesStore((state) => state.notes);
  const funds = usePortfolioStore((state) => state.funds);
  const stocks = usePortfolioStore((state) => state.stocks);
  const goals = useGoalStore((state) => state.goals);
  const employers = useSalaryStore((state) => state.employers);
  const payslips = useSalaryStore((state) => state.payslips);
  const hits = useMemo(
    () => searchEverything(query, { notes, funds, goals, stocks, employers, payslips }),
    [query, notes, funds, goals, stocks, employers, payslips],
  );
  if (!hits.length) return null;
  const groups = new Map<SearchHit['kind'], SearchHit[]>();
  for (const hit of hits) groups.set(hit.kind, [...(groups.get(hit.kind) ?? []), hit]);
  return (
    <View style={{ gap: theme.space[2] }}>
      {[...groups.entries()].map(([kind, items]) => (
        <View key={kind}>
          <Text variant="label" color="textSecondary">
            {HIT_LABELS[kind]}
          </Text>
          {items.map((hit) => (
            <ListRow
              key={hit.id}
              title={hit.title}
              detail={hit.detail}
              onPress={() => {
                onOpen();
                router.push(hit.href as Href);
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
