import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { useExpenseStore } from '../../state/expenseStore';
import { useTransactionForm } from '../../state/transactionForm';
import { CalendarView } from '../CalendarView';

beforeEach(() => {
  useExpenseStore.getState().resetPreview();
  useTransactionForm.setState({ open: false, editingId: null });
});

const days = () => screen.getAllByRole('button');
const emptyDay = () => days().findIndex((d) => /no entries$/.test(d.props.accessibilityLabel));
/** A day of the shown month (the grid's middle cell is always in it) with entries. */
function busyDay() {
  const month = /\w+ \d{4}/.exec(days()[15].props.accessibilityLabel)![0];
  return days().findIndex(
    (d) =>
      d.props.accessibilityLabel.includes(month) &&
      !/no entries$/.test(d.props.accessibilityLabel) &&
      !d.props.accessibilityState.selected,
  );
}

describe('CalendarView', () => {
  it('opens Add straight away on an empty day', async () => {
    await renderWithProviders(<CalendarView fill={false} />);
    const index = emptyDay();
    expect(index).toBeGreaterThanOrEqual(0);
    await fireEvent.press(days()[index]);
    expect(useTransactionForm.getState()).toMatchObject({ open: true, editingId: null });
    expect(days()[index].props.accessibilityState.selected).toBe(true);
  });

  it('shows a day with entries first, and adds on the second tap', async () => {
    await renderWithProviders(<CalendarView fill={false} />);
    const index = busyDay();
    expect(index).toBeGreaterThanOrEqual(0);
    await fireEvent.press(days()[index]);
    expect(days()[index].props.accessibilityState.selected).toBe(true);
    expect(useTransactionForm.getState().open).toBe(false);
    await fireEvent.press(days()[index]);
    const form = useTransactionForm.getState();
    expect(form.open).toBe(true);
    expect(days()[index].props.accessibilityLabel).toContain(
      new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        new Date(`${form.draft.date}T12:00:00`),
      ),
    );
  });
});
