import type { SummaryItem } from '@/features/investments/components/SummaryGrid';
import { dayLabel } from '@/lib/domain/expenses';
import { elssLocked, fromUnits4, type Fund, type FundLot } from '@/lib/domain/investments';

/** The fund detail's "Locked (ELSS)" tile: units within 3 years of purchase (none otherwise). */
export function elssItems(fund: Fund, lots: FundLot[], today: string): SummaryItem[] {
  const locked = elssLocked(fund, lots, today);
  if (!locked) return [];
  return [
    {
      label: 'Locked (ELSS)',
      text: `${fromUnits4(locked.units4).toFixed(3)} units`,
      note: `all free by ${dayLabel(locked.until, 'short')}`,
    },
  ];
}
