import { EDUCATION_FIELDS, EXPERIENCE_FIELDS } from './careerFields';
import {
  FACT_FIELDS,
  LINK_FIELDS,
  SECTION_FIELDS,
  SKILL_FIELDS,
  SKILL_GROUP_FIELDS,
} from './contentFields';
import type { FieldSpec } from './fieldTypes';
import { PROFILE_FIELDS } from './profileFields';
import { PROJECT_FIELDS } from './projectFields';
import type { EditKind, Values } from './types';

export type { FieldSpec } from './fieldTypes';

/**
 * What each editor asks for. One definition drives the form, the checks before saving
 * and the payload, and mirrors the limits the database enforces (migration 0010).
 */
export const FIELDS: Record<EditKind, FieldSpec[]> = {
  profile: PROFILE_FIELDS,
  link: LINK_FIELDS,
  fact: FACT_FIELDS,
  skill_group: SKILL_GROUP_FIELDS,
  skill: SKILL_FIELDS,
  project: PROJECT_FIELDS,
  experience: EXPERIENCE_FIELDS,
  education: EDUCATION_FIELDS,
  section: SECTION_FIELDS,
};

export const shownFields = (kind: EditKind, values: Values) =>
  FIELDS[kind].filter((field) => !field.when || field.when(values));
