const HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** For text and attribute values written into the page's <head>. */
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => HTML[ch] ?? ch);

/** JSON inside a <script> block: nothing in it can close the tag or start a comment. */
export const jsonForScript = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
