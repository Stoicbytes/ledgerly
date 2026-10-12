import { csvCell } from '@/lib/domain/expenses';
import { fromUnits4, GAIN_TYPE_LABELS, type GainLine } from '@/lib/domain/investments';

const rupees = (paise: number) => (paise / 100).toFixed(2);

/** One financial year's redemptions as CSV for your CA or the tax return. */
export function gainsCsv(lines: GainLine[]): string {
  const header = [
    'Fund',
    'ISIN',
    'Folio',
    'Bought',
    'Sold',
    'Days held',
    'Units',
    'Cost',
    'Proceeds',
    'Gain',
    'Type',
  ];
  const rows = lines.map((line) =>
    [
      line.fund.name,
      line.fund.isin ?? '',
      line.fund.folio,
      line.buyDate,
      line.sellDate,
      String(line.days),
      fromUnits4(line.units4).toFixed(4),
      rupees(line.cost),
      rupees(line.proceeds),
      rupees(line.gain),
      GAIN_TYPE_LABELS[line.type],
    ]
      .map(csvCell)
      .join(','),
  );
  return `﻿${[header.join(','), ...rows].join('\r\n')}\r\n`;
}
