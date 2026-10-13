import { CV_HEADINGS, type Cv, type CvEntry } from './types';

/**
 * The CV as an ordered list of lines, shared by the PDF, the Word file and the ATS check
 * so they always say the same thing. Reading order is the order an ATS parses.
 */
export type CvLine =
  | { kind: 'name' | 'title' | 'contact' | 'heading' | 'sub' | 'bullet' | 'text'; text: string }
  | { kind: 'entry'; text: string; dates: string }
  | { kind: 'label'; label: string; text: string };

function entries(heading: string, items: CvEntry[]): CvLine[] {
  if (!items.length) return [];
  const lines: CvLine[] = [{ kind: 'heading', text: heading }];
  for (const item of items) {
    lines.push({ kind: 'entry', text: item.heading, dates: item.dates });
    if (item.subheading) lines.push({ kind: 'sub', text: item.subheading });
    for (const bullet of item.bullets) lines.push({ kind: 'bullet', text: bullet });
    if (item.line) lines.push({ kind: 'text', text: item.line });
  }
  return lines;
}

export function cvLines(cv: Cv): CvLine[] {
  const lines: CvLine[] = [];
  if (cv.name) lines.push({ kind: 'name', text: cv.name });
  if (cv.title) lines.push({ kind: 'title', text: cv.title });
  if (cv.contact.length) lines.push({ kind: 'contact', text: cv.contact.join(' | ') });
  if (cv.summary) {
    lines.push({ kind: 'heading', text: CV_HEADINGS.summary }, { kind: 'text', text: cv.summary });
  }
  if (cv.skills.length) {
    lines.push({ kind: 'heading', text: CV_HEADINGS.skills });
    for (const group of cv.skills) {
      lines.push({ kind: 'label', label: group.label, text: group.items.join(', ') });
    }
  }
  return [
    ...lines,
    ...entries(CV_HEADINGS.experience, cv.experience),
    ...entries(CV_HEADINGS.projects, cv.projects),
    ...entries(CV_HEADINGS.education, cv.education),
    ...entries(CV_HEADINGS.certifications, cv.certifications),
  ];
}

/** The CV as plain text, one line per line. */
export function cvPlainText(cv: Cv): string {
  return cvLines(cv)
    .map((line) => {
      if (line.kind === 'entry') return line.dates ? `${line.text} | ${line.dates}` : line.text;
      if (line.kind === 'label') return `${line.label}: ${line.text}`;
      if (line.kind === 'bullet') return `• ${line.text}`;
      if (line.kind === 'heading') return `\n${line.text.toUpperCase()}`;
      return line.text;
    })
    .join('\n')
    .trim();
}
