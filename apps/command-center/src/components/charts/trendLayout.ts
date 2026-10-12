/**
 * Geometry for the Money Manager style line chart. Up to `DENSE` points every
 * point gets a dot and a value; longer series (daily prices) label only the
 * high, low, latest and active points and thin out the axis labels.
 */
const DENSE = 12;
const TOP = 24;
const BOTTOM = 40;
const EDGE = 28;
/** Closest two value labels may sit on a dense series, in px. */
const MIN_GAP = 44;

type TrendLayoutInput = {
  values: number[];
  compare?: number[];
  width: number;
  height: number;
  active?: number;
};

export function trendLayout({ values, compare = [], width, height, active }: TrendLayoutInput) {
  const count = values.length;
  const dense = count > DENSE;
  const all = [...values, ...compare];
  const low = all.length ? Math.min(...all) : 0;
  const high = all.length ? Math.max(...all) : 1;
  const pad = (high - low) * 0.08 || Math.abs(high) * 0.1 || 1;
  const min = low - (dense ? pad : 0);
  const max = high + pad;
  const plot = Math.max(0, height - TOP - BOTTOM);
  const step = dense
    ? count > 1
      ? (width - 2 * EDGE) / (count - 1)
      : 0
    : count
      ? width / count
      : 0;
  const x = (index: number) => (dense ? EDGE + index * step : step * (index + 0.5));
  const y = (value: number) => TOP + (1 - (value - min) / (max - min || 1)) * plot;
  const labelled = new Set<number>();
  if (dense) {
    // Most important first; a label too close to one already placed is dropped.
    const wanted = [
      active,
      count - 1,
      values.indexOf(Math.max(...values)),
      values.indexOf(Math.min(...values)),
    ];
    for (const index of wanted) {
      if (index === undefined || index < 0) continue;
      if ([...labelled].every((other) => Math.abs(x(other) - x(index)) >= MIN_GAP))
        labelled.add(index);
    }
  } else values.forEach((_, index) => labelled.add(index));
  const every = dense ? Math.ceil(count / 6) : 1;
  const ticks = values
    .map((_, index) => index)
    .filter((index) => (count - 1 - index) % every === 0);
  return {
    dense,
    x,
    y,
    step,
    labelled,
    ticks,
    gridY: [0, 0.5, 1].map((share) => TOP + share * plot),
    plotTop: TOP,
    plotBottom: TOP + plot,
    labelY: height - BOTTOM + 18,
  };
}

/** Text anchor that keeps a label inside the chart near its edges. */
export function anchorFor(x: number, width: number): 'start' | 'middle' | 'end' {
  if (x < 22) return 'start';
  if (x > width - 22) return 'end';
  return 'middle';
}
