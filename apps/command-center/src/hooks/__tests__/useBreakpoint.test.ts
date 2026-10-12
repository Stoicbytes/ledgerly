import { columnsFor } from '@/components/layout/ResponsiveGrid';
import { breakpointForWidth, densityForHeight, layoutModeForWidth } from '../useBreakpoint';

describe('breakpoints', () => {
  it.each([
    [320, 'sm', 'mobile'],
    [767, 'sm', 'mobile'],
    [768, 'md', 'tablet'],
    [1023, 'md', 'tablet'],
    [1024, 'lg', 'desktop'],
    [1440, 'xl', 'desktop'],
  ])('width %i → %s / %s', (width, breakpoint, mode) => {
    expect(breakpointForWidth(width)).toBe(breakpoint);
    expect(layoutModeForWidth(width)).toBe(mode);
  });
});

describe('columnsFor', () => {
  it('inherits from the nearest smaller breakpoint', () => {
    const columns = { sm: 1, lg: 3 };
    expect(columnsFor('sm', columns)).toBe(1);
    expect(columnsFor('md', columns)).toBe(1);
    expect(columnsFor('lg', columns)).toBe(3);
    expect(columnsFor('xl', columns)).toBe(3);
  });

  it('never returns fewer than one column', () => {
    expect(columnsFor('md', { sm: 0 })).toBe(1);
  });
});

describe('densityForHeight', () => {
  it.each([
    [900, 'roomy'],
    [820, 'roomy'],
    [768, 'dense'],
    [700, 'dense'],
    [660, 'short'],
  ])('%i px → %s', (height, density) => {
    expect(densityForHeight(height)).toBe(density);
  });
});
