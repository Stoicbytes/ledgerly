import { anchorFor, trendLayout } from '../trendLayout';

describe('trendLayout', () => {
  it('labels every point of a short monthly series', () => {
    const layout = trendLayout({ values: [3, 5, 2], width: 300, height: 170 });
    expect(layout.dense).toBe(false);
    expect([...layout.labelled]).toEqual([0, 1, 2]);
    expect(layout.ticks).toEqual([0, 1, 2]);
  });

  it('labels only the high, low, latest and touched points of a long series', () => {
    const values = Array.from({ length: 30 }, (_, index) => 100 + ((index * 7) % 13));
    values[4] = 500;
    values[9] = 10;
    const layout = trendLayout({ values, width: 600, height: 170, active: 15 });
    expect(layout.dense).toBe(true);
    expect([...layout.labelled].sort((a, b) => a - b)).toEqual([4, 9, 15, 29]);
    // About six axis labels, always including the latest point.
    expect(layout.ticks.length).toBeLessThanOrEqual(6);
    expect(layout.ticks).toContain(29);
  });

  it('drops a label that would overlap a more important one', () => {
    const values = Array.from({ length: 30 }, (_, index) => index);
    values[28] = 99; // the high sits right next to the latest point
    const layout = trendLayout({ values, width: 300, height: 170 });
    expect(layout.labelled.has(29)).toBe(true);
    expect(layout.labelled.has(28)).toBe(false);
    expect(layout.labelled.has(0)).toBe(true);
  });

  it('keeps edge labels inside the chart', () => {
    expect(anchorFor(10, 300)).toBe('start');
    expect(anchorFor(150, 300)).toBe('middle');
    expect(anchorFor(295, 300)).toBe('end');
  });
});
