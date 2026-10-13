import { readZipEntries } from '@/lib/files/zip';
import { crc32 } from '@/lib/files/zipWrite';
import { fixtureSite } from '../__fixtures__/site';
import { atsReport, atsKeywords, buildCv, cvDocx, cvFileName, cvPdf, cvPlainText } from '..';
import { dateRange, displayUrl, firstSentences, plainText } from '../text';
import { toWinAnsi } from '@/lib/files/pdf/winAnsi';

const cv = () =>
  buildCv(fixtureSite(), { phone: '+91 98765 43210', siteUrl: 'https://asha.example.dev/' });
const latin1 = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

describe('building the CV from the portfolio', () => {
  it('puts contact details first and roles newest first, leaving hidden items out', () => {
    const made = cv();
    expect(made.contact).toEqual([
      'asha@example.com',
      '+91 98765 43210',
      'Chennai, India',
      'linkedin.com/in/asha',
      'github.com/asha',
      'asha.example.dev',
    ]);
    expect(made.experience.map((role) => role.heading)).toEqual([
      'Senior Engineer',
      'Software Engineer',
    ]);
    expect(made.experience[0]).toMatchObject({
      subheading: 'Fintech Ltd, Client: Big Bank | Remote',
      dates: 'Jan 2022 – Present',
      line: 'Technologies: TypeScript, React Native, PostgreSQL',
    });
    expect(made.experience[1].dates).toBe('Jun 2017 – Dec 2021');
    expect(made.summary).toMatch(/^Full-stack engineer with 8 years/);
  });

  it('groups skills by area, with ungrouped ones under Other', () => {
    expect(cv().skills).toEqual([
      { label: 'Frontend', items: ['TypeScript', 'React', 'React Native', 'Next.js'] },
      { label: 'Backend', items: ['Node.js', 'PostgreSQL', 'Supabase', 'AWS'] },
      { label: 'Other', items: ['Docker'] },
    ]);
  });

  it('splits education from certifications and names the file after the person', () => {
    const made = cv();
    expect(made.education[0]).toMatchObject({
      heading: 'B.E. Computer Science',
      subheading: 'Anna University | Grade: 8.4 CGPA',
      dates: 'Jun 2013 – May 2017',
    });
    expect(made.certifications[0]).toMatchObject({ heading: 'AWS Developer', dates: 'Mar 2023' });
    expect(cvFileName(made, 'pdf')).toBe('Asha-Kumar-CV.pdf');
    expect(cvFileName({ ...made, name: '' }, 'docx')).toBe('CV.docx');
  });

  it('writes standard section headings in the usual order', () => {
    const headings = cvPlainText(cv())
      .split('\n')
      .filter((line) => line === line.toUpperCase() && /^[A-Z ]{5,}$/.test(line));
    expect(headings).toEqual([
      'PROFESSIONAL SUMMARY',
      'SKILLS',
      'WORK EXPERIENCE',
      'PROJECTS',
      'EDUCATION',
      'CERTIFICATIONS',
    ]);
  });
});

describe('ATS check', () => {
  it('passes a complete CV and flags what an empty one lacks', () => {
    const report = atsReport(cv());
    expect(report.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual(['length']);
    expect(report.score).toBe(95);
    const empty = atsReport(
      buildCv({
        ...fixtureSite(),
        profile: null,
        rows: { ...fixtureSite().rows, experience: [], skill: [] },
      }),
    );
    expect(empty.checks.find((check) => check.id === 'roles')?.ok).toBe(false);
    expect(empty.score).toBeLessThan(60);
  });

  it('matches the keywords of a job description', () => {
    const job =
      'We are hiring a Senior Engineer. You will use React Native, TypeScript and GraphQL ' +
      'daily, deploy on AWS with Kubernetes, and work with PostgreSQL. GraphQL experience is a must.';
    expect(atsKeywords(job)).toEqual(
      expect.arrayContaining([
        'react',
        'native',
        'typescript',
        'graphql',
        'aws',
        'kubernetes',
        'postgresql',
      ]),
    );
    expect(atsKeywords(job)).not.toContain('experience');
    const report = atsReport(cv(), job);
    expect(report.keywords?.missing).toEqual(expect.arrayContaining(['graphql', 'kubernetes']));
    expect(report.keywords?.matched).toEqual(expect.arrayContaining(['typescript', 'aws']));
    expect(report.score).toBeLessThan(atsReport(cv()).score);
  });
});

describe('files', () => {
  it('writes a PDF with real text, a correct cross-reference table and no lost dates', () => {
    const pdf = latin1(cvPdf(cv()));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('(Senior Engineer) Tj /F1 10 Tf ( | Jan 2022 \x96 Present) Tj');
    const xref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    const offsets = pdf.slice(xref).match(/^\d{10} 00000 n/gm) ?? [];
    offsets.forEach((entry, index) => {
      expect(pdf.slice(Number(entry.slice(0, 10))).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });

  it('flows onto more pages when the content is long', () => {
    const long = cv();
    long.experience = Array.from({ length: 12 }, () => long.experience[0]);
    expect(latin1(cvPdf(long)).match(/\/Type \/Page /g)?.length).toBeGreaterThan(1);
  });

  it('writes a Word file whose text an ATS can read', async () => {
    const files = await readZipEntries(
      cvDocx(cv()),
      ['word/document.xml', '[Content_Types].xml'],
      async (data) => data,
    );
    const document = new TextDecoder().decode(files.get('word/document.xml'));
    expect(document).toContain('<w:t xml:space="preserve">Senior Engineer</w:t>');
    expect(document).toContain('Fintech Ltd, Client: Big Bank | Remote');
    expect(files.has('[Content_Types].xml')).toBe(true);
  });
});

describe('text helpers', () => {
  it('cleans Markdown, dates, links and characters the PDF fonts lack', () => {
    expect(plainText('**Bold** and [a link](https://x.y) - item\n> quote')).toBe(
      'Bold and a link - item quote',
    );
    expect(dateRange('2024-03-01', null)).toBe('Mar 2024 – Present');
    expect(dateRange(null, null)).toBe('');
    expect(displayUrl('https://www.linkedin.com/in/me/')).toBe('linkedin.com/in/me');
    expect(firstSentences('One two. Three four five. Six.', 4)).toBe('One two.');
    expect(toWinAnsi('₹500 → café “ok” தமிழ்')).toBe('Rs. 500 -> café \x93ok\x94 ');
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});
