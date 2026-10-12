import { options, visible, type FieldSpec } from './fieldTypes';

/** Links, numbers and highlights, skills and extra sections. */
export const LINK_FIELDS: FieldSpec[] = [
  {
    key: 'kind',
    type: 'choice',
    label: 'Type',
    options: options(
      ['github', 'GitHub'],
      ['linkedin', 'LinkedIn'],
      ['x', 'X'],
      ['website', 'Website'],
      ['email', 'Email'],
      ['youtube', 'YouTube'],
      ['medium', 'Medium'],
      ['devto', 'DEV'],
      ['stackoverflow', 'Stack Overflow'],
      ['instagram', 'Instagram'],
      ['other', 'Other'],
    ),
  },
  { key: 'label', type: 'text', label: 'Label', max: 40, required: true },
  {
    key: 'url',
    type: 'text',
    label: 'Address',
    max: 500,
    format: 'url',
    required: true,
    placeholder: 'https://…',
    hint: 'https:// or mailto: only.',
  },
  visible,
];

export const FACT_FIELDS: FieldSpec[] = [
  {
    key: 'kind',
    type: 'choice',
    label: 'Type',
    options: options(
      ['stat', 'Number (counter)'],
      ['highlight', 'Highlight'],
      ['milestone', 'Milestone'],
    ),
  },
  { key: 'label', type: 'text', label: 'Label', max: 80, required: true },
  {
    key: 'value',
    type: 'number',
    label: 'Number',
    min: 0,
    max: 1_000_000_000,
    required: true,
    when: (v) => v.kind === 'stat',
    hint: 'Shown exactly as entered; nothing is estimated.',
  },
  {
    key: 'suffix',
    type: 'text',
    label: 'After the number',
    max: 12,
    placeholder: '+',
    when: (v) => v.kind === 'stat',
  },
  {
    key: 'when_label',
    type: 'text',
    label: 'When',
    max: 40,
    placeholder: 'Aug 2025',
    when: (v) => v.kind === 'milestone',
  },
  { key: 'detail', type: 'text', label: 'Detail', max: 400, when: (v) => v.kind !== 'stat' },
  visible,
];

export const SKILL_GROUP_FIELDS: FieldSpec[] = [
  { key: 'name', type: 'text', label: 'Area', max: 60, required: true, placeholder: 'Backend' },
  { key: 'description', type: 'text', label: 'Description', max: 300 },
  visible,
];

export const SKILL_FIELDS: FieldSpec[] = [
  { key: 'name', type: 'text', label: 'Skill', max: 60, required: true },
  { key: 'group_id', type: 'group', label: 'Area', required: true },
  { key: 'icon', type: 'icon', label: 'Icon' },
  { key: 'level', type: 'level', label: 'Level', hint: 'Optional. Shown only when you set it.' },
  {
    key: 'description',
    type: 'text',
    label: 'Description',
    max: 300,
    hint: 'Shown when a visitor opens the skill.',
  },
  {
    key: 'featured',
    type: 'switch',
    label: 'Core skill',
    hint: 'Highlighted, and labelled in the hero.',
  },
  visible,
];

export const SECTION_FIELDS: FieldSpec[] = [
  {
    key: 'kind',
    type: 'choice',
    label: 'Type',
    options: options(
      ['interests', 'Interests'],
      ['writing', 'Writing'],
      ['experiments', 'Experiments'],
      ['custom', 'Other'],
    ),
  },
  { key: 'title', type: 'text', label: 'Title', max: 80, required: true },
  { key: 'body', type: 'markdown', label: 'Text', max: 4000, rows: 5 },
  { key: 'items', type: 'items', label: 'Items' },
  visible,
];
