/**
 * Text for the PDF's standard fonts, which use Windows-1252 (WinAnsi): Latin letters with
 * accents, quotes, dashes and bullets. Other characters get a close stand-in (₹ → Rs.) or
 * are left out, so the PDF never shows boxes and its text stays readable by an ATS.
 */
const HIGH: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};
const STAND_IN: Record<string, string> = {
  '₹': 'Rs. ',
  '→': '->',
  '←': '<-',
  '−': '-',
  '≥': '>=',
  '≤': '<=',
  '≈': '~',
  '✓': '',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  '‑': '-',
  '‒': '-',
  '―': '-',
};

/** Windows-1252 codes for the text (as a string of 8-bit characters). */
export function toWinAnsi(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63;
    if (code >= 32 && code < 127) out += char;
    else if (HIGH[char] !== undefined) out += String.fromCharCode(HIGH[char]);
    else if (code >= 160 && code <= 255) out += char;
    else if (STAND_IN[char] !== undefined) out += STAND_IN[char];
    else {
      // "ā" → "a"; anything without a Latin form is left out.
      const plain = char.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      if ([...plain].every((part) => part.charCodeAt(0) >= 32 && part.charCodeAt(0) < 256)) {
        out += plain;
      }
    }
  }
  return out;
}
