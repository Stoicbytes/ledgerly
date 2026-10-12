import { options, visible, type FieldSpec } from './fieldTypes';

/** Work experience, education and certifications. */
export const EXPERIENCE_FIELDS: FieldSpec[] = [
  { key: 'role', type: 'text', label: 'Job title', max: 100, required: true },
  { key: 'company', type: 'text', label: 'Company', max: 100, required: true },
  { key: 'client', type: 'text', label: 'Client or project', max: 100 },
  { key: 'location', type: 'text', label: 'Location', max: 80 },
  { key: 'employment_type', type: 'text', label: 'Type', max: 40, placeholder: 'Full-time' },
  { key: 'started_on', type: 'date', label: 'Started', required: true },
  { key: 'ended_on', type: 'date', label: 'Ended', hint: 'Leave empty for your current role.' },
  { key: 'summary', type: 'markdown', label: 'Summary', max: 2000, rows: 3 },
  {
    key: 'responsibilities',
    type: 'list',
    label: 'Responsibilities',
    maxItems: 12,
    maxLength: 400,
  },
  { key: 'highlights', type: 'list', label: 'Key contributions', maxItems: 8, maxLength: 400 },
  { key: 'achievements', type: 'list', label: 'Achievements', maxItems: 8, maxLength: 400 },
  { key: 'tech', type: 'tags', label: 'Technologies', maxItems: 24, maxLength: 40 },
  visible,
];

export const EDUCATION_FIELDS: FieldSpec[] = [
  {
    key: 'kind',
    type: 'choice',
    label: 'Type',
    options: options(
      ['degree', 'Education'],
      ['certification', 'Certification'],
      ['course', 'Course'],
      ['award', 'Award'],
    ),
  },
  { key: 'title', type: 'text', label: 'Title', max: 140, required: true },
  { key: 'issuer', type: 'text', label: 'Institution or issuer', max: 120 },
  {
    key: 'started_on',
    type: 'date',
    label: 'Started',
    when: (v) => v.kind === 'degree' || v.kind === 'course',
  },
  {
    key: 'ended_on',
    type: 'date',
    label: 'Finished',
    when: (v) => v.kind === 'degree' || v.kind === 'course',
  },
  { key: 'issued_on', type: 'date', label: 'Issued', when: (v) => v.kind !== 'degree' },
  { key: 'expires_on', type: 'date', label: 'Expires', when: (v) => v.kind === 'certification' },
  {
    key: 'credential_url',
    type: 'text',
    label: 'Credential link',
    max: 500,
    format: 'url',
    placeholder: 'https://…',
  },
  { key: 'grade', type: 'text', label: 'Grade', max: 40 },
  { key: 'description', type: 'text', label: 'Description', max: 1000 },
  { key: 'image', type: 'image', label: 'Badge or logo' },
  visible,
];
