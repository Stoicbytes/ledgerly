import { cvPlainText } from './layout';
import { atsKeywords } from './keywords';
import type { Cv } from './types';

/**
 * Ledgerly's own ATS readiness check: common guidance from ATS vendors and recruiters
 * (parsable layout, contact details, a summary, enough skills, dated roles with
 * quantified, action-led bullets, sensible length) and, with a job description, how
 * many of its keywords the CV contains. Real ATS scores differ by employer and system.
 */
export type AtsCheck = { id: string; label: string; ok: boolean; weight: number; tip: string };
export type AtsReport = {
  score: number;
  checks: AtsCheck[];
  keywords: { matched: string[]; missing: string[] } | null;
};

const WEAK = /^(responsible|worked|helped|assisted|involved|duties|participated|tasked)\b/i;
const VERB_ENDING = /^[a-z]+(ed|ing|ize|ised|ized)$/i;
const VERBS = new Set(
  (
    'achieve automate build built create cut deliver design develop drive enable grow ' +
    'implement improve increase launch lead led manage mentor migrate own optimise optimize ' +
    'reduce refactor release run scale ship simplify speed spearhead streamline test write'
  ).split(' '),
);
const words = (text: string) => text.split(/\s+/).filter(Boolean);
const share = (items: string[], test: (item: string) => boolean) =>
  items.length ? items.filter(test).length / items.length : 0;

function actionLed(bullet: string): boolean {
  const first = (bullet.match(/^[A-Za-z]+/) ?? [''])[0];
  if (!first || WEAK.test(bullet)) return false;
  const lower = first.toLowerCase();
  return VERBS.has(lower) || VERBS.has(lower.replace(/e?d$|s$/, '')) || VERB_ENDING.test(first);
}

export function atsReport(cv: Cv, jobDescription = ''): AtsReport {
  const text = cvPlainText(cv);
  const roleBullets = cv.experience.flatMap((role) => role.bullets);
  const allBullets = [...roleBullets, ...cv.projects.flatMap((project) => project.bullets)];
  const skillCount = cv.skills.reduce((sum, group) => sum + group.items.length, 0);
  const total = words(text).length;
  const summaryWords = words(cv.summary).length;
  const has = (pattern: RegExp) => cv.contact.some((item) => pattern.test(item));
  const check = (id: string, label: string, ok: boolean, weight: number, tip: string) =>
    ({ id, label, ok, weight, tip }) as AtsCheck;

  const checks = [
    check('format', 'One column, standard headings, real text', true, 15, ''),
    check(
      'email',
      'Email address',
      has(/@/),
      10,
      'Add a public email in Profile, or an Email link.',
    ),
    check('phone', 'Phone number', has(/\+?\d[\d\s-]{7,}/), 5, 'Type it above; it is not saved.'),
    check(
      'title',
      'Professional title',
      Boolean(cv.title),
      5,
      'Add a professional title in Profile.',
    ),
    check(
      'summary',
      'Summary of 25–100 words',
      summaryWords >= 25 && summaryWords <= 100,
      10,
      'Write 2–4 sentences in Profile → Introduction.',
    ),
    check('skills', 'At least 8 skills', skillCount >= 8, 10, 'Add the tools you use in Skills.'),
    check(
      'roles',
      'Dated roles with bullet points',
      cv.experience.length > 0 && cv.experience.every((role) => role.dates && role.bullets.length),
      10,
      'Give every role a start date and key contributions.',
    ),
    check(
      'depth',
      'Three or more bullets per role',
      cv.experience.length > 0 && cv.experience.every((role) => role.bullets.length >= 3),
      5,
      'Add responsibilities or achievements to each role.',
    ),
    check(
      'numbers',
      'Results with numbers (30% of bullets)',
      share(roleBullets, (bullet) => /\d/.test(bullet)) >= 0.3,
      10,
      'Quantify results: "Cut load time by 40%", "Served 10k users".',
    ),
    check(
      'verbs',
      'Bullets start with action verbs',
      share(allBullets, actionLed) >= 0.5,
      5,
      'Start with Built, Led, Reduced… rather than "Responsible for".',
    ),
    check(
      'concise',
      'Bullets under 35 words',
      allBullets.every((bullet) => words(bullet).length <= 35),
      5,
      'Split or shorten long bullets.',
    ),
    check(
      'length',
      'One to two pages (300–1,100 words)',
      total >= 300 && total <= 1100,
      5,
      total < 300 ? 'Add more detail to roles and projects.' : 'Trim older roles and projects.',
    ),
    check(
      'education',
      'Education or certifications',
      cv.education.length + cv.certifications.length > 0,
      5,
      'Add a degree or certification.',
    ),
  ];
  const base = checks.reduce((sum, item) => sum + (item.ok ? item.weight : 0), 0);
  const wanted = atsKeywords(jobDescription);
  if (!wanted.length) return { score: base, checks, keywords: null };
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ')} `;
  const matched = wanted.filter((word) => haystack.includes(` ${word} `));
  const missing = wanted.filter((word) => !matched.includes(word));
  const match = Math.round((matched.length / wanted.length) * 100);
  checks.push(
    check(
      'keywords',
      `Job keywords found: ${match}%`,
      match >= 60,
      0,
      'Add the missing keywords you genuinely have to Skills or role bullets.',
    ),
  );
  return { score: Math.round(base * 0.6 + match * 0.4), checks, keywords: { matched, missing } };
}
