import { View } from 'react-native';
import { Pencil } from '@/components/icons';
import { CategoryIcon, IconButton, ProgressBar, Text } from '@/components/ui';
import type { BudgetLine } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { iconFor } from '../categoryIcons';
import { BudgetEditor } from './BudgetEditor';

type BudgetLineRowProps = {
  line: BudgetLine;
  /** Share of the month already gone (0–1): drawn as a "today" mark on the bar. */
  pace: number;
  editing: boolean;
  onEdit: () => void;
  onSave: (budget: number | null) => void;
  onCancel: () => void;
};

/** One budgeted category: spent against its budget, with what is left or over. */
export function BudgetLineRow({
  line,
  pace,
  editing,
  onEdit,
  onSave,
  onCancel,
}: BudgetLineRowProps) {
  const theme = useTheme();
  const { category } = line;
  const over = line.remaining < 0;
  const full = !over && line.ratio >= 1;
  const tone = over ? 'danger' : line.ratio >= 0.9 ? 'warning' : 'brandFrom';
  // Ahead of the even pace for the month (spending faster than the days pass).
  const ahead = !over && !full && pace > 0 && pace < 1 && line.ratio > pace + 0.1;
  return (
    <View
      style={{
        gap: theme.space[2],
        paddingVertical: theme.space[3],
        paddingHorizontal: theme.space[2],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <CategoryIcon icon={iconFor(category.icon)} tint={category.tint} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {category.name}
          </Text>
          <Text variant="caption" color="textSecondary" numeric numberOfLines={1}>
            {formatMoneyWhole(line.spent)} of {formatMoneyWhole(line.budget)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="label" color={over ? 'danger' : ahead ? 'warning' : 'textPrimary'} numeric>
            {over
              ? `${formatMoneyWhole(-line.remaining)} over`
              : full
                ? 'All used'
                : `${formatMoneyWhole(line.remaining)} left`}
          </Text>
          <Text variant="caption" color="textTertiary">
            {Math.round(line.ratio * 100)}% used{ahead ? ' · ahead of pace' : ''}
          </Text>
        </View>
        <IconButton
          icon={Pencil}
          size="sm"
          accessibilityLabel={`Change the ${category.name} budget`}
          onPress={onEdit}
        />
      </View>
      <View style={{ marginLeft: 48 }}>
        <ProgressBar
          value={line.ratio}
          tone={tone}
          height={8}
          hatched
          accessibilityLabel={`${category.name} budget used`}
        />
        {pace > 0 && pace < 1 ? (
          <View
            aria-hidden
            style={{
              position: 'absolute',
              left: `${pace * 100}%`,
              top: -3,
              bottom: -3,
              width: 2,
              borderRadius: 1,
              backgroundColor: theme.colors.ink,
            }}
          />
        ) : null}
      </View>
      {editing ? (
        <View style={{ marginLeft: 48 }}>
          <BudgetEditor
            name={category.name}
            value={line.budget}
            onSave={onSave}
            onCancel={onCancel}
          />
        </View>
      ) : null}
    </View>
  );
}
