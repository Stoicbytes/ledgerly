/** Six digits from an authenticator app; spaces are allowed while typing ("123 456"). */
export const cleanCode = (text: string) => text.replace(/\s+/g, '');
export const isSixDigits = (code: string) => /^\d{6}$/.test(code);
