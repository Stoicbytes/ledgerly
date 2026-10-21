import { parseLimitedAmount } from '@/lib/domain/expenses';

/**
 * Amounts as payslips print them: "₹ 1,23,456.00", "Rs. 12,500", "INR 12500", "12,500/-",
 * "12,500.00 Cr". Grouping may be Indian (1,23,456) or international (123,456). The result
 * is integer paise (string maths, no floating point), or null when it is not an amount.
 */
const AMOUNT =
  /^(?:₹|rs\.?|inr)?([1-9]\d{0,2}(?:,\d{2,3})+|[1-9]\d*|0)(\.\d{1,2})?(?:\/-)?(?:cr|dr)?$/i;

export function parsePrintedAmount(text: string): number | null {
  const match = AMOUNT.exec(text.replace(/\s+/g, ''));
  if (!match) return null;
  return parseLimitedAmount(match[1].replace(/,/g, '') + (match[2] ?? ''));
}

/** A currency word on its own ("₹", "Rs.", "INR") or a credit/debit mark. */
export const isCurrencyWord = (text: string) => /^(₹|rs\.?|inr|cr|dr|\/-)$/i.test(text);
