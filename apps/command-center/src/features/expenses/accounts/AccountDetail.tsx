import { View } from 'react-native';
import { TrendLineChart } from '@/components/charts';
import { ArrowRight, Pencil, Plus } from '@/components/icons';
import { Button, CategoryIcon, IconButton, Money, Text } from '@/components/ui';
import { useFitMode } from '@/components/layout/Screen';
import { ACCOUNT_TYPE_LABELS, monthLabel } from '@/lib/domain/expenses';
import { formatAxisMoney, formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { accountGroupIcons, accountGroupTints } from '../categoryIcons';
import { formatEntry } from '../format';
import { LedgerRow } from '../components/LedgerRow';
import { PanelScroll } from '@/components/layout/PanelScroll';
import { useTransactionForm } from '../state/transactionForm';
import type { AccountDetailData } from './useAccountsView';

type AccountDetailProps = {
  detail: AccountDetailData;
  onEdit: () => void;
  onOpenTransactions: () => void;
};

/** One account: balance, this month's flow, six month-ends of history and its latest entries. */
export function AccountDetail({ detail, onEdit, onOpenTransactions }: AccountDetailProps) {
  const theme = useTheme();
  const fit = useFitMode(true);
  const openNew = useTransactionForm((state) => state.openNew);
  const { account, balance, thisMonth, history } = detail;
  const owed = balance < 0;
  return (
    <View style={[{ gap: theme.space[4] }, fit && { flex: 1, minHeight: 0 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <CategoryIcon
          icon={accountGroupIcons[account.group]}
          tint={accountGroupTints[account.group]}
          size={48}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="title" numberOfLines={1}>
            {account.name}
          </Text>
          <Text variant="label" color="textSecondary">
            {ACCOUNT_TYPE_LABELS[account.group]} · {detail.entryCount} entries
          </Text>
        </View>
        <IconButton
          icon={Pencil}
          variant="muted"
          tooltip="top"
          accessibilityLabel={`Edit ${account.name}`}
          onPress={onEdit}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: theme.space[5],
        }}
      >
        <View>
          <Text variant="label" color="textSecondary">
            {owed ? 'Owed' : 'Balance'}
          </Text>
          <Money
            value={Math.abs(balance)}
            whole
            animate
            variant="figure"
            color={owed ? 'expense' : 'textPrimary'}
          />
        </View>
        <Flow label="In this month" value={thisMonth.income} tone="income" />
        <Flow label="Out this month" value={-thisMonth.expense} tone="expense" />
      </View>
      <TrendLineChart
        height={fit ? 140 : 170}
        points={history.map((point, index) => ({
          label: monthLabel(point.month, 'short'),
          sublabel:
            index === 0 || point.month.endsWith('-01') ? point.month.slice(0, 4) : undefined,
          value: Math.abs(point.balance),
          name: monthLabel(point.month),
        }))}
        selected={history.length - 1}
        color={owed ? theme.colors.expense : undefined}
        formatValue={formatAxisMoney}
        accessibilityLabel={`${account.name} at each month end: ${history.map((point) => `${monthLabel(point.month, 'short')} ${formatMoneyWhole(point.balance)}`).join(', ')}.`}
      />
      <View style={{ flexDirection: 'row', gap: theme.space[2], flexWrap: 'wrap' }}>
        <Button
          label="Add entry"
          icon={Plus}
          size="sm"
          onPress={() => openNew({ accountId: account.id })}
        />
        <Button
          label="Show in Transactions"
          icon={ArrowRight}
          size="sm"
          variant="secondary"
          onPress={onOpenTransactions}
        />
      </View>
      <Text variant="eyebrow" color="textTertiary" uppercase>
        Latest entries
      </Text>
      <PanelScroll>
        {detail.recent.length ? (
          detail.recent.map((transaction) => (
            <LedgerRow
              key={transaction.id}
              transaction={transaction}
              accountId={account.id}
              showDate
            />
          ))
        ) : (
          <Text color="textSecondary">No entries yet. Its balance is the opening balance.</Text>
        )}
      </PanelScroll>
    </View>
  );
}

function Flow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'income' | 'expense';
}) {
  return (
    <View>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Text variant="bodyLg" color={value ? tone : 'textTertiary'} numeric>
        {formatEntry(value, value ? 'always' : 'auto')}
      </Text>
    </View>
  );
}
