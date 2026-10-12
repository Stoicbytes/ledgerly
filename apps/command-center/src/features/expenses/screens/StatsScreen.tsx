import { useState } from 'react';
import { BentoCell, BentoRow } from '@/components/layout/Bento';
import { Screen, useFitMode } from '@/components/layout/Screen';
import { ExpensesHeader } from '../components/ExpensesHeader';
import { CategoryDetailCard } from '../stats/CategoryDetailCard';
import { RankedListCard } from '../stats/RankedListCard';
import { StatsPieCard } from '../stats/StatsPieCard';
import { StatsToolbar } from '../stats/StatsToolbar';
import { useStatsView } from '../stats/useStatsView';

/**
 * Expenses › Stats (Money Manager's Stats tab): income or expenses for a month
 * or year as a pie with callouts and a ranked list; a category opens its
 * subcategories, trend and entries.
 */
export function StatsScreen() {
  const fit = useFitMode(true);
  const view = useStatsView();
  // Hover highlight belongs to the slices on screen: opening a category, or
  // switching kind, starts with nothing highlighted.
  const scope = `${view.kind}|${view.period}|${view.drill?.id ?? ''}`;
  const [hover, setHover] = useState<{ scope: string; label: string | null }>({
    scope,
    label: null,
  });
  const active = hover.scope === scope ? hover.label : null;
  const setActive = (label: string | null) => setHover({ scope, label });
  const grow = fit ? { flex: 1 } : undefined;
  return (
    <Screen fit>
      <ExpensesHeader period={view.period} />
      <StatsToolbar view={view} />
      <BentoRow stackBelow="desktop" fill={1}>
        <BentoCell flex={6}>
          <StatsPieCard view={view} active={active} style={grow} />
        </BentoCell>
        <BentoCell flex={5}>
          {view.drill ? (
            <CategoryDetailCard view={view} active={active} onHover={setActive} style={grow} />
          ) : (
            <RankedListCard view={view} active={active} onHover={setActive} style={grow} />
          )}
        </BentoCell>
      </BentoRow>
    </Screen>
  );
}
