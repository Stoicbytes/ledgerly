import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { BudgetEditor } from '../BudgetEditor';

const field = () => screen.getByLabelText('Monthly budget for Food, in rupees');

describe('BudgetEditor', () => {
  it('saves a valid amount in paise', async () => {
    const onSave = jest.fn();
    await renderWithProviders(
      <BudgetEditor name="Food" value={900_000} onSave={onSave} onCancel={jest.fn()} />,
    );
    expect(field().props.value).toBe('9000');
    await fireEvent.changeText(field(), '7,500');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(750_000);
  });

  it('explains an invalid amount instead of saving', async () => {
    const onSave = jest.fn();
    await renderWithProviders(
      <BudgetEditor name="Food" value={null} onSave={onSave} onCancel={jest.fn()} />,
    );
    await fireEvent.changeText(field(), 'abc');
    await fireEvent(field(), 'submitEditing');
    expect(screen.getByText('Enter a monthly amount like 5,000.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('removes a budget, or cancels with Escape', async () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    await renderWithProviders(
      <BudgetEditor name="Food" value={900_000} onSave={onSave} onCancel={onCancel} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(onSave).toHaveBeenCalledWith(null);
    await fireEvent(field(), 'keyPress', { nativeEvent: { key: 'Escape' } });
    expect(onCancel).toHaveBeenCalled();
  });
});
