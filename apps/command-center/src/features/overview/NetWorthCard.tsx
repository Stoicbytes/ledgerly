import { View } from 'react-native';
import { ArrowLeftRight, Plus } from '@/components/icons';
import { Button, Card, CategoryIcon, Delta, Money, Text, Tile } from '@/components/ui';
import { accountGroupIcons, accountGroupTints } from '@/features/expenses/categoryIcons';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { formatAxisMoney, formatMoneyWhole } from '@/lib/formatting/currency';
import { useTransactionForm } from '@/features/expenses/state/transactionForm';
import { useTheme } from '@/theme';
import type { OverviewData } from './useOverviewData';

export function NetWorthCard({ data }: { data: OverviewData }) {
  const theme = useTheme();
  const openNew = useTransactionForm((state) => state.openNew);
  // Three tiles share a phone's width: lakh/crore short forms keep figures whole.
  const { isMobile } = useBreakpoint();
  const tileMoney = isMobile ? formatAxisMoney : formatMoneyWhole;
  return (
    <Card index={0} style={{ gap: theme.space[4], flex: 1 }}>
      <View style={{ gap: theme.space[1] }}>
        <Text color="textSecondary">Net worth</Text>
        <Money
          value={data.netWorth}
          animate
          variant="figure"
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <Delta value={data.savings} format="money" variant="pill" comparison="saved this month" />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Add expense"
            icon={Plus}
            fullWidth
            onPress={() => openNew({ kind: 'expense' })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Transfer"
            icon={ArrowLeftRight}
            variant="secondary"
            fullWidth
            onPress={() => openNew({ kind: 'transfer' })}
          />
        </View>
      </View>
      <Tile style={{ gap: theme.space[3] }}>
        <Text variant="label" color="textSecondary">
          Accounts · {data.accounts.length}
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
          {data.accounts.slice(0, 3).map(({ account, balance }) => (
            <View
              key={account.id}
              style={{
                flex: 1,
                minWidth: 0,
                gap: theme.space[2],
                padding: theme.space[3],
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface,
              }}
            >
              <CategoryIcon
                icon={accountGroupIcons[account.group]}
                tint={accountGroupTints[account.group]}
                size={30}
              />
              <Text
                variant="bodyStrong"
                color={balance < 0 ? 'expense' : 'textPrimary'}
                numeric
                numberOfLines={1}
              >
                {tileMoney(balance)}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {account.name}
              </Text>
            </View>
          ))}
        </View>
      </Tile>
    </Card>
  );
}
