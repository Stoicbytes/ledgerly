import { useState } from 'react';
import { View } from 'react-native';
import { FileText } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { Card, Text } from '@/components/ui';
import { ChipField } from '@/features/investments/components/ChipField';
import { monthLabel } from '@/lib/domain/expenses';
import { grossPay, netPay, payslipYear, salaryYears } from '@/lib/domain/salary';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { useTheme } from '@/theme';
import { ListRow } from './components/ListRow';
import type { SalaryPanel } from './SalarySheets';
import { useSalaryStore } from './state/salaryStore';

/** Payslips by financial year: the year's totals, each employer's part, and every month. */
export function PayslipsPanel({ onOpen }: { onOpen: (panel: SalaryPanel) => void }) {
  const theme = useTheme();
  const { employers, payslips } = useSalaryStore();
  const years = salaryYears(payslips);
  const [picked, setPicked] = useState<string | null>(null);
  const year = years.find((item) => item.fy === picked) ?? years[0];
  const name = (id: string) => employers.find((item) => item.id === id)?.name ?? 'Employer';
  if (!year) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Add your payslips"
          body="One a month, per employer: earnings, deductions, PF and tax as printed. Totals by financial year follow, across job changes."
          action={{ label: 'Add a payslip', onPress: () => onOpen({ type: 'payslip', id: null }) }}
        />
      </Card>
    );
  }
  const slips = payslips
    .filter((slip) => payslipYear(slip.month) === year.fy)
    .sort((a, b) => b.month.localeCompare(a.month));
  const figures = [
    { label: 'Gross', value: year.gross },
    { label: 'Net pay', value: year.net },
    { label: 'Tax (TDS)', value: year.tds },
    { label: 'Your PF', value: year.pf },
    { label: 'Employer PF', value: year.employerPf },
  ];
  return (
    <View style={{ gap: theme.space[4] }}>
      {years.length > 1 ? (
        <ChipField
          label="Financial year"
          options={years.map((item) => item.fy)}
          value={year.fy}
          onChange={setPicked}
        />
      ) : null}
      <Card>
        <Text variant="title">
          {year.fy} · {year.months} {year.months === 1 ? 'payslip' : 'payslips'}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.space[4],
            marginTop: theme.space[3],
          }}
        >
          {figures.map((item) => (
            <View key={item.label} style={{ minWidth: 120, gap: 2 }}>
              <Text variant="caption" color="textSecondary">
                {item.label}
              </Text>
              <Text variant="figureSm">{formatMoneyWhole(item.value)}</Text>
            </View>
          ))}
        </View>
        {year.byEmployer.length > 1
          ? year.byEmployer.map((part) => (
              <ListRow
                key={part.employerId}
                title={name(part.employerId)}
                detail={`${part.months} months · TDS ${formatMoneyWhole(part.tds)}`}
                value={formatMoneyWhole(part.net)}
                valueNote={`gross ${formatMoneyWhole(part.gross)}`}
              />
            ))
          : null}
      </Card>
      <Card>
        {slips.map((slip) => (
          <ListRow
            key={slip.id}
            title={monthLabel(slip.month)}
            detail={name(slip.employerId)}
            value={formatMoneyWhole(netPay(slip))}
            valueNote={`gross ${formatMoneyWhole(grossPay(slip))}`}
            onPress={() => onOpen({ type: 'payslip', id: slip.id })}
          />
        ))}
      </Card>
    </View>
  );
}
