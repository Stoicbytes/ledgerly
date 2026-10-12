import { arcPath, niceMax, smoothPath, ticks } from '../scales';

describe('niceMax', () => {
  it.each([
    [0, 1],
    [7, 10],
    [12, 20],
    [230, 250],
    [4_100_000, 5_000_000],
  ])('%d → %d', (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });
});

describe('ticks', () => {
  it('spaces ticks evenly from zero', () => {
    expect(ticks(100, 4)).toEqual([0, 25, 50, 75, 100]);
  });
});

describe('smoothPath', () => {
  it('starts at the first point and ends at the last', () => {
    const path = smoothPath([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 20, y: 5 },
    ]);
    expect(path.startsWith('M 0 10')).toBe(true);
    expect(path.trim().endsWith('20 5')).toBe(true);
  });

  it('handles empty and single-point input', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 1, y: 2 }])).toBe('M 1 2');
  });
});

describe('arcPath', () => {
  it('starts at 12 o’clock and uses the large-arc flag past half a turn', () => {
    expect(arcPath(50, 50, 40, 0, Math.PI / 2)).toMatch(/^M 50 10 A 40 40 0 0 1 /);
    expect(arcPath(50, 50, 40, 0, Math.PI * 1.5)).toMatch(/A 40 40 0 1 1 /);
  });
});
