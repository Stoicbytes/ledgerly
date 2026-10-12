import { View } from 'react-native';
import { subcategoriesOf, type Category, type CategoryKind } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { useExpenseStore } from '../state/expenseStore';
import { NewCategoryForm } from './NewCategory';
import { PickChip } from './PickChip';

type SubcategoryStripProps = {
  kind: CategoryKind;
  parent: Category;
  selectedId: string | null;
  /** Whether the "new subcategory" form is open. */
  creating: boolean;
  onCreate: () => void;
  onCancelCreate: () => void;
  onCreated: (id: string) => void;
  onChoose: (id: string) => void;
};

/** A category's subcategories, opened in place under its row, plus "+ New". */
export function SubcategoryStrip(props: SubcategoryStripProps) {
  const { kind, parent, selectedId, onChoose } = props;
  const theme = useTheme();
  const categories = useExpenseStore((state) => state.categories);
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.space[2],
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <PickChip
        label={`All ${parent.name}`}
        accessibilityLabel={`${parent.name}, no subcategory`}
        selected={selectedId === parent.id}
        onPress={() => onChoose(parent.id)}
      />
      {subcategoriesOf(categories, parent.id).map((sub) => (
        <PickChip
          key={sub.id}
          label={sub.name}
          accessibilityLabel={`${parent.name}, ${sub.name}`}
          selected={selectedId === sub.id}
          onPress={() => onChoose(sub.id)}
        />
      ))}
      <PickChip
        label="+ New"
        accessibilityLabel={`Add a subcategory to ${parent.name}`}
        onPress={props.onCreate}
      />
      {props.creating ? (
        <View style={{ width: '100%' }}>
          <NewCategoryForm
            kind={kind}
            parent={parent}
            onCreated={props.onCreated}
            onCancel={props.onCancelCreate}
          />
        </View>
      ) : null}
    </View>
  );
}
