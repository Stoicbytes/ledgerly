import { act, fireEvent, screen } from '@testing-library/react-native';
import { deleteGoal, saveGoal } from '@/features/investments/state/goalActions';
import { useGoalStore } from '@/features/investments/state/goalStore';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { buy, fund } from '@/lib/domain/investments/__fixtures__';
import { EMPTY_PORTFOLIO } from '@/lib/domain/investments';
import { renderWithProviders } from '@/test/render';
import { FundEditSheet } from '../../FundEditSheet';
import { SipSheet } from '../../SipSheet';
import { CostsPanel } from '../CostsPanel';
import { GoalsPanel } from '../GoalsPanel';
import { InsightsSheet } from '../InsightsSheet';

const funds = () => usePortfolioStore.getState().funds;
const largeCap = (id: string, patch = {}) =>
  fund({
    id,
    name: `Large ${id}`,
    schemeCode: null,
    manualNav: 20,
    manualNavDate: '2026-10-01',
    ...patch,
  });

beforeEach(() => {
  useGoalStore.setState({ goals: [], available: true });
  usePortfolioStore.setState({
    ...EMPTY_PORTFOLIO,
    funds: [largeCap('a', { expenseRatio: 1 }), largeCap('b')],
    fundTxns: [
      buy('2026-01-05', 1_000_000, 1_000, 10, { fundId: 'a' }),
      buy('2026-01-05', 500_000, 500, 10, { fundId: 'b' }),
    ],
  });
});

describe('expense ratio and goal on a fund', () => {
  it('saves both, and refuses an expense ratio over 5 %', async () => {
    saveGoal({
      name: 'House',
      targetAmount: 50_000_00,
      targetDate: '2031-04-01',
      expectedReturn: 10,
    });
    await renderWithProviders(<FundEditSheet fundId="b" onClose={jest.fn()} onSaved={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Expense ratio (%)'), '7');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByText('Enter the expense ratio in percent, like 0.45 (up to 5).'),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Expense ratio (%)'), '0.45');
    await fireEvent.press(screen.getByRole('button', { name: 'House' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(funds().find((item) => item.id === 'b')).toMatchObject({
      expenseRatio: 0.45,
      goalId: useGoalStore.getState().goals[0].id,
    });
  });

  it('keeps them when the fund is saved from elsewhere', () => {
    usePortfolioStore.getState().saveFund({ ...largeCap('a'), expenseRatio: undefined }, 'a');
    expect(funds().find((item) => item.id === 'a')?.expenseRatio).toBe(1);
  });
});

describe('costs and similar funds', () => {
  it('adds up the yearly cost and lists funds sharing a category', async () => {
    await renderWithProviders(<CostsPanel />);
    // 1,000 units at ₹20 = ₹20,000 × 1 % = ₹200 a year.
    expect(screen.getAllByText('₹200.00')).toHaveLength(2);
    expect(screen.getByText('Not counted yet: Large b.')).toBeTruthy();
    expect(screen.getByText('2 Large Cap Fund funds')).toBeTruthy();
  });
});

describe('goals', () => {
  it('adds a goal and shows how far the tied funds go', async () => {
    await renderWithProviders(<GoalsPanel />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add goal' }));
    await fireEvent.changeText(screen.getByLabelText('Goal'), 'Car');
    await fireEvent.changeText(screen.getByLabelText('Amount needed'), '1,00,000');
    await fireEvent.changeText(screen.getByLabelText('Yearly return to assume (%)'), '8');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    const [goal] = useGoalStore.getState().goals;
    expect(goal).toMatchObject({ name: 'Car', targetAmount: 1_00_000_00, expectedReturn: 8 });
    await act(() =>
      usePortfolioStore.setState({ funds: funds().map((f) => ({ ...f, goalId: goal.id })) }),
    );
    // ₹20,000 + ₹10,000 of ₹1,00,000.
    expect(screen.getByRole('button', { name: 'Car, 30 percent reached. Edit' })).toBeTruthy();
  });

  it('unties funds when a goal is deleted, and Undo ties them again', () => {
    const goal = saveGoal({
      name: 'X',
      targetAmount: 100,
      targetDate: '2030-01-01',
      expectedReturn: 0,
    });
    usePortfolioStore.setState({ funds: funds().map((f) => ({ ...f, goalId: goal.id })) });
    const undo = deleteGoal(goal.id)!;
    expect(funds().every((f) => f.goalId === null)).toBe(true);
    undo();
    expect(funds().every((f) => f.goalId === goal.id)).toBe(true);
  });

  it('hides goals and costs while the database does not have them', async () => {
    useGoalStore.setState({ available: false });
    await renderWithProviders(<InsightsSheet onClose={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Goals' })).toBeNull();
    expect(screen.getByText(/Redemptions by financial year/)).toBeTruthy();
  });
});

describe('SIP step-up', () => {
  it('shows the yearly instalments and saves the step-up', async () => {
    await renderWithProviders(<SipSheet fundId="a" sipId={null} onClose={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Monthly amount'), '5000');
    await fireEvent.changeText(screen.getByLabelText('Yearly step-up (%)'), '10');
    expect(screen.getByText('Year 1: ₹5,000 · Year 2: ₹5,500 · Year 3: ₹6,050 …')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Estimate at a yearly return of (%)'), '0');
    // ₹9,56,245.56 put in over ten years; at 0 % it is worth the same.
    expect(
      screen.getByText(/^In 10 years: ₹9,56,24\d put in, worth about ₹9,56,24\d at 0% a year/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add SIP' }));
    expect(usePortfolioStore.getState().sips[0]).toMatchObject({ amount: 500_000, stepUpPct: 10 });
  });

  it('refuses a step-up over 100 %', async () => {
    await renderWithProviders(<SipSheet fundId="a" sipId={null} onClose={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Monthly amount'), '5000');
    await fireEvent.changeText(screen.getByLabelText('Yearly step-up (%)'), '150');
    await fireEvent.press(screen.getByRole('button', { name: 'Add SIP' }));
    expect(screen.getByText('Enter a yearly step-up from 0 to 100 %.')).toBeTruthy();
  });
});
