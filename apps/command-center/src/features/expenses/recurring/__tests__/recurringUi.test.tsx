import { act, fireEvent, screen } from '@testing-library/react-native';
import { addMonths, monthOf, todayIso } from '@/lib/domain/expenses';
import { renderWithProviders } from '@/test/render';
import { TransactionSheet } from '../../entry/TransactionSheet';
import { useExpenseStore } from '../../state/expenseStore';
import { useRecurringStore } from '../../state/recurringStore';
import { useTransactionForm } from '../../state/transactionForm';
import { RecurringDueCard } from '../RecurringDueCard';
import { RecurringSheet } from '../RecurringSheet';

const rules = () => useRecurringStore.getState().rules;
const today = todayIso();

beforeEach(() => {
  useExpenseStore.getState().resetPreview();
  useRecurringStore.getState().resetPreview();
  useTransactionForm.setState({ open: false, editingId: null, active: null, errors: {} });
});

describe('Repeat in the entry sheet', () => {
  it('makes a new entry repeat monthly, and Undo removes the rule too', async () => {
    useRecurringStore.setState({ rules: [] });
    await renderWithProviders(<TransactionSheet />);
    await act(() => useTransactionForm.getState().openNew({ date: today }));
    await fireEvent.changeText(screen.getByLabelText('Amount in rupees'), '499');
    await fireEvent.press(screen.getByRole('button', { name: 'Rent' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Main bank, balance/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Monthly' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(rules()).toEqual([
      expect.objectContaining({ amount: 49_900, frequency: 'monthly', startDate: today }),
    ]);
    expect(screen.getByText('Expense added · ₹499 · repeats monthly')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(rules()).toEqual([]);
  });

  it('is not offered when editing an entry', async () => {
    await renderWithProviders(<TransactionSheet />);
    const entry = useExpenseStore.getState().transactions[0];
    await act(() => useTransactionForm.getState().openEdit(entry));
    expect(screen.queryByRole('checkbox', { name: 'Monthly' })).toBeNull();
  });
});

describe('Due recurring entries', () => {
  it('opens a due entry in the sheet with its amount, and saving moves the rule on', async () => {
    await renderWithProviders(
      <>
        <RecurringDueCard />
        <TransactionSheet />
      </>,
    );
    expect(screen.getByText('Recurring · 1 due')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Add Rent for/ }));
    expect(useTransactionForm.getState().draft).toMatchObject({
      amountText: '14000',
      categoryId: 'expense-rent',
      accountId: 'acc-main',
    });
    await fireEvent.changeText(screen.getByLabelText('Amount in rupees'), '14500');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(rules()[0].nextDate).toBe(`${addMonths(monthOf(today), 1)}-01`);
    expect(screen.queryByText('Recurring · 1 due')).toBeNull();
  });

  it('skips a date with Undo, and adds all at once', async () => {
    await renderWithProviders(<RecurringDueCard />);
    await fireEvent.press(screen.getByRole('button', { name: /^Skip Rent for/ }));
    expect(screen.queryByText('Recurring · 1 due')).toBeNull();
    await act(() => useRecurringStore.getState().resetPreview());
    const before = useExpenseStore.getState().transactions.length;
    await fireEvent.press(screen.getByRole('button', { name: 'Add all' }));
    expect(useExpenseStore.getState().transactions).toHaveLength(before + 1);
  });

  it('lists rules and changes one', async () => {
    await renderWithProviders(<RecurringSheet visible onClose={() => {}} />);
    await fireEvent.press(screen.getByRole('button', { name: /^Rent, ₹14,000, Every month/ }));
    await fireEvent.changeText(screen.getByLabelText('Amount'), '15000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(rules()[0].amount).toBe(15_000_00);
  });
});
