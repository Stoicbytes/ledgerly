import { Link, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChartPie, List, Tag, Target, Users, type LucideIcon } from '@/components/icons';
import { Text } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useInteractionState } from '@/hooks/useInteractionState';
import { useTheme } from '@/theme';

const sections: { href: string; label: string; short?: string; icon: LucideIcon }[] = [
  // Five tabs share a phone's width, so the longest label gets a short form there.
  { href: '/dashboard/expenses', label: 'Transactions', short: 'Entries', icon: List },
  { href: '/dashboard/expenses/stats', label: 'Stats', icon: ChartPie },
  { href: '/dashboard/expenses/budget', label: 'Budget', icon: Target },
  { href: '/dashboard/expenses/people', label: 'People', icon: Users },
  { href: '/dashboard/expenses/categories', label: 'Categories', icon: Tag },
];

/**
 * Sub-navigation shared by every Expenses page (Money Manager: Trans. · Stats ·
 * Budget · Settings). Pills on wide screens; five equal tabs on phones.
 */
export function SectionTabs() {
  const theme = useTheme();
  const pathname = usePathname();
  const { isMobile } = useBreakpoint();
  return (
    <View
      role="navigation"
      aria-label="Expenses sections"
      style={{
        flexDirection: 'row',
        alignSelf: isMobile ? 'stretch' : 'flex-start',
        padding: 4,
        gap: 4,
        borderRadius: isMobile ? theme.radius.lg : theme.radius.pill,
        backgroundColor: theme.colors.surface,
      }}
    >
      {sections.map((section) => (
        <SectionLink
          key={section.href}
          {...section}
          stacked={isMobile}
          active={pathname === section.href}
        />
      ))}
    </View>
  );
}

type SectionLinkProps = {
  href: string;
  label: string;
  /** Visible label on phones; screen readers still hear `label`. */
  short?: string;
  icon: LucideIcon;
  active: boolean;
  /** Icon above the label, sharing the row equally (phones). */
  stacked: boolean;
};

function SectionLink({ href, label, short, icon: Icon, active, stacked }: SectionLinkProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Link href={href as Href} asChild>
      <Pressable
        accessibilityLabel={label}
        aria-current={active ? 'page' : undefined}
        accessibilityState={{ selected: active }}
        {...handlers}
        style={StyleSheet.flatten([
          {
            flexDirection: stacked ? 'column' : 'row',
            flex: stacked ? 1 : undefined,
            alignItems: 'center',
            justifyContent: 'center',
            gap: stacked ? 2 : 6,
            height: stacked ? 46 : 30,
            paddingHorizontal: stacked ? 2 : theme.space[4],
            borderRadius: stacked ? theme.radius.md : theme.radius.pill,
            backgroundColor: active
              ? theme.colors.ink
              : hovered
                ? theme.colors.surfaceMuted
                : 'transparent',
          },
          focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
        ])}
      >
        <Icon
          size={stacked ? 18 : 16}
          color={active ? theme.colors.onInk : theme.colors.textSecondary}
          strokeWidth={2}
        />
        <Text
          variant={stacked ? 'caption' : 'label'}
          color={active ? 'onInk' : 'textSecondary'}
          numberOfLines={1}
        >
          {stacked && short ? short : label}
        </Text>
      </Pressable>
    </Link>
  );
}
