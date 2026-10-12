import { View } from 'react-native';
import { Text } from '@/components/ui';
import { PickChip } from '@/features/expenses/entry/PickChip';
import { TextField } from '@/features/expenses/components/TextField';
import { ChipField } from '@/features/investments/components/ChipField';
import { SwitchRow } from '@/features/investments/components/SwitchRow';
import {
  SECTION_KEYS,
  type FieldSpec,
  type FieldValue,
  type FileRef,
  type GalleryItem,
  type Media,
  type Row,
  type SectionItem,
} from '@/lib/domain/site';
import { useTheme } from '@/theme';
import { GalleryField, ItemsField } from './CollectionFields';
import { IconField } from './IconField';
import { FileField, ImageField } from './MediaFields';
import { NumberField, OptionalDate } from './SimpleFields';
import { TextAreaField } from './TextAreaField';

export type FieldContext = { groups: Row[]; name: string; canUpload: boolean };

const LEVELS = ['Not shown', 'Learning', 'Familiar', 'Proficient', 'Advanced', 'Expert'];

/** One form field, drawn from its definition (see lib/domain/site/fields.ts). */
export function FieldInput({
  field,
  value,
  onChange,
  error,
  context,
}: {
  field: FieldSpec;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  error?: string;
  context: FieldContext;
}) {
  const theme = useTheme();
  const text = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? (value as string[]) : [];
  switch (field.type) {
    case 'text':
      return (
        <TextField
          label={field.label}
          value={text}
          onChangeText={onChange}
          maxLength={field.max}
          placeholder={field.placeholder}
          hint={field.hint}
          error={error}
          autoCapitalize={field.format ? 'none' : 'sentences'}
          inputMode={
            field.format === 'email'
              ? 'email'
              : field.format === 'url' || field.format === 'httpsUrl'
                ? 'url'
                : 'text'
          }
        />
      );
    case 'markdown':
      return (
        <TextAreaField
          label={field.label}
          value={text}
          onChangeText={onChange}
          max={field.max}
          rows={field.rows}
          hint={field.hint}
          error={error}
        />
      );
    case 'list':
      return (
        <TextAreaField
          label={field.label}
          value={list.join('\n')}
          onChangeText={(next) => onChange(next.split('\n'))}
          max={field.maxItems * (field.maxLength + 1)}
          rows={4}
          hint={field.hint ?? `One per line, up to ${field.maxItems}.`}
          error={error}
        />
      );
    case 'tags':
      return (
        <TextField
          label={field.label}
          value={list.join(', ')}
          onChangeText={(next) => onChange(next.split(/,\s*/))}
          hint={field.hint ?? 'Separate with commas.'}
          error={error}
        />
      );
    case 'choice':
      return (
        <ChipField
          label={field.label}
          options={field.options}
          value={text || null}
          onChange={onChange}
        />
      );
    case 'switch':
      return (
        <SwitchRow
          label={field.label}
          hint={field.hint}
          value={value === true}
          onChange={onChange}
        />
      );
    case 'date':
      return <OptionalDate field={field} value={text || null} onChange={onChange} error={error} />;
    case 'number':
      return <NumberField field={field} value={value} onChange={onChange} error={error} />;
    case 'level':
      return (
        <ChipField
          label={field.label}
          options={LEVELS.map((label, level) => ({ value: String(level), label }))}
          value={String(typeof value === 'number' ? value : 0)}
          onChange={(next) => onChange(next === '0' ? null : Number(next))}
        />
      );
    case 'icon':
      return <IconField value={text} onChange={onChange} />;
    case 'group':
      return (
        <ChipField
          label={field.label}
          options={context.groups.map((group) => ({
            value: group.id,
            label: String(group.name ?? ''),
          }))}
          value={text || null}
          onChange={onChange}
        />
      );
    case 'sections':
      return (
        <View style={{ gap: 6 }}>
          <Text variant="label" color="textSecondary">
            {field.label}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
            {SECTION_KEYS.map(([key, label]) => (
              <PickChip
                key={key}
                label={label}
                selected={list.includes(key)}
                onPress={() =>
                  onChange(list.includes(key) ? list.filter((k) => k !== key) : [...list, key])
                }
              />
            ))}
          </View>
          <Text variant="caption" color="textTertiary">
            Sections without content are hidden automatically.
          </Text>
        </View>
      );
    case 'items':
      return (
        <ItemsField value={(value as SectionItem[]) ?? []} onChange={onChange} error={error} />
      );
    case 'gallery':
      return (
        <GalleryField
          value={(value as GalleryItem[]) ?? []}
          onChange={onChange}
          error={error}
          canUpload={context.canUpload}
        />
      );
    case 'image':
      return (
        <ImageField
          label={field.label}
          value={(value as Media | null) ?? null}
          onChange={onChange}
          hint={field.hint}
          error={error}
          wide={field.wide}
          defaultAlt={field.key === 'avatar' ? `Portrait of ${context.name}` : ''}
          canUpload={context.canUpload}
        />
      );
    case 'file':
      return (
        <FileField
          label={field.label}
          value={(value as FileRef | null) ?? null}
          onChange={onChange}
          canUpload={context.canUpload}
        />
      );
  }
}
