import type { ColorRoles } from '@/theme';

/**
 * The home screen's chart colours, taken from the Expenses → Stats pie so every chart in the
 * app shares one palette: green for income and money kept, coral for spending, orange for
 * this month's line, blue for pay, violet for PF.
 */
export function homePalette(colors: ColorRoles) {
  const [coral, orange, yellow, , , green, , blue, violet] = colors.pie;
  return { coral, orange, yellow, green, blue, violet, grey: colors.pieOther };
}

/** Green when good, yellow when it needs watching, coral when it is bad. */
export function statusColor(colors: ColorRoles, level: 'good' | 'watch' | 'bad') {
  const { green, yellow, coral } = homePalette(colors);
  return level === 'good' ? green : level === 'watch' ? yellow : coral;
}
