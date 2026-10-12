/** Client-side check before asking Supabase; the project's Auth settings are the authority. */
export const MIN_PASSWORD_LENGTH = 12;

export function newPasswordError(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 200) return 'Use at most 200 characters.';
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}
