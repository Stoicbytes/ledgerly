import type { PickedFile } from '@/features/investments/import/pickFiles';
import {
  detectFromRows,
  detectPayslips,
  type DetectedPayslip,
} from '@/lib/domain/salary/payslipImport';

/** What one chosen file gave: payslips, a request for its password, or why it cannot be read. */
export type FileRead =
  | { kind: 'read'; slips: DetectedPayslip[] }
  | { kind: 'password'; wrong: boolean }
  | { kind: 'problem'; message: string };

export const SCANNED = 'This payslip is a scanned image; enter it by hand (Add payslip).';
const UNREADABLE = 'This PDF could not be read. Open it, print it to a new PDF, and import that.';
const NOTHING = 'No payslip figures were found in this file; enter it by hand (Add payslip).';

const isPdf = (file: PickedFile) =>
  /\.pdf$/i.test(file.name) || String.fromCharCode(...file.bytes.subarray(0, 5)) === '%PDF-';
const isImage = (file: PickedFile) =>
  /\.(jpe?g|png|heic|webp)$/i.test(file.name) ||
  (file.bytes[0] === 0xff && file.bytes[1] === 0xd8) ||
  (file.bytes[0] === 0x89 && file.bytes[1] === 0x50);

const found = (slips: DetectedPayslip[]): FileRead =>
  slips.some((slip) => slip.earnings.length || slip.printed.net !== null)
    ? { kind: 'read', slips }
    : { kind: 'problem', message: NOTHING };

async function readPdf(file: PickedFile, password: string): Promise<FileRead> {
  const pdf = await import('@/lib/files/pdfText');
  try {
    const text = await pdf.extractPdfText(file.bytes, {
      inflate: pdf.inflateZlib,
      subtle: globalThis.crypto?.subtle,
      password,
    });
    if (!text.pages.some((page) => page.length)) {
      return { kind: 'problem', message: text.unreadable ? UNREADABLE : SCANNED };
    }
    return found(detectPayslips(text.pages));
  } catch (error) {
    if (error instanceof pdf.PasswordNeeded) return { kind: 'password', wrong: error.wrong };
    if (error instanceof pdf.UnsupportedEncryption) {
      return {
        kind: 'problem',
        message:
          'This PDF is protected in a way the app cannot open. Open it, save or print it as a new PDF, and import that.',
      };
    }
    if (error instanceof pdf.NotPdf) return { kind: 'problem', message: 'This is not a PDF file.' };
    return { kind: 'problem', message: UNREADABLE };
  }
}

/**
 * Reads one payslip file on this device: a PDF (text, not scans), or a CSV / Excel payroll
 * export. Nothing is uploaded or kept; a password is used for this read only.
 */
export async function readPayslipFile(file: PickedFile, password = ''): Promise<FileRead> {
  if (isPdf(file)) return readPdf(file, password);
  if (isImage(file)) return { kind: 'problem', message: SCANNED };
  if (/\.(csv|xlsx)$/i.test(file.name)) {
    const { readSpreadsheet } = await import('@/lib/files/spreadsheet');
    const read = await readSpreadsheet(file.name, file.bytes);
    if ('problem' in read) return { kind: 'problem', message: read.problem };
    return found(detectFromRows(read.rows));
  }
  return { kind: 'problem', message: 'Choose a PDF, CSV or Excel (.xlsx) payslip.' };
}
