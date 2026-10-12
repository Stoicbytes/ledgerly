import { useState } from 'react';
import { View } from 'react-native';
import { Scale } from '@/components/icons';
import { Sheet } from '@/components/overlays';
import { Button, SegmentedControl, type Segment } from '@/components/ui';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { useTheme } from '@/theme';
import { CapitalGainsPanel } from './CapitalGainsPanel';
import { CostsPanel } from './CostsPanel';
import { GoalsPanel } from './GoalsPanel';

type Tab = 'gains' | 'goals' | 'costs';

const ALL: readonly Segment<Tab>[] = [
  { value: 'gains', label: 'Capital gains' },
  { value: 'goals', label: 'Goals' },
  { value: 'costs', label: 'Costs' },
];

/**
 * Capital gains for tax filing, goals, and what the funds cost. Goals and costs need
 * migration 0013 when signed in, so they are hidden before it.
 */
export function InsightsSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const extras = useGoalStore((state) => state.available);
  const [tab, setTab] = useState<Tab>('gains');
  const segments = extras ? ALL : ALL.slice(0, 1);
  const shown = extras ? tab : 'gains';
  return (
    <Sheet visible onClose={onClose} title="Fund insights" width={720}>
      <View style={{ gap: theme.space[4] }}>
        {segments.length > 1 ? (
          <SegmentedControl
            segments={segments}
            value={shown}
            onChange={setTab}
            size="sm"
            accessibilityLabel="Insight"
          />
        ) : null}
        {shown === 'gains' ? (
          <CapitalGainsPanel />
        ) : shown === 'goals' ? (
          <GoalsPanel />
        ) : (
          <CostsPanel />
        )}
      </View>
    </Sheet>
  );
}

export function InsightsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="Insights" variant="secondary" icon={Scale} onPress={() => setOpen(true)} />
      {open ? <InsightsSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
