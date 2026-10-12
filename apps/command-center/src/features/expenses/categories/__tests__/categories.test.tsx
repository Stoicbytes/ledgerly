import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { useExpenseStore } from '../../state/expenseStore';
import { CategoryEditor } from '../CategoryEditor';
import { DeleteCategorySheet } from '../DeleteCategorySheet';

const FOOD = 'expense-food';
const FAMILY = 'expense-family';
const food = () => useExpenseStore.getState().categories.find((item) => item.id === FOOD)!;

beforeEach(() => useExpenseStore.getState().resetPreview());

describe('DeleteCategorySheet', () => {
  it('moves the entries to the chosen category and can undo', async () => {
    const before = useExpenseStore
      .getState()
      .transactions.filter((item) => item.categoryId?.startsWith(FOOD)).length;
    expect(before).toBeGreaterThan(0);
    const onDeleted = jest.fn();
    await renderWithProviders(
      <DeleteCategorySheet category={food()} onClose={jest.fn()} onDeleted={onDeleted} />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Family' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Food' }));
    const state = useExpenseStore.getState();
    expect(state.categories.some((item) => item.id === FOOD || item.parentId === FOOD)).toBe(false);
    expect(
      state.transactions.filter((item) => item.categoryId === FAMILY).length,
    ).toBeGreaterThanOrEqual(before);
    expect(onDeleted).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(food()).toBeDefined();
    expect(
      useExpenseStore.getState().transactions.filter((item) => item.categoryId?.startsWith(FOOD)),
    ).toHaveLength(before);
  });
});

describe('CategoryEditor', () => {
  it('rejects a duplicate name and an invalid budget', async () => {
    await renderWithProviders(
      <CategoryEditor category={null} kind="expense" onSaved={jest.fn()} onDelete={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Name'), ' food ');
    await fireEvent.changeText(screen.getByLabelText('Monthly budget'), 'lots');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('That name is already used here.')).toBeTruthy();
    expect(screen.getByText('Enter a monthly amount like 5,000, or leave it empty.')).toBeTruthy();
  });

  it('adds a category with its budget, icon and colour', async () => {
    const onSaved = jest.fn();
    await renderWithProviders(
      <CategoryEditor category={null} kind="expense" onSaved={onSaved} onDelete={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Pets');
    await fireEvent.changeText(screen.getByLabelText('Monthly budget'), '2,500');
    await fireEvent.press(screen.getByRole('radio', { name: 'pets icon' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Colour 6' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    const added = useExpenseStore.getState().categories.find((item) => item.name === 'Pets');
    expect(added).toMatchObject({
      kind: 'expense',
      parentId: null,
      icon: 'pets',
      tint: 5,
      budget: 250_000,
    });
    expect(onSaved).toHaveBeenCalledWith(added?.id);
  });
});
