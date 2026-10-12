import { useState } from 'react';
import { BentoCell, BentoRow } from '@/components/layout/Bento';
import { Screen, useFitMode } from '@/components/layout/Screen';
import { Sheet } from '@/components/overlays';
import { Card } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { topLevelCategories, type Category, type CategoryKind } from '@/lib/domain/expenses';
import { CategoryEditor } from '../categories/CategoryEditor';
import { CategoryListCard } from '../categories/CategoryListCard';
import { DeleteCategorySheet } from '../categories/DeleteCategorySheet';
import { ExpensesHeader } from '../components/ExpensesHeader';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { useExpenseStore } from '../state/expenseStore';

/**
 * Expenses › Categories (Money Manager's category settings): the list beside
 * an editor on desktop; on phones the editor opens as a sheet.
 */
export function CategoriesScreen() {
  const fit = useFitMode(true);
  const { isDesktop } = useBreakpoint();
  const categories = useExpenseStore((state) => state.categories);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [selection, setSelection] = useState<string | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const parents = topLevelCategories(categories, kind);
  const creating = selection === 'new';
  // Desktop always shows an editor: the chosen category, else the first one.
  const chosen = creating
    ? null
    : (parents.find((item) => item.id === selection) ?? (isDesktop ? (parents[0] ?? null) : null));
  const editorOpen = creating || chosen !== null;
  const editor = editorOpen ? (
    <CategoryEditor
      key={creating ? `new-${kind}` : chosen?.id}
      category={chosen}
      kind={kind}
      onSaved={setSelection}
      onDelete={() => setDeleting(chosen)}
      onCancel={creating || !isDesktop ? () => setSelection(null) : undefined}
    />
  ) : null;
  const grow = fit ? { flex: 1 } : undefined;
  return (
    <Screen fit>
      <ExpensesHeader period="none" />
      <BentoRow stackBelow="desktop" fill={1}>
        <BentoCell flex={5}>
          <CategoryListCard
            kind={kind}
            onKind={(next) => {
              setKind(next);
              setSelection(null);
            }}
            selectedId={chosen?.id ?? null}
            onSelect={setSelection}
            onAdd={() => setSelection('new')}
            style={grow}
          />
        </BentoCell>
        {isDesktop ? (
          <BentoCell flex={7}>
            <Card index={2} style={grow}>
              <PanelScroll>{editor}</PanelScroll>
            </Card>
          </BentoCell>
        ) : null}
      </BentoRow>
      {isDesktop ? null : (
        <Sheet
          visible={editorOpen}
          onClose={() => setSelection(null)}
          title={chosen ? chosen.name : `New ${kind} category`}
        >
          {editor}
        </Sheet>
      )}
      {deleting ? (
        <DeleteCategorySheet
          key={deleting.id}
          category={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setSelection(null);
          }}
        />
      ) : null}
    </Screen>
  );
}
