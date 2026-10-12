import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Plus, Square, SquareCheck, X } from '@/components/icons';
import { Text } from '@/components/ui';
import { NOTE_LIMITS, type ChecklistItem } from '@/lib/domain/notes';
import { newId } from '@/lib/ids';
import { fontFamily, useTheme } from '@/theme';

type ChecklistEditorProps = { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void };

/** Checklist editing: tick, edit, remove items, and add new ones; ticked items sink below. */
export function ChecklistEditor({ items, onChange }: ChecklistEditorProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);
  const patch = (id: string, change: Partial<ChecklistItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...change } : item)));
  const add = () => {
    if (!draft.trim() || items.length >= NOTE_LIMITS.items) return;
    onChange([...items, { id: newId(), text: draft.trim(), done: false }]);
    setDraft('');
  };
  const row = (item: ChecklistItem) => {
    const Box = item.done ? SquareCheck : Square;
    return (
      <View
        key={item.id}
        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}
      >
        <Pressable
          role="checkbox"
          accessibilityState={{ checked: item.done }}
          accessibilityLabel={`Done: ${item.text || 'empty item'}`}
          onPress={() => patch(item.id, { done: !item.done })}
          hitSlop={6}
        >
          <Box size={18} color={theme.colors.textPrimary} />
        </Pressable>
        <TextInput
          value={item.text}
          onChangeText={(text) => patch(item.id, { text })}
          maxLength={NOTE_LIMITS.itemText}
          accessibilityLabel="List item"
          style={{
            flex: 1,
            paddingVertical: 4,
            color: theme.colors.textPrimary,
            fontFamily: fontFamily.regular,
            fontSize: 14,
            textDecorationLine: item.done ? 'line-through' : 'none',
            outlineWidth: 0,
          }}
        />
        <Pressable
          role="button"
          accessibilityLabel={`Remove ${item.text || 'item'}`}
          onPress={() => onChange(items.filter((other) => other.id !== item.id))}
          hitSlop={6}
        >
          <X size={16} color={theme.colors.textPrimary} />
        </Pressable>
      </View>
    );
  };
  return (
    <View style={{ gap: theme.space[1] }}>
      {open.map(row)}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <Plus size={18} color={theme.colors.textPrimary} aria-hidden />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          blurOnSubmit={false}
          returnKeyType="next"
          placeholder={
            items.length >= NOTE_LIMITS.items ? `${NOTE_LIMITS.items} items at most` : 'List item'
          }
          editable={items.length < NOTE_LIMITS.items}
          placeholderTextColor={theme.colors.textSecondary}
          maxLength={NOTE_LIMITS.itemText}
          accessibilityLabel="New list item"
          style={{
            flex: 1,
            paddingVertical: 4,
            color: theme.colors.textPrimary,
            fontFamily: fontFamily.regular,
            fontSize: 14,
            outlineWidth: 0,
          }}
        />
      </View>
      {done.length ? (
        <>
          <Text variant="caption" style={{ marginTop: theme.space[2] }}>
            {`${done.length} checked`}
          </Text>
          {done.map(row)}
        </>
      ) : null}
    </View>
  );
}
