import type { Point } from './scales';

/**
 * Pie geometry with Money Manager style callouts: labels sit in a column on
 * each side, joined to their slice by a leader line, and are pushed apart
 * vertically so they never overlap. Angles start at 12 o'clock, clockwise.
 */
export type PieWedge = { label: string; share: number; start: number; end: number; mid: number };
export type PieCallout = {
  index: number;
  label: string;
  share: number;
  side: 'left' | 'right';
  /** On the slice edge. */
  anchor: Point;
  /** Just outside the slice; the leader bends here towards the label. */
  elbow: Point;
  /** Label baseline centre and the x where the text starts (right) or ends (left). */
  y: number;
  textX: number;
};
export type PieLayout = {
  cx: number;
  cy: number;
  radius: number;
  wedges: PieWedge[];
  callouts: PieCallout[];
};

type PieLayoutOptions = {
  width: number;
  height: number;
  /** Width reserved for each label column. */
  labelWidth: number;
  /** Room between the pie and a label column for the leader line. */
  leader?: number;
  /** Minimum vertical distance between labels on one side. */
  gap?: number;
  /** Slices below this share get no callout (they stay in the list). */
  minShare?: number;
};

const TAU = Math.PI * 2;
const EDGE = 12;

export function pieLayout(
  items: { label: string; value: number }[],
  { width, height, labelWidth, leader = 26, gap = 30, minShare = 0.015 }: PieLayoutOptions,
): PieLayout {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const radius = Math.max(0, Math.min(height / 2 - EDGE, (width - 2 * (labelWidth + leader)) / 2));
  const cx = width / 2;
  const cy = height / 2;
  const at = (angle: number, distance: number): Point => ({
    x: cx + Math.sin(angle) * distance,
    y: cy - Math.cos(angle) * distance,
  });
  let cursor = 0;
  const wedges = items.map((item) => {
    const share = total ? Math.max(0, item.value) / total : 0;
    const start = cursor * TAU;
    cursor += share;
    const end = cursor * TAU;
    return { label: item.label, share, start, end, mid: (start + end) / 2 };
  });
  const callouts: PieCallout[] = [];
  for (const side of ['left', 'right'] as const) {
    const group = wedges
      .map((wedge, index) => ({ ...wedge, index }))
      .filter((wedge) => wedge.share >= minShare && Math.sin(wedge.mid) >= 0 === (side === 'right'))
      .map((wedge) => ({ ...wedge, desired: at(wedge.mid, radius + 22).y }))
      .sort((a, b) => a.desired - b.desired);
    const top = EDGE;
    const bottom = height - EDGE - 6;
    const ys: number[] = [];
    group.forEach((wedge, index) =>
      ys.push(Math.max(wedge.desired, index ? ys[index - 1] + gap : top)),
    );
    const overflow = ys.length ? ys[ys.length - 1] - bottom : 0;
    if (overflow > 0) ys.forEach((_, index) => (ys[index] -= overflow));
    if (ys.length && ys[0] < top) {
      // Too many labels for the height: spread them evenly instead.
      const step = ys.length > 1 ? (bottom - top) / (ys.length - 1) : 0;
      ys.forEach((_, index) => (ys[index] = top + step * index));
    }
    group.forEach((wedge, index) =>
      callouts.push({
        index: wedge.index,
        label: wedge.label,
        share: wedge.share,
        side,
        anchor: at(wedge.mid, radius),
        elbow: at(wedge.mid, radius + 14),
        y: ys[index],
        textX: side === 'right' ? cx + radius + leader : cx - radius - leader,
      }),
    );
  }
  return { cx, cy, radius, wedges, callouts };
}

/** Filled pie slice between two angles (radians, 0 = 12 o'clock, clockwise). */
export function sectorPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const point = (angle: number) =>
    `${cx + Math.sin(angle) * radius} ${cy - Math.cos(angle) * radius}`;
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${point(start)} A ${radius} ${radius} 0 ${large} 1 ${point(end)} Z`;
}
