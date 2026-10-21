import type { Cell } from '@/lib/files/xlsx';
import { detectPayslip } from './detect';
import type { DetectedPayslip, TextLine } from './types';

const cellText = (cell: Cell) =>
  cell === null || cell === undefined || typeof cell === 'boolean'
    ? ''
    : typeof cell === 'number'
      ? Number.isInteger(cell)
        ? String(cell)
        : cell.toFixed(2)
      : cell.trim();

/** Spreadsheet rows as page lines: each cell a column 100 points wide. */
export function rowsToLines(rows: Cell[][]): TextLine[] {
  return rows.map((row, index) => ({
    page: 0,
    y: -index * 12,
    words: row.flatMap((cell, column) =>
      cellText(cell)
        .split(/\s+/)
        .filter(Boolean)
        .map((text, k) => ({
          text,
          x: column * 100 + k * 7,
          end: column * 100 + k * 7 + 6,
          size: 10,
          bold: false,
        })),
    ),
  }));
}

/** An Excel date serial ("46296") → "2026-09"; text months are left to the month reader. */
function monthCell(cell: Cell): string {
  if (typeof cell === 'number' && cell > 30_000 && cell < 80_000) {
    return new Date(Date.UTC(1899, 11, 30) + cell * 86_400_000).toISOString().slice(0, 7);
  }
  return cellText(cell);
}

const MONTH_HEADER = /^(pay |salary |wage )?(month|period)( of pay)?$/i;
const EMPLOYER_HEADER = /^(company|employer|organi[sz]ation)( name)?$/i;

/**
 * Payslips from a payroll export: either a table with one row per month (a "Month" column
 * and a column per line) or a two-column sheet of labels and amounts, read like a PDF.
 */
export function detectFromRows(rows: Cell[][]): DetectedPayslip[] {
  const headerIndex = rows.findIndex(
    (row) =>
      row.some((cell) => MONTH_HEADER.test(cellText(cell))) &&
      row.filter((cell) => cellText(cell)).length >= 3,
  );
  if (headerIndex < 0) {
    // "Company | Example Works" reads like "Company: Example Works".
    const named = rows.map((row) =>
      EMPLOYER_HEADER.test(cellText(row[0] ?? null))
        ? [`Company: ${cellText(row[1] ?? null)}`]
        : row,
    );
    return [detectPayslip(rowsToLines(named))];
  }
  const header = rows[headerIndex].map(cellText);
  const monthColumn = header.findIndex((text) => MONTH_HEADER.test(text));
  const employerColumn = header.findIndex((text) => EMPLOYER_HEADER.test(text));
  return rows
    .slice(headerIndex + 1)
    .filter((row) => cellText(row[monthColumn] ?? null))
    .map((row) => {
      const lines: Cell[][] = [[`Payslip for the month of ${monthCell(row[monthColumn])}`]];
      if (employerColumn >= 0) lines.push([`Company: ${cellText(row[employerColumn] ?? null)}`]);
      header.forEach((label, column) => {
        if (column !== monthColumn && column !== employerColumn && label)
          lines.push([label, row[column] ?? null]);
      });
      return detectPayslip(rowsToLines(lines));
    });
}
