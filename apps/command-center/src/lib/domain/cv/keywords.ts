/**
 * Keywords from a job description, the way a simple ATS match works: the words and tool
 * names that repeat or look like technologies, without common English and job-ad filler.
 * Done on the device; the job description is never sent anywhere.
 */
const STOP = new Set(
  (
    'a about above across after all also an and any are as at be been being both but by can ' +
    'could do does each etc for from has have having how if in into is it its may more most ' +
    'must no not of on one or other our out over per should so some such than that the their ' +
    'them then there these they this those through to under up us use using via was we were ' +
    'what when where which while who will with within would you your ' +
    'ability able apply applicant benefits best candidate company role position job work ' +
    'working team teams year years experience experienced plus strong good great excellent ' +
    'skills skill knowledge understanding including include includes new well like help ' +
    'looking join opportunity responsibilities requirements required preferred nice day ' +
    'environment based across ensure support across within make build building'
  ).split(' '),
);

/** Up to `limit` keywords, most important first, lowercased. */
export function atsKeywords(jobDescription: string, limit = 25): string[] {
  const counts = new Map<string, { count: number; techy: boolean }>();
  const pattern = /[A-Za-z][A-Za-z0-9+#.]*[A-Za-z0-9+#]|[A-Za-z]/g;
  for (const match of jobDescription.matchAll(pattern)) {
    const raw = match[0];
    const word = raw.toLowerCase().replace(/\.+$/, '');
    if (word.length < 2 || STOP.has(word)) continue;
    // Tool-like: contains + # . or a digit, ALL CAPS, CamelCase, or Capitalised mid-sentence.
    const before = jobDescription.slice(0, match.index).trimEnd();
    const midSentence = before.length > 0 && !/[.!?:;\n•*-]$/.test(before);
    const techy =
      /[+#.\d]/.test(raw) ||
      /^[A-Z]{2,}$/.test(raw) ||
      /^[A-Z][a-z]+[A-Z]/.test(raw) ||
      (midSentence && /^[A-Z][a-z]/.test(raw));
    const entry = counts.get(word) ?? { count: 0, techy: false };
    counts.set(word, { count: entry.count + 1, techy: entry.techy || techy });
  }
  return [...counts.entries()]
    .filter(([, value]) => value.count >= 2 || value.techy)
    .sort((a, b) => Number(b[1].techy) - Number(a[1].techy) || b[1].count - a[1].count)
    .slice(0, limit)
    .map(([word]) => word);
}
