import { View } from 'react-native';
import { Landmark, Scale, TrendingDown, TrendingUp } from '@/components/icons';
import { Card, CategoryIcon, Money, Text, type MoneyTone } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme';
import type { AccountsView } from './useAccountsView';

/** Money Manager's account header: Assets · Liabilities · Total. */
export function AccountSummaryCard({ summary }: { summary: AccountsView['summary'] }) {
  const theme = useTheme();
  const { isDesktop } = useBreakpoint();
  const items: {
    label: string;
    caption: string;
    value: number;
    tone: MoneyTone;
    tint: number;
    icon: typeof Landmark;
  }[] = [
    {
      label: 'Assets',
      caption: 'Accounts in credit',
      value: summary.assets,
      tone: 'income',
      tint: 0,
      icon: TrendingUp,
    },
    {
      label: 'Liabilities',
      caption: 'Cards and loans owed',
      value: summary.liabilities,
      tone: 'expense',
      tint: 3,
      icon: TrendingDown,
    },
    {
      label: 'Total',
      caption: 'Assets minus liabilities',
      value: summary.total,
      tone: 'neutral',
      tint: 2,
      icon: Scale,
    },
  ];
  return (
    <Card
      index={0}
      padding={4}
      style={{ flexDirection: isDesktop ? 'row' : 'column', gap: theme.space[3] }}
    >
      {items.map((item, index) => (
        <View
          key={item.label}
          style={{
            flex: isDesktop ? 1 : undefined,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[3],
            paddingHorizontal: theme.space[2],
            borderLeftWidth: isDesktop && index > 0 ? 1 : 0,
            borderLeftColor: theme.colors.border,
          }}
        >
          <CategoryIcon icon={item.icon} tint={item.tint} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" color="textSecondary">
              {item.label}
            </Text>
            <Money
              value={item.value}
              tone={item.tone}
              whole
              animate
              variant="figureSm"
              numberOfLines={1}
            />
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {item.caption}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}
