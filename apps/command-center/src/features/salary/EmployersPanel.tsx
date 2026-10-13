import { Briefcase } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { Card } from '@/components/ui';
import { dayLabel } from '@/lib/domain/expenses';
import { formatMoneyWhole } from '@/lib/formatting/currency';
import { netPay } from '@/lib/domain/salary';
import { ListRow } from './components/ListRow';
import type { SalaryPanel } from './SalarySheets';
import { useSalaryStore } from './state/salaryStore';

/** Everyone who has paid you, newest first, with what each paid. */
export function EmployersPanel({ onOpen }: { onOpen: (panel: SalaryPanel) => void }) {
  const { employers, payslips } = useSalaryStore();
  if (!employers.length) {
    return (
      <Card>
        <EmptyState
          icon={Briefcase}
          title="Add your employer"
          body="Add each company you have worked for. Payslips and PF contributions are kept per employer, and your PF carries over when you change jobs."
          action={{ label: 'Add employer', onPress: () => onOpen({ type: 'employer', id: null }) }}
        />
      </Card>
    );
  }
  const sorted = [...employers].sort((a, b) => (b.joinedOn ?? '').localeCompare(a.joinedOn ?? ''));
  return (
    <Card>
      {sorted.map((employer) => {
        const slips = payslips.filter((slip) => slip.employerId === employer.id);
        const net = slips.reduce((total, slip) => total + netPay(slip), 0);
        const since = employer.joinedOn
          ? dayLabel(employer.joinedOn, 'short')
          : 'Start not entered';
        const until = employer.leftOn ? dayLabel(employer.leftOn, 'short') : 'present';
        return (
          <ListRow
            key={employer.id}
            title={employer.name}
            detail={`${since} – ${until}`}
            value={slips.length ? formatMoneyWhole(net) : undefined}
            valueNote={`${slips.length} ${slips.length === 1 ? 'payslip' : 'payslips'}`}
            onPress={() => onOpen({ type: 'employer', id: employer.id })}
          />
        );
      })}
    </Card>
  );
}
