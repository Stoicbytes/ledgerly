import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ChevronDown, ChevronUp, Plus, Trash2 } from '@/components/icons';
import { useToast } from '@/components/feedback';
import { Button, IconButton, Text } from '@/components/ui';
import {
  entryCounts,
  MAX_NAME_LENGTH,
  subcategoriesOf,
  validateName,
  type Category,
} from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { TextField } from '../components/TextField';
import { useLedger } from '../hooks/useLedger';
import { useExpenseStore } from '../state/expenseStore';
import { EntryInput } from '../entry/EntryInput';

/** Rename, reorder, delete and add the subcategories of one category. */
export function SubcategoryList({ parent }: { parent: Category }) {
  const theme = useTheme();
  const toast = useToast();
  const { categories, transactions } = useLedger();
  const store = useExpenseStore.getState;
  const subs = subcategoriesOf(categories, parent.id);
  const counts = useMemo(() => entryCounts(transactions, categories), [transactions, categories]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const problem = validateName(name, subs);
    if (problem) return setError(problem);
    store().saveCategory({
      kind: parent.kind,
      parentId: parent.id,
      name,
      icon: parent.icon,
      tint: parent.tint,
      budget: null,
    });
    setName('');
  };
  const remove = (sub: Category) => {
    const previous = store().deleteCategory(sub.id, null);
    const moved = counts.get(sub.id) ?? 0;
    toast.show({
      message: `${sub.name} deleted${moved ? ` · ${moved} entries moved to ${parent.name}` : ''}`,
      action: { label: 'Undo', onPress: () => store().restoreLedger(previous) },
    });
  };
  return (
    <View style={{ gap: theme.space[2] }}>
      <Text variant="label" color="textSecondary">
        Subcategories · {subs.length}
      </Text>
      {subs.map((sub, index) => (
        <SubcategoryRow
          key={sub.id}
          sub={sub}
          siblings={subs}
          entries={counts.get(sub.id) ?? 0}
          first={index === 0}
          last={index === subs.length - 1}
          onRename={(next) => store().saveCategory({ ...sub, name: next }, sub.id)}
          onMove={(direction) => store().moveCategory(sub.id, direction)}
          onDelete={() => remove(sub)}
        />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space[2] }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={`New subcategory of ${parent.name}`}
            value={name}
            onChangeText={(next) => {
              setName(next);
              setError(null);
            }}
            onSubmitEditing={add}
            maxLength={MAX_NAME_LENGTH}
            placeholder="e.g. Snacks"
            error={error}
          />
        </View>
        <View style={{ marginBottom: error ? 26 : 4 }}>
          <Button label="Add" icon={Plus} size="sm" variant="secondary" onPress={add} />
        </View>
      </View>
    </View>
  );
}

type SubcategoryRowProps = {
  sub: Category;
  siblings: Category[];
  entries: number;
  first: boolean;
  last: boolean;
  onRename: (name: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
};

/** Inline rename: the change is kept when the field loses focus or Enter is pressed. */
function SubcategoryRow({
  sub,
  siblings,
  entries,
  first,
  last,
  onRename,
  onMove,
  onDelete,
}: SubcategoryRowProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState(sub.name);
  const [error, setError] = useState<string | null>(null);
  const commit = () => {
    if (draft.trim() === sub.name) return setError(null);
    const problem = validateName(draft, siblings, sub.id);
    if (problem) return setError(problem);
    setError(null);
    onRename(draft);
  };
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[1],
          paddingLeft: theme.space[3],
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <EntryInput
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            maxLength={MAX_NAME_LENGTH}
            accessibilityLabel={`Rename ${sub.name}`}
          />
        </View>
        <Text variant="caption" color="textTertiary" numeric>
          {entries}
        </Text>
        <IconButton
          icon={ChevronUp}
          size="sm"
          disabled={first}
          accessibilityLabel={`Move ${sub.name} up`}
          onPress={() => onMove(-1)}
        />
        <IconButton
          icon={ChevronDown}
          size="sm"
          disabled={last}
          accessibilityLabel={`Move ${sub.name} down`}
          onPress={() => onMove(1)}
        />
        <IconButton
          icon={Trash2}
          size="sm"
          tone="danger"
          accessibilityLabel={`Delete ${sub.name}`}
          onPress={onDelete}
        />
      </View>
      {error ? (
        <Text variant="caption" color="danger" role="alert" style={{ marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
