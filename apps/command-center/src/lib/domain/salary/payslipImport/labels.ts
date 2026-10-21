/**
 * What a printed payslip label means. Payroll systems word things differently ("Provident
 * Fund", "EPF", "PF - Employee"), so labels are matched on words, after lower-casing and
 * turning punctuation into spaces ("A/c No." → "a c no").
 */
export type Section = 'earnings' | 'deductions' | 'employer' | 'skip';

export type LabelKind =
  | 'identity'
  | 'info'
  | 'gross'
  | 'totalDeductions'
  | 'net'
  | 'employerEpf'
  | 'employerEps'
  | 'employerOther'
  | 'vpf'
  | 'epfEmployee'
  | 'tds'
  | 'earning'
  | 'deduction'
  | 'unknown';

export const normaliseLabel = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Identity numbers and personal details: never read into a payslip, and their lines never
 * become pay lines. (The app asks for and keeps no UAN, member ID, PAN or similar.)
 */
const IDENTITY =
  /\b(uan|pan|aadhaa?r|ifsc|micr|pran|passport|esic? (no|number|ip)|ip (no|number)|(e ?pf|pf) (no|number|ac|a c|account|member)|member id|account (no|number)|ac no|a c no|bank ac|bank a c|bank account|employee (id|code|no|number)|emp (id|code|no)|empid|address|dob|date of birth|mobile|phone|email|e mail)\b/;
/** Numbers that are not money, or not this month's pay. */
const INFO =
  /\b(days?|hours?|attendance|leave balance|balance|pf wages?|esi wages?|wage ceiling|ctc|cost to company|per annum|regime|taxable|exempt|exemption|80c|80d|section|projected|standard deduction|rebate|cess|surcharge|tax payable|perquisite)\b/;

const GROSS =
  /^(total )?gross( earnings?| salary| pay| wages| income| amount)?$|^total (earnings?|salary|pay|wages|income)$|^(earnings|salary|pay) total$/;
const TOTAL_DEDUCTIONS = /^(total|gross) deductions?$|^deductions? total$/;
const NET =
  /\bnet (pay|salary|amount|payable|earnings|wages|take home|pay out|payout|paid)\b|^net$|take home|amount credited|credited amount|credited to bank|amount paid|salary credited|in hand/;
const EMPLOYER =
  /\b(employer|employers|er|company|companys) (contribution|share|pf|epf|eps|esi|esic|nps|pension)|\b(employer|er|company)\b/;
const PF = /\b(e ?pf|pf|provident fund|provident)\b/;
const PENSION = /\b(eps|pension|employee pension scheme)\b/;
const NPS = /\b(nps|national pension)\b/;
const VPF = /\b(vpf|voluntary (pf|provident))\b/;
const TDS = /\b(tds|income tax|i ?tax|it|tax deducted at source)\b|^tax$/;
const PROFESSIONAL = /\b(professional|prof|pt|p tax)\b/;

const EARNING_HINT =
  /\b(basic|hra|house rent|allowance|conveyance|transport|lta|leave travel|medical|bonus|overtime|ot|arrears?|incentive|commission|special|reimbursement|stipend|encashment|dearness|da|variable|performance|shift|gratuity|wfh)\b/;
const DEDUCTION_HINT =
  /\b(professional tax|prof tax|pt|esi|esic|lwf|labour welfare|insurance|mediclaim|loan|advance|recovery|meal|canteen|coupons?|nps|deductions?|lop|loss of pay|fine|penalty|union|donation|charity)\b/;

export const isIdentityLabel = (label: string) => IDENTITY.test(normaliseLabel(label));

/**
 * The kind of a printed line. `section` is where it was printed (under Earnings, on the
 * Deductions side…) when the layout says so; `guessed` is true when only the words placed it.
 */
export function classifyLabel(
  label: string,
  section: Section | null,
): { kind: LabelKind; guessed: boolean } {
  const text = normaliseLabel(label);
  const sure = (kind: LabelKind) => ({ kind, guessed: false });
  if (!text || IDENTITY.test(text)) return sure('identity');
  if (INFO.test(text) && !/encash/.test(text)) return sure('info');
  if (section === 'skip') return sure('info');
  if (TOTAL_DEDUCTIONS.test(text)) return sure('totalDeductions');
  if (GROSS.test(text)) return sure('gross');
  if (NET.test(text)) return sure('net');
  if (text === 'total') {
    if (section === 'earnings') return sure('gross');
    if (section === 'deductions') return sure('totalDeductions');
    return sure('unknown');
  }
  const employer = section === 'employer' || EMPLOYER.test(text);
  if (employer) {
    if (PENSION.test(text) && !NPS.test(text)) return sure('employerEps');
    if (PF.test(text)) return sure('employerEpf');
    return sure('employerOther');
  }
  if (PENSION.test(text) && !NPS.test(text)) return sure('employerEps');
  if (VPF.test(text)) return sure('vpf');
  if (PF.test(text)) return sure(section === 'earnings' ? 'employerOther' : 'epfEmployee');
  if (TDS.test(text) && !PROFESSIONAL.test(text)) return sure('tds');
  if (section === 'earnings') return sure('earning');
  if (section === 'deductions') return sure('deduction');
  if (DEDUCTION_HINT.test(text)) return { kind: 'deduction', guessed: true };
  if (EARNING_HINT.test(text)) return { kind: 'earning', guessed: true };
  return sure('unknown');
}

/** A heading that starts a part of the payslip, or null. */
export function headingSection(text: string): Section | null {
  const t = normaliseLabel(text);
  if (
    /tax (computation|calculation|working|projection|details)|form 16|declaration|investments?|perquisites|leave (details|balance)|attendance|loan (details|summary)/.test(
      t,
    )
  ) {
    return 'skip';
  }
  if (/^(employer|employers|company) contributions?\b|^contributions? by (the )?employer/.test(t))
    return 'employer';
  if (/^earnings?\b|^(income|salary|pay) (details|components|heads?)$/.test(t)) return 'earnings';
  if (/^deductions?\b|^recoveries\b/.test(t)) return 'deductions';
  return null;
}
