import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Button, Delta, Money, ProgressBar, SegmentedControl } from '@/components/ui';
import { renderWithProviders } from '@/test/render';

describe('Money', () => {
  it('shows a signed value and announces the sign in words', async () => {
    await renderWithProviders(<Money value={-125050} tone="auto" />);
    expect(screen.getByText('−₹1,250.50')).toBeTruthy();
    expect(screen.getByLabelText('minus ₹1,250.50')).toBeTruthy();
  });

  it('forces a plus sign for positive auto-toned values', async () => {
    await renderWithProviders(<Money value={5000} tone="auto" />);
    expect(screen.getByText('+₹50.00')).toBeTruthy();
  });
});

describe('Delta', () => {
  it('describes direction and whether it is favourable, not just colour', async () => {
    await renderWithProviders(<Delta value={18.4} goodWhen="down" comparison="vs Sep" />);
    expect(screen.getByLabelText('Up 18.4 percent vs Sep, unfavourable')).toBeTruthy();
    expect(screen.getByText('+18.4%')).toBeTruthy();
  });

  it('treats changes that round to 0.0% as no change', async () => {
    await renderWithProviders(<Delta value={-0.04} />);
    expect(screen.getByLabelText('No change')).toBeTruthy();
  });

  it('handles no change', async () => {
    await renderWithProviders(<Delta value={0} />);
    expect(screen.getByLabelText('No change')).toBeTruthy();
  });
});

describe('Button', () => {
  it('fires onPress and exposes role and label', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while loading and reports busy', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Save" loading onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });
});

describe('SegmentedControl', () => {
  function Harness() {
    const [value, setValue] = useState<'income' | 'expense'>('expense');
    return (
      <SegmentedControl
        accessibilityLabel="Type"
        value={value}
        onChange={setValue}
        segments={[
          { value: 'income', label: 'Income', tone: 'income' },
          { value: 'expense', label: 'Expense', tone: 'expense' },
        ]}
      />
    );
  }

  it('marks exactly one segment as checked and updates on press', async () => {
    await renderWithProviders(<Harness />);
    expect(screen.getByRole('radio', { name: 'Expense' }).props.accessibilityState.checked).toBe(
      true,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Income' }));
    expect(screen.getByRole('radio', { name: 'Income' }).props.accessibilityState.checked).toBe(
      true,
    );
    expect(screen.getByRole('radio', { name: 'Expense' }).props.accessibilityState.checked).toBe(
      false,
    );
  });
});

describe('ProgressBar', () => {
  it('clamps and exposes its value', async () => {
    await renderWithProviders(<ProgressBar value={1.7} accessibilityLabel="Budget used" />);
    expect(screen.getByLabelText('Budget used').props.accessibilityValue).toMatchObject({
      now: 100,
    });
  });
});
