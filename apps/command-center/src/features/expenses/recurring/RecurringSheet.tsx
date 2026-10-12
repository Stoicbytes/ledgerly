import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Repeat } from '@/components/icons';
import { EmptyState, useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Text } from '@/components/ui';
import { dayLabel, FREQUENCY_LABELS } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { formatEntry } from '../format';
import { useLookup } from '../hooks/useLedger';
import { deleteRule, restoreRule, updateRule } from '../state/recurringActions';
import { useRecurringStore } from '../state/recurringStore';
import { RuleEditor } from './RuleEditor';
import { ruleTitle } from './ruleText';

/** Every recurring entry, with how often and when it is next due; tap one to change it. */
export function RecurringSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const toast = useToast();
  const lookup = useLookup();
  const rules = useRecurringStore((state) => state.rules);
  const [editing, setEditing] = useState<string | null>(null);
  const ordered = [...rules].sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Recurring entries"
      description="To make an entry repeat, choose Repeat when you add it."
      width={560}
    >
      {!ordered.length ? (
        <EmptyState
          icon={Repeat}
          title="Nothing repeats yet"
          body="Add an entry such as rent or a subscription and choose Repeat → Monthly."
        />
      ) : (
        <View style={{ gap: theme.space[1] }}>
          {ordered.map((rule) => (
            <View key={rule.id}>
              <Pressable
                role="button"
                accessibilityState={{ expanded: editing === rule.id }}
                accessibilityLabel={`${ruleTitle(rule, lookup)}, ${formatEntry(rule.amount)}, ${FREQUENCY_LABELS[rule.frequency]}, next on ${dayLabel(rule.nextDate)}`}
                onPress={() => setEditing(editing === rule.id ? null : rule.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space[3],
                  paddingVertical: theme.space[2],
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {ruleTitle(rule, lookup)}
                  </Text>
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {`${FREQUENCY_LABELS[rule.frequency]} · next ${dayLabel(rule.nextDate, 'short')}`}
                  </Text>
                </View>
                <Text variant="bodyStrong" numeric>
                  {formatEntry(rule.amount)}
                </Text>
              </Pressable>
              {editing === rule.id ? (
                <RuleEditor
                  rule={rule}
                  onSave={(patch) => {
                    updateRule(rule.id, patch);
                    setEditing(null);
                    toast.show({ message: 'Recurring entry updated' });
                  }}
                  onDelete={() => {
                    const removed = deleteRule(rule.id);
                    setEditing(null);
                    if (removed)
                      toast.show({
                        message: 'Recurring entry deleted · added entries stay',
                        action: { label: 'Undo', onPress: () => restoreRule(removed) },
                      });
                  }}
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}
