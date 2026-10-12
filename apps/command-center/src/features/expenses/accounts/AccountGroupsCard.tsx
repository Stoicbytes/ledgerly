import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight, Plus } from '@/components/icons';
import { Button, Card, CardHeader, CategoryIcon, Money, Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import { ACCOUNT_GROUP_LABELS, type Account } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { accountGroupIcons, accountGroupTints } from '../categoryIcons';
import { PanelScroll } from '@/components/layout/PanelScroll';
import type { AccountsView } from './useAccountsView';

type AccountGroupsCardProps = {
  groups: AccountsView['groups'];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Accounts grouped as in Money Manager, each group with its total. */
export function AccountGroupsCard({
  groups,
  selectedId,
  onSelect,
  onAdd,
  style,
}: AccountGroupsCardProps) {
  const theme = useTheme();
  return (
    <Card index={1} style={[{ gap: theme.space[3] }, style]}>
      <CardHeader
        title="Your accounts"
        subtitle="Balances include every entry and transfer"
        action={
          <Button
            label="Add"
            icon={Plus}
            size="sm"
            variant="ink"
            accessibilityLabel="Add an account"
            onPress={onAdd}
          />
        }
      />
      <PanelScroll gap={theme.space[3]}>
        {groups.map(({ group, items, total }) => (
          <View key={group} style={{ gap: 2 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: theme.space[2],
              }}
            >
              <Text variant="eyebrow" color="textTertiary" uppercase>
                {ACCOUNT_GROUP_LABELS[group]}
              </Text>
              <Text variant="caption" color={total < 0 ? 'expense' : 'textSecondary'} numeric>
                {formatMoneyWhole(total)}
              </Text>
            </View>
            {items.map(({ account, balance }) => (
              <AccountRow
                key={account.id}
                account={account}
                balance={balance}
                selected={account.id === selectedId}
                onPress={() => onSelect(account.id)}
              />
            ))}
          </View>
        ))}
      </PanelScroll>
    </Card>
  );
}

type AccountRowProps = {
  account: Account;
  balance: number;
  selected: boolean;
  onPress: () => void;
};

function AccountRow({ account, balance, selected, onPress }: AccountRowProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${account.name}, ${balance < 0 ? `owes ${formatMoneyWhole(-balance)}` : `balance ${formatMoneyWhole(balance)}`}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      {...handlers}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          padding: theme.space[2],
          borderRadius: theme.radius.md,
          backgroundColor: selected || hovered ? theme.colors.surfaceMuted : 'transparent',
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <CategoryIcon
        icon={accountGroupIcons[account.group]}
        tint={accountGroupTints[account.group]}
        size={38}
      />
      <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
        {account.name}
      </Text>
      <Money
        value={balance}
        whole
        variant="bodyStrong"
        color={balance < 0 ? 'expense' : 'textPrimary'}
      />
      <ChevronRight size={16} color={theme.colors.textTertiary} />
    </Pressable>
  );
}
