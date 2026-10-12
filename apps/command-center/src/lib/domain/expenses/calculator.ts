/**
 * Amount fields accept simple sums, like a calculator: "120+45", "1,200 - 150",
 * "450/3", "2×199". Only numbers (up to two decimals), + − × ÷ and brackets; no code
 * is ever evaluated. The result is rounded to the paisa.
 */
const OPERATORS = /[+\-*/×÷x()]/;

/** Whether the text is a sum rather than a plain amount. */
export const isExpression = (input: string): boolean => OPERATORS.test(input.replace(/^\s*-/, ''));

/** The amount in paise (plain amount or sum), or null when it is not valid or below zero. */
export function evaluateAmount(input: string): number | null {
  const tokens = tokenize(input);
  if (!tokens) return null;
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];

  // Values are in paise; products and quotients are divided back down as needed.
  function expression(): number | null {
    let value = term();
    while (value !== null && (peek() === '+' || peek() === '-')) {
      const operator = take();
      const right = term();
      if (right === null) return null;
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }
  function term(): number | null {
    let value = factor();
    while (value !== null && (peek() === '*' || peek() === '/')) {
      const operator = take();
      const right = factor();
      if (right === null) return null;
      if (operator === '*') value = (value * right) / 100;
      else if (right === 0) return null;
      else value = (value / right) * 100;
    }
    return value;
  }
  function factor(): number | null {
    const token = take();
    if (token === '-') {
      const value = factor();
      return value === null ? null : -value;
    }
    if (token === '(') {
      const value = expression();
      return take() === ')' ? value : null;
    }
    return typeof token === 'number' ? token : null;
  }

  const result = expression();
  if (result === null || index !== tokens.length || !Number.isFinite(result)) return null;
  const paise = Math.round(result + Number.EPSILON * Math.abs(result));
  return paise >= 0 && Number.isSafeInteger(paise) ? paise : null;
}

type Token = number | '+' | '-' | '*' | '/' | '(' | ')';

function tokenize(input: string): Token[] | null {
  const text = input
    .replace(/[₹,\s]/g, '')
    .replace(/[×x]/g, '*')
    .replace(/÷/g, '/');
  if (!text || text.length > 100) return null;
  const tokens: Token[] = [];
  const pattern = /(\d+(?:\.\d{0,2})?)|([+\-*/()])/y;
  while (pattern.lastIndex < text.length) {
    const match = pattern.exec(text);
    if (!match) return null;
    if (match[1] !== undefined) {
      const [rupees, fraction = ''] = match[1].split('.');
      const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
      if (!Number.isSafeInteger(paise)) return null;
      tokens.push(paise);
    } else tokens.push(match[2] as Token);
  }
  return tokens;
}
