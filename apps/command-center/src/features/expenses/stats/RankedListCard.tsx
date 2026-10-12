import type { StyleProp, ViewStyle } from 'react-native';
import { Card, CardHeader } from '@/components/ui';
import { useTheme } from '@/theme';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { SliceRow } from '../components/SliceRow';
import { useSliceColors } from '../sliceColors';
import { useExpenseUi } from '../state/expenseUi';
import type { StatsView } from './useStatsView';

type RankedListCardProps = {
  view: StatsView;
  active: string | null;
  onHover: (label: string | null) => void;
  style?: StyleProp<ViewStyle>;
};

/** Every category ranked by amount with its share; pressing one opens it. */
export function RankedListCard({ view, active, onHover, style }: RankedListCardProps) {
  const theme = useTheme();
  const drillInto = useExpenseUi((state) => state.drillInto);
  // Rows folded into the pie's "Other" slice share its grey.
  const pieColors = useSliceColors(view.pie);
  const colorAt = (index: number) =>
    view.pie[index]?.id === view.ranked[index].id ? pieColors[index] : theme.colors.pieOther;
  return (
    <Card index={2} style={[{ gap: theme.space[2] }, style]}>
      <CardHeader
        title="Ranking"
        subtitle={`${view.ranked.length} ${view.ranked.length === 1 ? 'category' : 'categories'} · press one for details`}
      />
      <PanelScroll>
        {view.ranked.map((slice, index) => (
          <SliceRow
            key={slice.id}
            slice={slice}
            color={colorAt(index)}
            active={active === slice.name}
            onHover={onHover}
            onPress={slice.category ? () => drillInto(slice.id) : undefined}
          />
        ))}
      </PanelScroll>
    </Card>
  );
}
