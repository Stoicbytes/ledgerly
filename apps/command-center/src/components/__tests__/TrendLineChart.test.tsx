import { fireEvent, screen } from '@testing-library/react-native';
import { TrendLineChart } from '@/components/charts';
import { renderWithProviders } from '@/test/render';

const points = [
  { label: 'Nov', value: 483833, name: 'November 2025' },
  { label: 'Dec', value: 361292, name: 'December 2025' },
  { label: 'Jan', sublabel: '2026', value: 259867, name: 'January 2026' },
];

describe('TrendLineChart', () => {
  it('offers each month as a labelled button that opens it', async () => {
    const onSelect = jest.fn();
    await renderWithProviders(
      <TrendLineChart
        points={points}
        color="#FF9447"
        selected={1}
        formatValue={(value) => `₹${Math.round(value / 100)}`}
        onSelect={onSelect}
        accessibilityLabel="Food by month"
      />,
    );
    await fireEvent(screen.getByLabelText('Food by month'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 170 } },
    });
    const december = screen.getByLabelText('Show December 2025: ₹3613');
    expect(december.props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByLabelText('Show January 2026: ₹2599'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
