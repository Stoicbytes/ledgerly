import { View } from 'react-native';
import { PiggyBank } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { Button, Card, Text } from '@/components/ui';
import { dayLabel, monthLabel, todayIso } from '@/lib/domain/expenses';
import {
  contributionsByEmployer,
  pfBalance,
  pfYears,
  PF_KIND_LABELS,
  yearsWithoutInterest,
  type PfEntry,
} from '@/lib/domain/salary';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { ListRow } from './components/ListRow';
import type { SalaryPanel } from './SalarySheets';
import { useSalaryStore } from './state/salaryStore';

const amountOf = (entry: PfEntry) => entry.employee + entry.vpf + entry.employer;

/** The PF balance (your share, the employer's, pension apart), missing interest and the passbook. */
export function PfPanel({ onOpen }: { onOpen: (panel: SalaryPanel) => void }) {
  const theme = useTheme();
  const { employers, pfEntries } = useSalaryStore();
  const name = (id: string | null) => employers.find((item) => item.id === id)?.name ?? '';
  if (!pfEntries.length) {
    return (
      <Card>
        <EmptyState
          icon={PiggyBank}
          title="Track your PF"
          body="Start with the balance on your EPFO passbook; payslips add each month's contribution, and you add the interest once a year."
          action={{
            label: 'Add the opening balance',
            onPress: () => onOpen({ type: 'pf', id: null, kind: 'opening' }),
          }}
        />
      </Card>
    );
  }
  const balance = pfBalance(pfEntries);
  const missing = yearsWithoutInterest(pfEntries, todayIso());
  const figures = [
    { label: 'PF balance', value: balance.total, note: 'counts in net worth' },
    { label: 'Your share', value: balance.employee, note: 'EPF + VPF + interest' },
    { label: 'Employer share', value: balance.employer, note: 'EPF + interest' },
    { label: 'Pension (EPS)', value: balance.pension, note: 'for a pension, not the balance' },
  ];
  const open = (entry: PfEntry) =>
    entry.payslipId
      ? onOpen({ type: 'payslip', id: entry.payslipId })
      : onOpen({ type: 'pf', id: entry.id, kind: entry.kind });
  return (
    <View style={{ gap: theme.space[4] }}>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[4] }}>
          {figures.map((item) => (
            <View key={item.label} style={{ minWidth: 140, gap: 2 }}>
              <Text variant="caption" color="textSecondary">
                {item.label}
              </Text>
              <Text variant="figureSm">{formatMoneyWhole(item.value)}</Text>
              <Text variant="caption" color="textTertiary">
                {item.note}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="caption" color="textSecondary" style={{ marginTop: theme.space[3] }}>
          Interest counts once credited. Withdrawn so far {formatMoneyWhole(balance.withdrawn)}.
        </Text>
      </Card>
      {missing.length ? (
        <Card variant="muted">
          <Text variant="bodyStrong">Interest not entered for {missing.join(', ')}</Text>
          <Text variant="caption" color="textSecondary">
            Your passbook shows it as “updated up to 31 March”. Enter it with the rate EPFO
            declared.
          </Text>
          <View style={{ flexDirection: 'row', marginTop: theme.space[2] }}>
            <Button
              label={`Add interest for ${missing[0]}`}
              size="sm"
              onPress={() => onOpen({ type: 'pf', id: null, kind: 'interest', fy: missing[0] })}
            />
          </View>
        </Card>
      ) : null}
      {employers.length ? (
        <Card>
          <Text variant="title">Where it came from</Text>
          {contributionsByEmployer(pfEntries).map((item) => (
            <ListRow
              key={item.employerId}
              title={name(item.employerId)}
              detail={`${item.months} months of contributions · pension ${formatMoneyWhole(item.pension)}`}
              value={formatMoneyWhole(item.amount)}
            />
          ))}
        </Card>
      ) : null}
      {pfYears(pfEntries).map((year) => (
        <Card key={year.fy}>
          <Text variant="title">{year.fy}</Text>
          <Text variant="caption" color="textSecondary">
            Opening {formatMoneyWhole(year.opening)} · in {formatMoneyWhole(year.contributed)} ·
            interest{' '}
            {year.interest === null
              ? 'not entered'
              : `${formatMoneyWhole(year.interest)} at ${year.rate} %`}
            {year.withdrawn ? ` · out ${formatMoneyWhole(year.withdrawn)}` : ''} · closing{' '}
            {formatMoneyWhole(year.closing)}
          </Text>
          {[...year.entries].reverse().map((entry) => (
            <ListRow
              key={entry.id}
              title={
                entry.kind === 'contribution'
                  ? `${monthLabel(entry.date.slice(0, 7))} contribution`
                  : PF_KIND_LABELS[entry.kind]
              }
              detail={[
                entry.kind === 'contribution' ? name(entry.employerId) : dayLabel(entry.date),
                entry.payslipId ? 'from payslip' : entry.note,
              ]
                .filter(Boolean)
                .join(' · ')}
              value={`${entry.kind === 'withdrawal' ? '−' : '+'}${formatMoneyWhole(amountOf(entry))}`}
              valueNote={entry.pension ? `pension ${formatMoneyWhole(entry.pension)}` : undefined}
              onPress={() => open(entry)}
            />
          ))}
        </Card>
      ))}
    </View>
  );
}
