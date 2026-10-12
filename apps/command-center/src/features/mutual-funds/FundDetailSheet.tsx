import { Pressable, View } from 'react-native';
import { Plus } from '@/components/icons';
import { Sheet } from '@/components/overlays';
import { Button, Money, Text } from '@/components/ui';
import { useFundsView } from '@/features/investments/hooks/useInvestments';
import { usePortfolioStore } from '@/features/investments/state/portfolioStore';
import { useInteractionState } from '@/hooks/useInteractionState';
import { dayLabel } from '@/lib/domain/expenses';
import { fromUnits4, sortFundTxns, yearlyCost, type FundTxn } from '@/lib/domain/investments';
import { formatMoney, formatMoneyWhole, formatPercent } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { PRICE_SOURCE_LABEL, SummaryGrid } from '@/features/investments/components/SummaryGrid';

type Props = {
  fundId: string;
  onClose: () => void;
  onAddTxn: () => void;
  onEditTxn: (id: string) => void;
  onEditFund: () => void;
  onSip: (id: string | null) => void;
};

const KIND_LABEL: Record<FundTxn['kind'], string> = {
  buy: 'Purchase',
  sell: 'Redemption',
  dividend: 'Dividend',
};

/** One fund: what it is worth, its SIP plans and every transaction. */
export function FundDetailSheet({
  fundId,
  onClose,
  onAddTxn,
  onEditTxn,
  onEditFund,
  onSip,
}: Props) {
  const theme = useTheme();
  const row = useFundsView().rows.find((item) => item.fund.id === fundId);
  const sips = usePortfolioStore((state) => state.sips).filter((sip) => sip.fundId === fundId);
  if (!row) return null;
  const { fund, position, quote } = row;
  const gainPct = position.invested ? (position.unrealised / position.invested) * 100 : 0;
  return (
    <Sheet
      visible
      onClose={onClose}
      title={fund.name}
      description={[row.categoryLabel, fund.folio ? `Folio ${fund.folio}` : '']
        .filter(Boolean)
        .join(' · ')}
      width={620}
      footer={
        <>
          <Button label="Edit fund" variant="secondary" onPress={onEditFund} />
          <View style={{ flex: 1 }} />
          <Button label="Add transaction" icon={Plus} onPress={onAddTxn} />
        </>
      }
    >
      <View style={{ gap: theme.space[5] }}>
        <SummaryGrid
          items={[
            { label: 'Value', money: position.value },
            { label: 'Invested', money: position.invested },
            {
              label: 'Gain',
              money: position.unrealised,
              tone: 'auto',
              note: formatPercent(gainPct),
            },
            {
              label: 'XIRR',
              text: row.xirr === null ? '—' : formatPercent(row.xirr * 100),
              note: row.xirr === null && position.invested ? 'after a year' : undefined,
            },
            { label: 'Units', text: fromUnits4(position.units4).toFixed(3) },
            {
              label: 'Average cost',
              text: position.avgCost ? `₹${position.avgCost.toFixed(4)}` : '—',
            },
            {
              label: 'NAV',
              text: quote ? `₹${quote.price.toFixed(4)}` : '—',
              note: quote
                ? `${dayLabel(quote.date, 'short')} · ${PRICE_SOURCE_LABEL[quote.source]}`
                : undefined,
            },
            { label: 'Realised gain', money: position.realised + position.dividends, tone: 'auto' },
            ...(fund.expenseRatio != null
              ? [
                  {
                    label: 'Yearly cost',
                    money: yearlyCost(position.value, fund.expenseRatio),
                    note: `expense ratio ${fund.expenseRatio}%`,
                  },
                ]
              : []),
          ]}
        />
        <View style={{ gap: theme.space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="title" style={{ flex: 1 }}>
              SIP plans
            </Text>
            <Button
              label="Add SIP"
              variant="secondary"
              size="sm"
              icon={Plus}
              onPress={() => onSip(null)}
            />
          </View>
          {sips.length ? (
            sips.map((sip) => (
              <Line
                key={sip.id}
                title={`${formatMoneyWhole(sip.amount)} on day ${sip.day} of each month`}
                detail={`${sip.active ? 'Active' : 'Paused'} · from ${dayLabel(sip.startDate, 'short')}${sip.endDate ? ` to ${dayLabel(sip.endDate, 'short')}` : ''}`}
                onPress={() => onSip(sip.id)}
              />
            ))
          ) : (
            <Text variant="caption" color="textTertiary">
              No SIP plans. Add one to see upcoming and missed instalments.
            </Text>
          )}
        </View>
        <View style={{ gap: theme.space[2] }}>
          <Text variant="title">Transactions</Text>
          {row.txns.length ? (
            [...sortFundTxns(row.txns)]
              .reverse()
              .map((txn) => (
                <Line
                  key={txn.id}
                  title={`${KIND_LABEL[txn.kind]}${txn.sipId ? ' (SIP)' : ''} · ${dayLabel(txn.date, 'short')}`}
                  detail={
                    txn.units && txn.nav
                      ? `${txn.units.toFixed(3)} units at ₹${txn.nav.toFixed(4)}`
                      : txn.note || 'Paid out'
                  }
                  amount={txn.kind === 'buy' ? -txn.amount : txn.amount}
                  onPress={() => onEditTxn(txn.id)}
                />
              ))
          ) : (
            <Text variant="caption" color="textTertiary">
              No transactions yet. Add your purchases to see units, gains and XIRR.
            </Text>
          )}
        </View>
      </View>
    </Sheet>
  );
}

function Line({
  title,
  detail,
  amount,
  onPress,
}: {
  title: string;
  detail: string;
  amount?: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { hovered, focused, handlers } = useInteractionState();
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${title}, ${detail}${amount !== undefined ? `, ${formatMoney(amount)}` : ''}`}
      onPress={onPress}
      {...handlers}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        padding: theme.space[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: focused ? theme.colors.accent : theme.colors.border,
        backgroundColor: hovered ? theme.colors.surfaceMuted : 'transparent',
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {amount !== undefined ? <Money value={amount} variant="label" tone="auto" /> : null}
    </Pressable>
  );
}
