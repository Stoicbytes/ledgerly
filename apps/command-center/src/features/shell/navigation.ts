import {
  Briefcase,
  ChartCandlestick,
  ChartPie,
  Landmark,
  Globe,
  LayoutGrid,
  Menu,
  Settings,
  StickyNote,
  Wallet,
  type LucideIcon,
} from '@/components/icons';

export type Destination = {
  /** Route name relative to src/app/dashboard (matches the file name). */
  name: string;
  href: string;
  label: string;
  /** Short label for compact navigation. */
  shortLabel?: string;
  icon: LucideIcon;
  placement: {
    desktop: 'top' | 'rail' | 'railFooter' | 'hidden';
    mobile: 'tab' | 'more' | 'hidden';
  };
};

export const destinations: readonly Destination[] = [
  {
    name: 'index',
    href: '/dashboard',
    label: 'Overview',
    icon: LayoutGrid,
    placement: { desktop: 'top', mobile: 'tab' },
  },
  {
    name: 'expenses',
    href: '/dashboard/expenses',
    label: 'Expenses',
    icon: Wallet,
    placement: { desktop: 'top', mobile: 'tab' },
  },
  {
    name: 'mutual-funds',
    href: '/dashboard/mutual-funds',
    label: 'Mutual funds',
    shortLabel: 'Funds',
    icon: ChartPie,
    placement: { desktop: 'top', mobile: 'tab' },
  },
  {
    name: 'stocks',
    href: '/dashboard/stocks',
    label: 'Stocks',
    icon: ChartCandlestick,
    placement: { desktop: 'top', mobile: 'tab' },
  },
  {
    name: 'salary',
    href: '/dashboard/salary',
    label: 'Salary & PF',
    shortLabel: 'Salary',
    icon: Briefcase,
    placement: { desktop: 'rail', mobile: 'more' },
  },
  {
    name: 'notes',
    href: '/dashboard/notes',
    label: 'Notes',
    icon: StickyNote,
    // Phones: the bottom bar is full (four sections, More and the add button).
    placement: { desktop: 'top', mobile: 'more' },
  },
  {
    name: 'portfolio',
    href: '/dashboard/portfolio',
    label: 'Portfolio',
    icon: Globe,
    placement: { desktop: 'rail', mobile: 'more' },
  },
  {
    name: 'accounts',
    href: '/dashboard/accounts',
    label: 'Accounts',
    icon: Landmark,
    placement: { desktop: 'rail', mobile: 'more' },
  },
  {
    name: 'settings',
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    placement: { desktop: 'railFooter', mobile: 'more' },
  },
  {
    name: 'more',
    href: '/dashboard/more',
    label: 'More',
    icon: Menu,
    placement: { desktop: 'hidden', mobile: 'tab' },
  },
];

const by = (predicate: (item: Destination) => boolean) => destinations.filter(predicate);
export const topNav = by((item) => item.placement.desktop === 'top');
export const railNav = by((item) => item.placement.desktop === 'rail');
export const railFooterNav = by((item) => item.placement.desktop === 'railFooter');
export const mobileTabs = by((item) => item.placement.mobile === 'tab');
export const mobileMore = by((item) => item.placement.mobile === 'more');

/** Whether `href` is the current page (the dashboard root matches exactly). */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/index';
  return pathname === href || pathname.startsWith(`${href}/`);
}
