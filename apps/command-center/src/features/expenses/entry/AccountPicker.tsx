import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { CategoryIcon, Text } from '@/components/ui';
import { useInteractionState } from '@/hooks/useInteractionState';
import {
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_GROUP_ORDER,
  accountBalances,
  sortAccounts,
  type Account,
} from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { accountGroupIcons, accountGroupTints } from '../categoryIcons';
import { useLedger } from '../hooks/useLedger';
import { GridRows } from './GridRows';

type AccountPickerProps = {
  selectedId: string | null;
  /** The other side of a transfer cannot be picked again. */
  disabledId?: string | null;
  onChoose: (accountId: string) => void;
  columns: number;
};

/** Accounts grouped like Money Manager (Cash · Bank accounts · Cards …) with current balances. */
export function AccountPicker({ selectedId, disabledId, onChoose, columns }: AccountPickerProps) {
  const theme = useTheme();
  const { accounts, transactions } = useLedger();
  const balances = useMemo(() => accountBalances(accounts, transactions), [accounts, transactions]);
  const ordered = useMemo(() => sortAccounts(accounts), [accounts]);
  return (
    <View style={{ gap: theme.space[4] }}>
      {ACCOUNT_GROUP_ORDER.map((group) => {
        const items = ordered.filter((account) => account.group === group);
        if (!items.length) return null;
        return (
          <View key={group} style={{ gap: theme.space[2] }}>
            <Text variant="eyebrow" color="textTertiary" uppercase>
              {ACCOUNT_GROUP_LABELS[group]}
            </Text>
            <GridRows
              items={items}
              columns={columns}
              gap={theme.space[2]}
              keyOf={(account) => account.id}
              render={(account) => (
                <AccountTile
                  account={account}
                  balance={balances.get(account.id) ?? account.openingBalance}
                  selected={account.id === selectedId}
                  disabled={account.id === disabledId}
                  onPress={() => onChoose(account.id)}
                />
              )}
            />
          </View>
        );
      })}
    </View>
  );
}

type AccountTileProps = {
  account: Account;
  balance: number;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
};

function AccountTile({ account, balance, selected, disabled, onPress }: AccountTileProps) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${account.name}, balance ${formatMoneyWhole(balance)}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      {...handlers}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          padding: theme.space[2],
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor: selected ? theme.colors.ink : theme.colors.border,
          backgroundColor: hovered && !disabled ? theme.colors.surfaceMuted : theme.colors.surface,
          opacity: disabled ? 0.4 : 1,
        },
        focused && { outlineColor: theme.colors.focus, outlineWidth: 2, outlineStyle: 'solid' },
      ]}
    >
      <CategoryIcon
        icon={accountGroupIcons[account.group]}
        tint={accountGroupTints[account.group]}
        size={32}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" numberOfLines={1}>
          {account.name}
        </Text>
        <Text
          variant="caption"
          color={balance < 0 ? 'expense' : 'textSecondary'}
          numeric
          numberOfLines={1}
        >
          {formatMoneyWhole(balance)}
        </Text>
      </View>
    </Pressable>
  );
}
