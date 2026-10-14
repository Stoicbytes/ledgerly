/**
 * Email addresses, as the database's valid_email(): letters, digits and . _ + - before
 * the @, a plain domain after it. Nothing that could add parameters to a mailto: link.
 */
export const EMAIL_PATTERN = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,63}$/;

/**
 * A mailto: link that replies to `email` with `subject`. The address is percent-encoded
 * (the @ stays readable), so an address saved before the stricter rule still cannot
 * add its own ?cc=, &body= or other parameters.
 */
export function replyMailto(email: string, subject: string): string {
  const to = encodeURIComponent(email.trim()).replace(/%40/g, '@');
  return `mailto:${to}?subject=${encodeURIComponent(subject)}`;
}
