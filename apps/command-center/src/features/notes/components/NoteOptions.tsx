import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Check, X } from '@/components/icons';
import { Text } from '@/components/ui';
import { matchLabel, NOTE_LIMITS } from '@/lib/domain/notes';
import { fontFamily, useTheme } from '@/theme';
import { NOTE_COLORS, noteColors, type NoteColor } from '@/theme/noteColors';

/** Colour swatches for a note. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: NoteColor;
  onChange: (color: NoteColor) => void;
}) {
  const theme = useTheme();
  return (
    <View
      role="radiogroup"
      accessibilityLabel="Note colour"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}
    >
      {NOTE_COLORS.map((color) => {
        const selected = color === value;
        return (
          <Pressable
            key={color}
            role="radio"
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            accessibilityLabel={color === 'default' ? 'No colour' : `${color} colour`}
            onPress={() => onChange(color)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? theme.colors.textPrimary : theme.colors.borderStrong,
              backgroundColor:
                color === 'default' ? theme.colors.surface : noteColors[theme.scheme][color],
            }}
          >
            {selected ? <Check size={14} color={theme.colors.textPrimary} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Labels on a note: remove with ×, add by typing and pressing Enter. */
export function LabelEditor({
  labels,
  known = [],
  onChange,
}: {
  labels: string[];
  /** Labels on other notes: a label typed in another case reuses their spelling. */
  known?: string[];
  onChange: (labels: string[]) => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const full = labels.length >= NOTE_LIMITS.labels;
  const add = () => {
    const label = matchLabel(draft, known);
    if (!label || full) return;
    if (!labels.some((item) => item.toLocaleLowerCase() === label.toLocaleLowerCase())) {
      onChange([...labels, label]);
    }
    setDraft('');
  };
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space[2] }}
    >
      {labels.map((label) => (
        <Pressable
          key={label}
          role="button"
          accessibilityLabel={`Remove label ${label}`}
          onPress={() => onChange(labels.filter((item) => item !== label))}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: theme.radius.pill,
            borderWidth: 1,
            borderColor: theme.colors.borderStrong,
          }}
        >
          <Text variant="caption">{label}</Text>
          <X size={12} color={theme.colors.textPrimary} />
        </Pressable>
      ))}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={add}
        blurOnSubmit={false}
        placeholder={full ? `${NOTE_LIMITS.labels} labels at most` : 'Add label'}
        editable={!full}
        placeholderTextColor={theme.colors.textSecondary}
        maxLength={NOTE_LIMITS.label}
        accessibilityLabel="Add a label"
        style={{
          minWidth: 100,
          paddingVertical: 4,
          color: theme.colors.textPrimary,
          fontFamily: fontFamily.regular,
          fontSize: 13,
          outlineWidth: 0,
        }}
      />
    </View>
  );
}
