import { createRef } from 'react';
import type { TextInput } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { useTransactionForm } from '../../state/transactionForm';
import { AmountField } from '../AmountField';

const amountText = () => useTransactionForm.getState().draft.amountText;

beforeEach(() => {
  useTransactionForm.getState().openNew();
});

describe('AmountField calculator', () => {
  it('shows the result of a sum and turns it into the amount on Enter', async () => {
    await renderWithProviders(<AmountField inputRef={createRef<TextInput>()} />);
    const input = screen.getByLabelText('Amount in rupees');
    await fireEvent.changeText(input, '120+45');
    expect(screen.getByText('= ₹165')).toBeTruthy();
    await fireEvent(input, 'submitEditing');
    expect(amountText()).toBe('165');
  });

  it('adds operators from the keys and flags an unfinished sum', async () => {
    await renderWithProviders(<AmountField inputRef={createRef<TextInput>()} />);
    await act(() => useTransactionForm.getState().setActive('amount'));
    await fireEvent.changeText(screen.getByLabelText('Amount in rupees'), '200');
    await fireEvent.press(screen.getByRole('button', { name: 'Divided by' }));
    expect(amountText()).toBe('200÷');
    expect(screen.getByText('Not a valid sum yet')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Amount in rupees'), '200÷4');
    expect(screen.getByText('= ₹50')).toBeTruthy();
  });

  it('saves the evaluated sum when Save is pressed straight away', () => {
    useTransactionForm.getState().update({ amountText: '100+50' });
    expect(useTransactionForm.getState().submit('save')).toEqual({ ok: false });
    // Only the missing category and account are reported, not the amount.
    expect(useTransactionForm.getState().errors.amount).toBeUndefined();
  });
});
