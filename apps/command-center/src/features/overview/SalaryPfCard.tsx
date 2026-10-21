import { Link, router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Button, Card, CardHeader, Text } from '@/components/ui';
import { useSalaryStore } from '@/features/salary/state/salaryStore';
import { monthLabel, todayIso } from '@/lib/domain/expenses';
import { salaryOverview } from '@/lib/domain/insights';
import { formatAxisMoney, formatMoneyWhole as money } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { SalaryPfCharts } from './SalaryPfCharts';

const SALARY = '/dashboard/salary' as Href;

/**
 * Salary & PF on the home screen: the newest net pay, this financial year's pay and tax, the
 * PF balance (pension apart, as on the PF page) and two charts. Loaded after the first paint.
 */
export function SalaryPfCard({ index = 8 }: { index?: number }) {
  const theme = useTheme();
  const { available, payslips, pfEntries, employers } = useSalaryStore();
  const view = useMemo(
    () => salaryOverview(payslips, pfEntries, todayIso()),
    [payslips, pfEntries],
  );
  if (!available) return null;
  const link = (
    <Link href={SALARY} accessibilityLabel="Open Salary & PF">
      <Text variant="label" color="accent">
        Salary & PF
      </Text>
    </Link>
  );
  if (!view.latest && !pfEntries.length) {
    return (
      <Card index={index} style={{ gap: theme.space[3] }}>
        <CardHeader title="Salary & PF" subtitle="Pay, tax and PF in one place" action={link} />
        <Text color="textSecondary">
          Import your payslips to see net pay by month, tax deducted and your PF balance here.
        </Text>
        <View style={{ flexDirection: 'row' }}>
          <Button label="Import payslips" size="sm" onPress={() => router.push(SALARY)} />
        </View>
      </Card>
    );
  }
  const { latest, year, pf } = view;
  const employer = (id: string) => employers.find((item) => item.id === id)?.name;
  const figures = [
    latest && {
      label: 'Latest net pay',
      value: latest.net,
      note: [monthLabel(latest.slip.month), employer(latest.slip.employerId)]
        .filter(Boolean)
        .join(' · '),
    },
    year && { label: `Gross pay, ${year.fy}`, value: year.gross, note: `net ${money(year.net)}` },
    year && {
      label: 'Tax deducted (TDS)',
      value: year.tds,
      note: view.tdsRate === null ? year.fy : `${(view.tdsRate * 100).toFixed(1)}% of gross`,
    },
    pfEntries.length && {
      label: 'PF balance',
      value: pf.total,
      note: `yours ${formatAxisMoney(pf.employee)} · employer ${formatAxisMoney(pf.employer)}`,
    },
    pf.pension > 0 && {
      label: 'Pension (EPS)',
      value: pf.pension,
      note: 'apart: not withdrawable',
    },
  ].filter((item) => !!item);
  return (
    <Card index={index} style={{ gap: theme.space[4] }}>
      <CardHeader
        title="Salary & PF"
        subtitle={year ? `${year.fy}: ${year.months} payslips so far` : 'Your PF passbook'}
        action={link}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[4] }}>
        {figures.map((item) => (
          <View key={item.label} style={{ flexBasis: 140, flexGrow: 1, gap: 2 }}>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {item.label}
            </Text>
            <Text variant="figureSm" numberOfLines={1}>
              {money(item.value)}
            </Text>
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {item.note}
            </Text>
          </View>
        ))}
      </View>
      <SalaryPfCharts pay={view.pay} pfHistory={view.pfHistory} />
    </Card>
  );
}
