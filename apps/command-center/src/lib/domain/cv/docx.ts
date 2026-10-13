import { writeZip } from '@/lib/files/zipWrite';
import { cvLines, type CvLine } from './layout';
import type { Cv } from './types';

/**
 * The CV as a Word document (.docx): one column, Calibri, real headings, dates beside each
 * title (no tables, tab stops or text boxes). Many ATS read Word files best, and it can be edited.
 */
const xml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Characters XML 1.0 does not allow.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** A run of text; `size` in points. */
const run = (text: string, size: number, bold = false) =>
  `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size * 2}"/></w:rPr>` +
  `<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;

/** A paragraph: spacing before/after in points, optional indent, heading style and rule. */
const para = (
  runs: string,
  { before = 0, after = 2, indent = '', heading = false, border = false } = {},
) =>
  `<w:p><w:pPr>${heading ? '<w:pStyle w:val="Heading1"/><w:keepNext/>' : ''}` +
  (border
    ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>'
    : '') +
  `<w:spacing w:before="${before * 20}" w:after="${after * 20}"/>${indent}</w:pPr>${runs}</w:p>`;

function paragraph(line: CvLine): string {
  switch (line.kind) {
    case 'name':
      return para(run(line.text, 20, true), { after: 2 });
    case 'title':
      return para(run(line.text, 12), { after: 2 });
    case 'contact':
      return para(run(line.text, 10), { after: 4 });
    case 'heading':
      return para(run(line.text.toUpperCase(), 12, true), {
        before: 10,
        after: 4,
        heading: true,
        border: true,
      });
    case 'entry':
      return para(run(line.text, 11, true) + (line.dates ? run(` | ${line.dates}`, 10) : ''), {
        before: 6,
        after: 0,
      });
    case 'sub':
      return para(run(line.text, 10), { after: 2 });
    case 'bullet':
      return para(run(`•\t${line.text}`, 10), {
        after: 1,
        indent: '<w:ind w:left="360" w:hanging="240"/>',
      });
    case 'label':
      return para(run(`${line.label}: `, 10, true) + run(line.text, 10), { after: 1 });
    default:
      return para(run(line.text, 10), { after: 2 });
  }
}

const NS = 'http://schemas.openxmlformats.org';

/** .docx bytes for the CV. */
export function cvDocx(cv: Cv): Uint8Array {
  const body = cvLines(cv).map(paragraph).join('');
  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document xmlns:w="${NS}/wordprocessingml/2006/main"><w:body>${body}` +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="851" w:right="851" w:bottom="851" w:left="851" w:header="0" w:footer="0" w:gutter="0"/>' +
    '</w:sectPr></w:body></w:document>';
  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:styles xmlns:w="${NS}/wordprocessingml/2006/main">` +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' +
    '<w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>' +
    '<w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>' +
    '</w:styles>';
  const title = xml(cv.name ? `${cv.name} - CV` : 'CV');
  return writeZip([
    {
      name: '[Content_Types].xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Types xmlns="${NS}/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Relationships xmlns="${NS}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
        `<Relationship Id="rId2" Type="${NS}/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
        '</Relationships>',
    },
    {
      name: 'word/_rels/document.xml.rels',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Relationships xmlns="${NS}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: styles },
    {
      name: 'docProps/core.xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<cp:coreProperties xmlns:cp="${NS}/package/2006/metadata/core-properties" ` +
        'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
        `<dc:title>${title}</dc:title><dc:creator>${xml(cv.name)}</dc:creator>` +
        '</cp:coreProperties>',
    },
  ]);
}
