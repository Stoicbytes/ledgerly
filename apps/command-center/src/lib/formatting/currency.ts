/**
 * Display-only money formatting. Amounts arrive as integer minor units (paise)
 * so calculation code never handles fractional rupees; rounding happens here,
 * at the display boundary, and nowhere else.
 */
export type SignDisplay = 'auto' | 'always' | 'never';

type FormatOptions = {
  currency?: string;
  compact?: boolean;
  signDisplay?: SignDisplay;
  locale?: string;
  /** Round to whole rupees (headline KPI tiles); details keep paise. */
  whole?: boolean;
};

const formatterCache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, currency: string, whole = false): Intl.NumberFormat {
  const key = `${locale}|${currency}|${whole}`;
  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...(whole
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
    formatterCache.set(key, cached);
  }
  return cached;
}

export function assertMinorUnits(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money must be an integer number of minor units, received ${value}`);
  }
}

/**
 * Formats e.g. 125050 → "₹1,250.50"; negative values use a true minus sign. Rounding (whole
 * rupees, compact) goes half away from zero on both sides, and an amount that rounds to zero
 * never shows a sign ("₹0", not "−₹0"). Compact rupees use Indian units (₹45K, ₹1.2L, ₹3Cr).
 */
export function formatMoney(minor: number, options: FormatOptions = {}): string {
  assertMinorUnits(minor);
  const {
    currency = 'INR',
    compact = false,
    signDisplay = 'auto',
    locale = 'en-IN',
    whole = false,
  } = options;
  const magnitude =
    compact && currency === 'INR'
      ? compactRupees(Math.abs(minor))
      : formatter(locale, currency, whole).format(Math.abs(minor) / 100);
  if (!/[1-9]/.test(magnitude) || signDisplay === 'never') return magnitude;
  if (minor < 0) return `−${magnitude}`;
  return signDisplay === 'always' ? `+${magnitude}` : magnitude;
}

/** Screen-reader text: never relies on glyphs like "−" being announced. */
export function moneyAccessibilityLabel(minor: number, options: FormatOptions = {}): string {
  const magnitude = formatMoney(Math.abs(minor), { ...options, signDisplay: 'never' });
  if (minor < 0) return `minus ${magnitude}`;
  if (minor > 0 && options.signDisplay === 'always') return `plus ${magnitude}`;
  return magnitude;
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '—';
  const magnitude = `${Math.abs(value).toFixed(fractionDigits)}%`;
  if (value > 0) return `+${magnitude}`;
  if (value < 0) return `−${magnitude}`;
  return magnitude;
}

const UNITS: [number, string][] = [
  [1e7, 'Cr'],
  [1e5, 'L'],
  [1e3, 'K'],
  [1, ''],
];

/**
 * "₹99.9K", "₹1L", "₹3Cr" for a non-negative paise amount. The unit is chosen after
 * rounding, so ₹99,999.99 reads "₹1L", not "₹100K".
 */
function compactRupees(paise: number): string {
  const rupees = paise / 100;
  let index = UNITS.findIndex(([size]) => rupees >= size);
  if (index < 0) index = UNITS.length - 1;
  const shown = (at: number) => {
    const value = rupees / UNITS[at][0];
    return at === UNITS.length - 1 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  };
  while (index > 0 && shown(index) * UNITS[index][0] >= UNITS[index - 1][0]) index -= 1;
  return `₹${shown(index)}${UNITS[index][1]}`;
}

/** Compact rupee label for chart axes in Indian units: ₹950 · ₹45K · ₹1.2L · ₹3Cr. */
export function formatAxisMoney(minor: number): string {
  return formatMoney(minor, { compact: true });
}

/** Rounds to whole rupees (half away from zero) for display in dense tables. */
export function formatMoneyWhole(minor: number, signDisplay: SignDisplay = 'auto'): string {
  assertMinorUnits(Math.round(minor));
  return formatMoney(Math.round(minor), { signDisplay, whole: true });
}
