import { greeting } from '../greeting';

describe('greeting', () => {
  const at = (hour: number) => new Date(2026, 9, 7, hour, 30);
  it.each([
    [2, 'Good evening'],
    [6, 'Good morning'],
    [13, 'Good afternoon'],
    [20, 'Good evening'],
  ])('%i:30 → %s', (hour, text) => {
    expect(greeting(at(hour))).toBe(text);
  });
});
