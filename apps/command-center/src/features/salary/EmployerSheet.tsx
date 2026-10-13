import { useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { Sheet } from '@/components/overlays';
import { Button } from '@/components/ui';
import { TextField } from '@/features/expenses/components/TextField';
import { DateField } from '@/features/investments/components/DateField';
import { SwitchRow } from '@/features/investments/components/SwitchRow';
import { isValidIsoDate, todayIso } from '@/lib/domain/expenses';
import { useTheme } from '@/theme';
import { deleteEmployer, saveEmployer } from './state/salaryActions';
import { useSalaryStore } from './state/salaryStore';

/** An employer: a name and when you joined and left. No ID numbers are kept. */
export function EmployerSheet({
  employerId,
  onClose,
}: {
  employerId: string | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const toast = useToast();
  const employer = useSalaryStore((state) =>
    state.employers.find((item) => item.id === employerId),
  );
  const [name, setName] = useState(employer?.name ?? '');
  const [joinedOn, setJoinedOn] = useState<string | null>(employer?.joinedOn ?? null);
  const [leftOn, setLeftOn] = useState<string | null>(employer?.leftOn ?? null);
  const [note, setNote] = useState(employer?.note ?? '');
  const [error, setError] = useState<string | undefined>();
  const save = () => {
    if (!name.trim()) return setError('Enter the company name.');
    if ((joinedOn && !isValidIsoDate(joinedOn)) || (leftOn && !isValidIsoDate(leftOn)))
      return setError('Pick valid dates.');
    if (joinedOn && leftOn && leftOn < joinedOn) return setError('You left after you joined.');
    saveEmployer({ name, joinedOn, leftOn, note }, employerId);
    toast.show({ message: employer ? 'Employer saved' : 'Employer added' });
    onClose();
  };
  const remove = () => {
    if (!employer) return;
    if (!deleteEmployer(employer.id)) {
      setError('Payslips or PF entries name this employer. Delete or move them first.');
      return;
    }
    toast.show({ message: 'Employer deleted' });
    onClose();
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={employer ? 'Edit employer' : 'Add employer'}
      description="Payslips and PF contributions are kept per employer; PF follows you between jobs."
      footer={
        <>
          {employer ? <Button label="Delete" variant="danger" size="sm" onPress={remove} /> : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label={employer ? 'Save' : 'Add employer'} onPress={save} />
        </>
      }
    >
      <View style={{ gap: theme.space[4] }}>
        <TextField
          label="Company"
          value={name}
          onChangeText={(next) => {
            setName(next);
            setError(undefined);
          }}
          maxLength={80}
          placeholder="e.g. Acme Technologies"
          error={error}
        />
        <SwitchRow
          label="Joined on a known date"
          value={joinedOn !== null}
          onChange={(on) => setJoinedOn(on ? todayIso() : null)}
        />
        {joinedOn !== null ? (
          <DateField label="Joined" value={joinedOn} onChange={setJoinedOn} />
        ) : null}
        <SwitchRow
          label="I have left"
          value={leftOn !== null}
          onChange={(on) => setLeftOn(on ? todayIso() : null)}
        />
        {leftOn !== null ? <DateField label="Left" value={leftOn} onChange={setLeftOn} /> : null}
        <TextField label="Note" value={note} onChangeText={setNote} maxLength={300} />
      </View>
    </Sheet>
  );
}
