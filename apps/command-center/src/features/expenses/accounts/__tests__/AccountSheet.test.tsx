import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { useExpenseStore } from '../../state/expenseStore';
import { AccountSheet } from '../AccountSheet';

beforeEach(() => useExpenseStore.getState().resetPreview());

const find = (name: string) =>
  useExpenseStore.getState().accounts.find((item) => item.name === name);

describe('AccountSheet', () => {
  it('adds a card as money owed', async () => {
    const onSaved = jest.fn();
    await renderWithProviders(
      <AccountSheet account={null} onClose={jest.fn()} onSaved={onSaved} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Travel card');
    await fireEvent.press(screen.getByRole('button', { name: 'Card' }));
    await fireEvent.changeText(screen.getByLabelText('Opening balance'), '1,200');
    await fireEvent.press(screen.getByRole('button', { name: 'Add account' }));
    expect(find('Travel card')).toMatchObject({ group: 'card', openingBalance: -120_000 });
    expect(onSaved).toHaveBeenCalledWith(find('Travel card')?.id);
  });

  it('refuses a name that is already taken', async () => {
    const onSaved = jest.fn();
    await renderWithProviders(
      <AccountSheet account={null} onClose={jest.fn()} onSaved={onSaved} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Name'), 'cash');
    await fireEvent.press(screen.getByRole('button', { name: 'Add account' }));
    expect(screen.getByText('That name is already used here.')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not delete an account that has entries', async () => {
    const cash = find('Cash')!;
    await renderWithProviders(
      <AccountSheet account={cash} onClose={jest.fn()} onSaved={jest.fn()} />,
    );
    expect(
      screen.getByText(
        'Accounts with entries or recurring entries cannot be deleted. Move or delete them first.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(find('Cash')).toBeDefined();
  });
});
