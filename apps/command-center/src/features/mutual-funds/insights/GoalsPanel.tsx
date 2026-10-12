import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Plus } from '@/components/icons';
import { useToast } from '@/components/feedback';
import { Button, Money, ProgressBar, Text } from '@/components/ui';
import { useFundsView } from '@/features/investments/hooks/useInvestments';
import { deleteGoal, saveGoal } from '@/features/investments/state/goalActions';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { dayLabel, todayIso } from '@/lib/domain/expenses';
import { goalProgress, timeLeftLabel } from '@/lib/domain/investments';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { GoalEditor } from './GoalEditor';

/**
 * Goals with the funds tied to them (Edit fund → Goal): how far today's value goes, and the
 * monthly amount that would close the rest at the return you assume.
 */
export function GoalsPanel() {
  const theme = useTheme();
  const toast = useToast();
  const goals = useGoalStore((state) => state.goals);
  const { rows } = useFundsView();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const today = todayIso();
  return (
    <View style={{ gap: theme.space[4] }}>
      {goals.map((goal) => {
        const tied = rows.filter((row) => row.fund.goalId === goal.id);
        const current = tied.reduce((sum, row) => sum + row.position.value, 0);
        const progress = goalProgress(goal, current, today);
        if (editing === goal.id) {
          return (
            <GoalEditor
              key={goal.id}
              goal={goal}
              onCancel={() => setEditing(null)}
              onSave={(input) => {
                saveGoal(input, goal.id);
                setEditing(null);
              }}
              onDelete={() => {
                const undo = deleteGoal(goal.id);
                setEditing(null);
                if (undo)
                  toast.show({
                    message: `${goal.name} deleted · its funds stay`,
                    action: { label: 'Undo', onPress: undo },
                  });
              }}
            />
          );
        }
        return (
          <Pressable
            key={goal.id}
            role="button"
            accessibilityLabel={`${goal.name}, ${Math.round(progress.percent)} percent reached. Edit`}
            onPress={() => setEditing(goal.id)}
            style={{ gap: theme.space[2] }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space[2] }}>
              <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {goal.name}
              </Text>
              <Money value={current} variant="bodyStrong" />
              <Text
                variant="caption"
                color="textSecondary"
              >{`of ${formatMoneyWhole(goal.targetAmount)}`}</Text>
            </View>
            <ProgressBar
              value={progress.percent / 100}
              accessibilityLabel={`${goal.name} progress`}
            />
            <Text variant="caption" color="textSecondary">
              {progress.reached
                ? `Reached · ${tied.length} ${tied.length === 1 ? 'fund' : 'funds'}`
                : `${timeLeftLabel(today, goal.targetDate)} left (${dayLabel(goal.targetDate, 'short')}) · ${
                    tied.length
                      ? `${tied.length} ${tied.length === 1 ? 'fund' : 'funds'}`
                      : 'no funds tied yet'
                  } · ${
                    progress.monthlyNeeded
                      ? `about ${formatMoneyWhole(progress.monthlyNeeded)} a month needed at ${goal.expectedReturn}% a year`
                      : 'on track at the return you assume'
                  }`}
            </Text>
          </Pressable>
        );
      })}
      {editing === 'new' ? (
        <GoalEditor
          goal={null}
          onCancel={() => setEditing(null)}
          onSave={(input) => {
            saveGoal(input);
            setEditing(null);
          }}
        />
      ) : (
        <View style={{ gap: theme.space[2] }}>
          {!goals.length ? (
            <Text color="textSecondary">Add a goal, then tie funds to it in Edit fund → Goal.</Text>
          ) : null}
          <View style={{ flexDirection: 'row' }}>
            <Button
              label="Add goal"
              icon={Plus}
              variant="secondary"
              size="sm"
              onPress={() => setEditing('new')}
            />
          </View>
        </View>
      )}
      <Text variant="caption" color="textTertiary">
        Estimates use the yearly return you enter for each goal; real returns go up and down.
      </Text>
    </View>
  );
}
