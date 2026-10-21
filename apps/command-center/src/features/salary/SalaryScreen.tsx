import { useState } from 'react';
import { View } from 'react-native';
import { Briefcase, Plus } from '@/components/icons';
import { EmptyState } from '@/components/feedback';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, SegmentedControl } from '@/components/ui';
import { SampleDataBadge } from '@/features/preview/SampleDataBadge';
import { useTheme } from '@/theme';
import { EmployersPanel } from './EmployersPanel';
import { ImportPayslipsButton } from './import/ImportPayslipsButton';
import { PayslipsPanel } from './PayslipsPanel';
import { PfPanel } from './PfPanel';
import { SalarySheets, type SalaryPanel } from './SalarySheets';
import { useSalaryStore } from './state/salaryStore';

type Tab = 'payslips' | 'pf' | 'employers';
const TABS = [
  { value: 'payslips', label: 'Payslips' },
  { value: 'pf', label: 'PF / EPF' },
  { value: 'employers', label: 'Employers' },
] as const;

/** Salary payslips, the PF passbook and employers, independent of any one company. */
export function SalaryScreen() {
  const theme = useTheme();
  const available = useSalaryStore((state) => state.available);
  const [tab, setTab] = useState<Tab>('payslips');
  const [panel, setPanel] = useState<SalaryPanel>(null);
  const add: Record<Tab, { label: string; panel: SalaryPanel }> = {
    payslips: { label: 'Add payslip', panel: { type: 'payslip', id: null } },
    pf: { label: 'Add PF entry', panel: { type: 'pf', id: null, kind: 'interest' } },
    employers: { label: 'Add employer', panel: { type: 'employer', id: null } },
  };
  return (
    <Screen>
      <PageHeader
        title="Salary & PF"
        meta={<SampleDataBadge editable />}
        actions={
          available ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
              {tab === 'payslips' ? <ImportPayslipsButton /> : null}
              <Button label={add[tab].label} icon={Plus} onPress={() => setPanel(add[tab].panel)} />
            </View>
          ) : null
        }
      />
      {available ? (
        <View style={{ gap: theme.space[4] }}>
          <SegmentedControl
            segments={TABS}
            value={tab}
            onChange={setTab}
            accessibilityLabel="Salary sections"
            fill={false}
          />
          {tab === 'payslips' ? <PayslipsPanel onOpen={setPanel} /> : null}
          {tab === 'pf' ? <PfPanel onOpen={setPanel} /> : null}
          {tab === 'employers' ? <EmployersPanel onOpen={setPanel} /> : null}
        </View>
      ) : (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="Salary & PF needs a database update"
            body="Run supabase/migrations/202610170016_salary_pf.sql in the Supabase SQL Editor, then reload."
          />
        </Card>
      )}
      <SalarySheets panel={panel} onClose={() => setPanel(null)} />
    </Screen>
  );
}
