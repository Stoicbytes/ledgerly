import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useToast } from '@/components/feedback';
import { ConfirmSheet, Sheet } from '@/components/overlays';
import { Button, Text } from '@/components/ui';
import {
  formValues,
  shownFields,
  slugify,
  validateValues,
  type EditKind,
  type Errors,
  type Row,
  type Values,
} from '@/lib/domain/site';
import { useTheme } from '@/theme';
import { FieldInput } from '../fields/FieldInput';
import { siteErrorMessage } from '../state/siteErrors';
import { useSiteStore } from '../state/siteStore';

const TITLES: Record<EditKind, string> = {
  profile: 'Profile',
  link: 'Link',
  fact: 'Number or highlight',
  skill_group: 'Skill area',
  skill: 'Skill',
  project: 'Project',
  experience: 'Experience',
  education: 'Education or certification',
  section: 'Beyond the code',
};

type Props = {
  kind: EditKind;
  row: Row | null;
  /** Starting values for a new item (e.g. the area a new skill goes in). */
  initial?: Values;
  onClose: () => void;
};

/** Add or edit one item (or the profile); every form uses the same field definitions. */
export function ItemSheet({ kind, row, initial, onClose }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const store = useSiteStore();
  const [values, setValues] = useState<Values>(() => ({ ...formValues(kind, row), ...initial }));
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const siblings = kind === 'profile' ? [] : store.rows[kind];
  const fields = useMemo(() => shownFields(kind, values), [kind, values]);
  const context = {
    groups: store.rows.skill_group,
    name: String(store.profile?.full_name ?? values.full_name ?? ''),
    canUpload: store.mode === 'cloud',
  };

  const set = (key: string, value: Values[string]) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      // A new project's page address follows its title until edited by hand.
      if (
        kind === 'project' &&
        key === 'title' &&
        !row &&
        current.slug === slugify(String(current.title ?? ''))
      ) {
        next.slug = slugify(String(value ?? ''));
      }
      return next;
    });
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };

  const save = async () => {
    const found = validateValues(kind, values, siblings, row?.id);
    setErrors(found);
    if (Object.keys(found).length) return setProblem('Check the highlighted fields.');
    setSaving(true);
    setProblem(null);
    try {
      await store.save(kind, values, row?.id);
      toast.show({ message: row || kind === 'profile' ? 'Saved' : 'Added' });
      onClose();
    } catch (error) {
      setProblem(siteErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!row || kind === 'profile') return;
    try {
      await store.remove(kind, row.id);
      toast.show({ message: 'Deleted' });
      onClose();
    } catch (error) {
      setConfirming(false);
      setProblem(siteErrorMessage(error));
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`${row || kind === 'profile' ? 'Edit' : 'Add'} ${TITLES[kind].toLowerCase()}`}
      width={620}
      footer={
        <>
          {row && kind !== 'profile' ? (
            <Button label="Delete" variant="danger" size="sm" onPress={() => setConfirming(true)} />
          ) : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label="Save" onPress={save} loading={saving} disabled={saving} />
        </>
      }
    >
      <View style={{ gap: theme.space[4] }}>
        {fields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={values[field.key] ?? null}
            onChange={(value) => set(field.key, value)}
            error={errors[field.key]}
            context={context}
          />
        ))}
        {problem ? (
          <Text variant="body" color="danger" role="alert">
            {problem}
          </Text>
        ) : null}
      </View>
      <ConfirmSheet
        visible={confirming}
        title="Delete this?"
        message={
          kind === 'skill_group'
            ? 'The area and every skill in it are deleted. The live site changes only when you publish.'
            : 'It is removed from your portfolio. The live site changes only when you publish.'
        }
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </Sheet>
  );
}
