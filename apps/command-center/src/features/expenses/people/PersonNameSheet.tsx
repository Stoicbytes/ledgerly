import { useState } from 'react';
import { Sheet } from '@/components/overlays';
import { Button } from '@/components/ui';
import type { Person } from '@/lib/domain/expenses';
import { TextField } from '../components/TextField';
import { savePerson } from '../state/peopleActions';

type PersonNameSheetProps = {
  /** null = add a new person. */
  person: Person | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (person: Person) => void;
};

/** Add a person, or rename one. */
export function PersonNameSheet({ person, visible, onClose, onSaved }: PersonNameSheetProps) {
  const [name, setName] = useState(person?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const result = savePerson(name, person?.id);
    if (typeof result === 'string') return setError(result);
    onSaved(result);
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={person ? `Rename ${person.name}` : 'Add a person'}
      description="Someone you share expenses with."
      footer={<Button label={person ? 'Save' : 'Add'} fullWidth onPress={save} />}
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        error={error}
        maxLength={30}
        autoFocus
        onSubmitEditing={save}
      />
    </Sheet>
  );
}
