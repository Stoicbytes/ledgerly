import { useState } from 'react';
import { ChipField } from '@/features/investments/components/ChipField';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { parseExpenseRatio, type Fund } from '@/lib/domain/investments';
import { TextField } from '../expenses/components/TextField';

const NO_GOAL = 'No goal';

/**
 * Expense ratio and goal for the fund sheet (migration 0013; hidden before it). `read`
 * returns the values to save, or null after showing what is wrong.
 */
export function useFundExtras(fund: Fund | undefined) {
  const available = useGoalStore((state) => state.available);
  const goals = useGoalStore((state) => state.goals);
  const [terText, setTerText] = useState(
    fund?.expenseRatio != null ? String(fund.expenseRatio) : '',
  );
  const [goalId, setGoalId] = useState(fund?.goalId ?? null);
  const [error, setError] = useState<string | null>(null);
  const read = (): Pick<Fund, 'expenseRatio' | 'goalId'> | Record<string, never> | null => {
    if (!available) return {};
    const expenseRatio = terText.trim() ? parseExpenseRatio(terText) : null;
    if (terText.trim() && expenseRatio === null) {
      setError('Enter the expense ratio in percent, like 0.45 (up to 5).');
      return null;
    }
    return { expenseRatio, goalId: goals.some((goal) => goal.id === goalId) ? goalId : null };
  };
  const fields = available ? (
    <>
      <TextField
        label="Expense ratio (%)"
        inputMode="decimal"
        keyboardType="decimal-pad"
        value={terText}
        onChangeText={(text) => {
          setTerText(text);
          setError(null);
        }}
        placeholder="Optional, e.g. 0.45"
        hint="From the fund's factsheet (TER). Shows what the fund costs you each year."
        error={error}
      />
      {goals.length ? (
        <ChipField
          label="Goal"
          options={[NO_GOAL, ...goals.map((goal) => goal.name)]}
          value={goals.find((goal) => goal.id === goalId)?.name ?? NO_GOAL}
          onChange={(name) => setGoalId(goals.find((goal) => goal.name === name)?.id ?? null)}
        />
      ) : null}
    </>
  ) : null;
  return { fields, read };
}
