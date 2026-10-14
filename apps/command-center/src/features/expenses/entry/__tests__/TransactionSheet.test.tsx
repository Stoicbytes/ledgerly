import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { useExpenseStore } from '../../state/expenseStore';
import { useTransactionForm } from '../../state/transactionForm';
import { CategoryPicker } from '../CategoryPicker';
import { TransactionSheet } from '../TransactionSheet';

const TEA = 'expense-food--tea';

beforeEach(() => {
  useExpenseStore.getState().resetPreview();
  useTransactionForm.setState({
    open: false,
    editingId: null,
    active: null,
    errors: {},
    last: { kind: 'expense', accounts: {} },
  });
});

describe('CategoryPicker', () => {
  it('puts the categories used most in the last 90 days first', async () => {
    const onChoose = jest.fn();
    await renderWithProviders(
      <CategoryPicker kind="expense" selectedId={null} onChoose={onChoose} columns={3} />,
    );
    expect(screen.getByText('Used most')).toBeTruthy();
    const tea = screen.getAllByRole('button', { name: 'Food, Tea' });
    await fireEvent.press(tea[0]);
    expect(onChoose).toHaveBeenCalledWith(TEA);
  });

  it('opens subcategories in place under their parent and picks one', async () => {
    // No recent entries: no "Used most" shortcuts, only the grid.
    useExpenseStore.setState({ transactions: [] });
    const onChoose = jest.fn();
    await renderWithProviders(
      <CategoryPicker kind="expense" selectedId={null} onChoose={onChoose} columns={3} />,
    );
    expect(screen.queryByRole('button', { name: 'Food, Tea' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Food, Tea' }));
    expect(onChoose).toHaveBeenCalledWith(TEA);
  });

  it('keeps the parent with "All …" and picks leaf categories directly', async () => {
    const onChoose = jest.fn();
    await renderWithProviders(
      <CategoryPicker kind="expense" selectedId={null} onChoose={onChoose} columns={3} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Food, no subcategory' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Rent' }));
    expect(onChoose.mock.calls).toEqual([['expense-food'], ['expense-rent']]);
  });

  it('finds subcategories by search', async () => {
    const onChoose = jest.fn();
    await renderWithProviders(
      <CategoryPicker kind="expense" selectedId={null} onChoose={onChoose} columns={3} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Search categories'), 'biri');
    await fireEvent.press(screen.getByRole('button', { name: 'Food, Veg biriyani' }));
    expect(onChoose).toHaveBeenCalledWith('expense-food--veg-biriyani');
  });
});

describe('creating a category while adding an entry', () => {
  const picker = (onChoose: jest.Mock) =>
    renderWithProviders(
      <CategoryPicker kind="expense" selectedId={null} onChoose={onChoose} columns={3} />,
    );
  const byName = (name: string) =>
    useExpenseStore.getState().categories.find((item) => item.name === name);

  it('creates a category from a search that finds nothing, and picks it', async () => {
    const onChoose = jest.fn();
    await picker(onChoose);
    await fireEvent.changeText(screen.getByLabelText('Search categories'), 'Pets');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Create the expense category Pets and use it' }),
    );
    expect(byName('Pets')).toMatchObject({ kind: 'expense', parentId: null });
    expect(onChoose).toHaveBeenCalledWith(byName('Pets')?.id);
  });

  it('adds a subcategory under the opened category', async () => {
    const onChoose = jest.fn();
    await picker(onChoose);
    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add a subcategory to Food' }));
    await fireEvent.changeText(screen.getByLabelText('New subcategory of Food'), 'Pizza');
    await fireEvent.press(screen.getByRole('button', { name: 'Add and use' }));
    expect(byName('Pizza')).toMatchObject({ parentId: 'expense-food', icon: 'food' });
    expect(onChoose).toHaveBeenCalledWith(byName('Pizza')?.id);
  });

  it('adds a top-level category from the button under the grid, refusing duplicates', async () => {
    const onChoose = jest.fn();
    await picker(onChoose);
    await fireEvent.press(screen.getByRole('button', { name: 'New expense category' }));
    const field = screen.getByLabelText('New expense category');
    await fireEvent.changeText(field, 'food');
    await fireEvent.press(screen.getByRole('button', { name: 'Add and use' }));
    expect(screen.getByText('That name is already used here.')).toBeTruthy();
    await fireEvent.changeText(field, 'Charity');
    await fireEvent.press(screen.getByRole('button', { name: 'Add and use' }));
    expect(onChoose).toHaveBeenCalledWith(byName('Charity')?.id);
  });
});

describe('TransactionSheet', () => {
  const open = () => act(() => useTransactionForm.getState().openNew());

  it('adds an expense through the fast path: amount → category → account → note', async () => {
    useExpenseStore.setState({ transactions: [] });
    await renderWithProviders(<TransactionSheet />);
    await open();
    const amount = screen.getByLabelText('Amount in rupees');
    await fireEvent.changeText(amount, '120');
    await fireEvent(amount, 'submitEditing');
    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Food, Tea' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Cash, balance/ }));
    expect(useTransactionForm.getState().active).toBe('note');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Chai');
    // Enter in the note saves exactly like the Save button (toast with Undo included).
    await fireEvent(screen.getByLabelText('Note'), 'submitEditing');

    const saved = useExpenseStore.getState().transactions.find((item) => item.note === 'Chai');
    expect(saved).toMatchObject({
      kind: 'expense',
      amount: 12_000,
      categoryId: TEA,
      accountId: 'acc-cash',
    });
    expect(useTransactionForm.getState().open).toBe(false);
    expect(screen.getByText('Expense added · ₹120')).toBeTruthy();
  });

  it('suggests earlier notes while typing and brings their category', async () => {
    await renderWithProviders(<TransactionSheet />);
    await open();
    await act(() => useTransactionForm.getState().setActive('note'));
    await fireEvent.changeText(screen.getByLabelText('Note'), 'morn');
    await fireEvent.press(screen.getByRole('button', { name: 'Morning tea' }));
    expect(useTransactionForm.getState().draft).toMatchObject({
      note: 'Morning tea',
      categoryId: TEA,
    });
  });

  it('says what is missing and keeps the entry open', async () => {
    await renderWithProviders(<TransactionSheet />);
    await open();
    const before = useExpenseStore.getState().transactions.length;
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter an amount like 250, 1,250.50 or 120+45.')).toBeTruthy();
    expect(screen.getByText('Choose a category.')).toBeTruthy();
    expect(screen.getByText('Choose an account.')).toBeTruthy();
    expect(useExpenseStore.getState().transactions).toHaveLength(before);
    expect(useTransactionForm.getState()).toMatchObject({ open: true, active: 'amount' });
  });

  it('continues with the same date and account after saving', async () => {
    await renderWithProviders(<TransactionSheet />);
    await act(() =>
      useTransactionForm
        .getState()
        .openNew({ date: '2026-10-05', accountId: 'acc-main', categoryId: 'expense-rent' }),
    );
    const before = new Set(useExpenseStore.getState().transactions.map((item) => item.id));
    await fireEvent.changeText(screen.getByLabelText('Amount in rupees'), '50');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    const added = useExpenseStore.getState().transactions.filter((item) => !before.has(item.id));
    expect(added).toMatchObject([{ amount: 5_000, categoryId: 'expense-rent' }]);
    expect(screen.getByText('Expense added · ₹50')).toBeTruthy();
    expect(useTransactionForm.getState().draft).toMatchObject({
      date: '2026-10-05',
      accountId: 'acc-main',
      amountText: '',
      categoryId: null,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(useExpenseStore.getState().transactions.map((item) => item.id)).not.toContain(
      added[0].id,
    );
  });

  it('deletes the entry being edited and can undo it', async () => {
    const entry = useExpenseStore.getState().transactions[0];
    await renderWithProviders(<TransactionSheet />);
    await act(() => useTransactionForm.getState().openEdit(entry));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete this entry' }));
    const exists = () =>
      useExpenseStore.getState().transactions.some((item) => item.id === entry.id);
    expect(exists()).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(exists()).toBe(true);
  });
});
