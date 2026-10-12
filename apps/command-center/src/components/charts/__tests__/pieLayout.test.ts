import { pieLayout, sectorPath } from '../pieLayout';

const options = { width: 600, height: 300, labelWidth: 120 };

describe('pieLayout', () => {
  it('splits the circle by share, starting at 12 o’clock', () => {
    const layout = pieLayout(
      [
        { label: 'A', value: 300 },
        { label: 'B', value: 100 },
      ],
      options,
    );
    expect(layout.wedges.map((wedge) => wedge.share)).toEqual([0.75, 0.25]);
    expect(layout.wedges[0].start).toBe(0);
    expect(layout.wedges[1].end).toBeCloseTo(Math.PI * 2);
    expect(layout.radius).toBe(138); // limited by height: 300 / 2 − 12
  });

  it('puts each label on the side its slice faces', () => {
    // A spans 12→6 o’clock on the right; B the left half.
    const layout = pieLayout(
      [
        { label: 'A', value: 1 },
        { label: 'B', value: 1 },
      ],
      options,
    );
    const side = (label: string) => layout.callouts.find((item) => item.label === label)?.side;
    expect(side('A')).toBe('right');
    expect(side('B')).toBe('left');
    const right = layout.callouts.find((item) => item.label === 'A')!;
    expect(right.textX).toBeGreaterThan(layout.cx + layout.radius);
  });

  it('keeps labels on one side apart and inside the chart', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ label: `S${index}`, value: 1 }));
    // Eight thin slices squeezed into the top-right quarter, plus one big slice.
    const layout = pieLayout([...many, { label: 'Big', value: 24 }], { ...options, minShare: 0 });
    const right = layout.callouts
      .filter((item) => item.side === 'right')
      .map((item) => item.y)
      .sort((a, b) => a - b);
    for (let index = 1; index < right.length; index += 1)
      expect(right[index] - right[index - 1]).toBeGreaterThanOrEqual(29.99);
    expect(right[0]).toBeGreaterThanOrEqual(12);
    expect(right[right.length - 1]).toBeLessThanOrEqual(300 - 18);
  });

  it('skips callouts for slivers', () => {
    const layout = pieLayout(
      [
        { label: 'Main', value: 99 },
        { label: 'Tiny', value: 1 },
      ],
      options,
    );
    expect(layout.callouts.map((item) => item.label)).toEqual(['Main']);
  });
});

describe('sectorPath', () => {
  it('draws a quarter slice from 12 to 3 o’clock', () => {
    expect(sectorPath(100, 100, 50, 0, Math.PI / 2)).toBe(
      'M 100 100 L 100 50 A 50 50 0 0 1 150 100 Z',
    );
  });
});
