/**
 * A CV built from the portfolio's content, laid out the way applicant tracking systems
 * (ATS) read best: one column, standard section headings, plain text, dates on every role.
 */
export type CvEntry = {
  /** Job title, degree or project name. */
  heading: string;
  /** Company, institution or tagline. */
  subheading: string;
  /** "Jan 2024 – Present", or empty. */
  dates: string;
  bullets: string[];
  /** A closing line, such as "Technologies: React, Node.js". */
  line: string;
};

export type CvSkillGroup = { label: string; items: string[] };

export type Cv = {
  name: string;
  title: string;
  /** Email, phone, location and profile links, in that order. */
  contact: string[];
  summary: string;
  skills: CvSkillGroup[];
  experience: CvEntry[];
  projects: CvEntry[];
  education: CvEntry[];
  certifications: CvEntry[];
};

/** Section headings as ATS parsers expect them. */
export const CV_HEADINGS = {
  summary: 'Professional Summary',
  skills: 'Skills',
  experience: 'Work Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
} as const;
