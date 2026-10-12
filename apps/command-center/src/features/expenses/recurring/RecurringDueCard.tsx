import { useMemo } from 'react';
import { View } from 'react-native';
import { Repeat } from '@/components/icons';
import { useToast } from '@/components/feedback';
import { Button, Card, CardHeader, Text } from '@/components/ui';
import { dayLabel, dueEntries, todayIso, type DueEntry } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { formatEntry } from '../format';
import { useLookup } from '../hooks/useLedger';
import { addAllDue, advanceRule } from '../state/recurringActions';
import { useRecurringStore } from '../state/recurringStore';
import { useTransactionForm } from '../state/transactionForm';
import { dueDraft, ruleTitle } from './ruleText';

const SHOWN = 4;

/**
 * Recurring entries whose date has come: add each one (the sheet opens with the amount
 * ready to change), skip it, or add them all as they are. Hidden when nothing is due.
 */
export function RecurringDueCard() {
  const theme = useTheme();
  const toast = useToast();
  const lookup = useLookup();
  const rules = useRecurringStore((state) => state.rules);
  const openNew = useTransactionForm((state) => state.openNew);
  const due = useMemo(() => dueEntries(rules, todayIso()), [rules]);
  if (!due.length) return null;
  const addAll = () => {
    const { added, undo } = addAllDue();
    const left = due.length - added.length;
    toast.show({
      message: `Added ${added.length} ${added.length === 1 ? 'entry' : 'entries'}${left ? ` · ${left} need a category or account` : ''}`,
      action: added.length ? { label: 'Undo', onPress: undo } : undefined,
    });
  };
  const skip = (item: DueEntry) => {
    const before = useRecurringStore.getState().rules;
    advanceRule(item.rule.id, item.date);
    toast.show({
      message: `Skipped ${ruleTitle(item.rule, lookup)} for ${dayLabel(item.date, 'short')}`,
      action: { label: 'Undo', onPress: () => useRecurringStore.setState({ rules: before }) },
    });
  };
  return (
    <Card index={1} style={{ gap: theme.space[3] }}>
      <CardHeader
        title={`Recurring · ${due.length} due`}
        subtitle="Add each one (you can change the amount) or skip it"
        action={<Button label="Add all" size="sm" variant="ink" onPress={addAll} />}
      />
      {due.slice(0, SHOWN).map((item) => (
        <View
          key={`${item.rule.id}:${item.date}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}
        >
          <Repeat size={16} color={theme.colors.textTertiary} aria-hidden />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {ruleTitle(item.rule, lookup)}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {`${dayLabel(item.date, 'short')} · ${formatEntry(item.rule.amount)}`}
            </Text>
          </View>
          <Button
            label="Skip"
            size="sm"
            variant="ghost"
            accessibilityLabel={`Skip ${ruleTitle(item.rule, lookup)} for ${dayLabel(item.date)}`}
            onPress={() => skip(item)}
          />
          <Button
            label="Add"
            size="sm"
            variant="secondary"
            accessibilityLabel={`Add ${ruleTitle(item.rule, lookup)} for ${dayLabel(item.date)}`}
            onPress={() => openNew(dueDraft(item.rule, item.date, lookup))}
          />
        </View>
      ))}
      {due.length > SHOWN ? (
        <Text variant="caption" color="textTertiary">
          {`${due.length - SHOWN} more after these.`}
        </Text>
      ) : null}
    </Card>
  );
}
