import { OTHER_ID, type Slice } from '@/lib/domain/expenses';
import { sliceSlots } from '../sliceColors';

const slice = (id: string): Slice => ({
  id,
  name: id,
  amount: 1,
  share: 0,
  count: 1,
  category: null,
});

describe('sliceSlots', () => {
  it('colours slices by rank, largest first', () => {
    expect(sliceSlots([slice('family'), slice('rent'), slice('food')], 10)).toEqual([0, 1, 2]);
  });

  it('keeps the folded Other slice grey', () => {
    expect(sliceSlots([slice('family'), slice(OTHER_ID)], 10)).toEqual([0, null]);
  });

  it('wraps around a short palette', () => {
    expect(sliceSlots([slice('a'), slice('b'), slice('c')], 2)).toEqual([0, 1, 0]);
  });
});
