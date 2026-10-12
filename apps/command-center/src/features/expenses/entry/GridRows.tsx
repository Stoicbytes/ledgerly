import type { ReactNode } from 'react';
import { View } from 'react-native';

type GridRowsProps<T> = {
  items: T[];
  columns: number;
  gap: number;
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  /** Content inserted under a row (e.g. the subcategories of a tile in that row). */
  after?: (row: T[]) => ReactNode;
};

/** Equal-width grid built from rows, so content can be inserted between rows. */
export function GridRows<T>({ items, columns, gap, keyOf, render, after }: GridRowsProps<T>) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns)
    rows.push(items.slice(index, index + columns));
  return (
    <View style={{ gap }}>
      {rows.map((row) => (
        <View key={keyOf(row[0])} style={{ gap }}>
          <View style={{ flexDirection: 'row', gap }}>
            {row.map((item) => (
              <View key={keyOf(item)} style={{ flex: 1, minWidth: 0 }}>
                {render(item)}
              </View>
            ))}
            {Array.from({ length: columns - row.length }, (_, index) => (
              <View key={`empty-${index}`} style={{ flex: 1 }} />
            ))}
          </View>
          {after?.(row)}
        </View>
      ))}
    </View>
  );
}
