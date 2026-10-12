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

function formatter(
  locale: string,
  currency: string,
  compact: boolean,
  whole = false,
): Intl.NumberFormat {
  const key = `${locale}|${currency}|${compact}|${whole}`;
  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...(compact
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : whole
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

/** Formats e.g. 125050 → "₹1,250.50"; negative values use a true minus sign. */
export function formatMoney(minor: number, options: FormatOptions = {}): string {
  assertMinorUnits(minor);
  const {
    currency = 'INR',
    compact = false,
    signDisplay = 'auto',
    locale = 'en-IN',
    whole = false,
  } = options;
  const magnitude = formatter(locale, currency, compact, whole).format(Math.abs(minor) / 100);
  if (minor === 0 || signDisplay === 'never') return magnitude;
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

/** Compact rupee label for chart axes in Indian units: ₹950 · ₹45K · ₹1.2L · ₹3Cr. */
export function formatAxisMoney(minor: number): string {
  const rupees = Math.abs(minor) / 100;
  const sign = minor < 0 ? '−' : '';
  const trim = (value: number) =>
    value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, '');
  if (rupees >= 1e7) return `${sign}₹${trim(rupees / 1e7)}Cr`;
  if (rupees >= 1e5) return `${sign}₹${trim(rupees / 1e5)}L`;
  if (rupees >= 1e3) return `${sign}₹${trim(rupees / 1e3)}K`;
  return `${sign}₹${Math.round(rupees)}`;
}

/** Rounds to whole rupees for display in dense tables. */
export function formatMoneyWhole(minor: number, signDisplay: SignDisplay = 'auto'): string {
  assertMinorUnits(Math.round(minor));
  return formatMoney(Math.round(minor / 100) * 100, { signDisplay }).replace(/\.00$/, '');
}
