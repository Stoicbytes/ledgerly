import { View } from 'react-native';
import { Database } from '@/components/icons';
import { Card, CardHeader, CategoryIcon, Text } from '@/components/ui';
import { useRecurringStore } from '@/features/expenses/state/recurringStore';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { useNotesStore } from '@/features/notes/state/notesStore';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import { useTheme } from '@/theme';
import { missingUpdates, useResetMissing } from './dbUpdates';

/** Signed in: lists features hidden because the database is missing a migration. */
export function DbUpdatesCard({ index }: { index: number }) {
  const theme = useTheme();
  const updates = missingUpdates({
    recurring: useRecurringStore((state) => state.available),
    goals: useGoalStore((state) => state.available),
    noteExtras: useNotesStore((state) => state.extras),
    salary: useSalaryStore((state) => state.available),
    resetMissing: useResetMissing((state) => state.missing),
  });
  if (!updates.length) return null;
  return (
    <Card index={index} style={{ gap: theme.space[4] }}>
      <CardHeader
        title="Database updates needed"
        subtitle="These features are hidden until the owner runs their migration in Supabase (SQL Editor; see SUPABASE_SETUP.md)."
        action={<CategoryIcon icon={Database} tint={4} size={40} />}
      />
      <View style={{ gap: theme.space[2] }}>
        {updates.map((update) => (
          <View key={update.file} style={{ gap: 2 }}>
            <Text variant="bodyStrong">{update.feature}</Text>
            <Text variant="caption" color="textSecondary" selectable>
              {`supabase/migrations/${update.file}`}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
