import { EMAIL_PATTERN, replyMailto } from '../mailto';

describe('replyMailto', () => {
  it('keeps a normal address readable and encodes the subject', () => {
    expect(replyMailto('visitor@example.com', 'Re: your message')).toBe(
      'mailto:visitor@example.com?subject=Re%3A%20your%20message',
    );
  });

  it('cannot be given extra parameters by the address', () => {
    const link = replyMailto('a@b.com?cc=x@y.com&body=hi', 'Re');
    expect(link).toBe('mailto:a@b.com%3Fcc%3Dx@y.com%26body%3Dhi?subject=Re');
    expect(link.split('?')).toHaveLength(2);
    expect(link).not.toContain('&');
  });
});

describe('EMAIL_PATTERN', () => {
  it('matches the database rule', () => {
    expect(EMAIL_PATTERN.test('first.last+tag@mail.example.org')).toBe(true);
    for (const bad of ['a@b', 'a b@c.com', 'a@b.com?cc=x', 'a&b@c.com', 'a%40b@c.com', 'a/b@c.com'])
      expect(EMAIL_PATTERN.test(bad)).toBe(false);
  });
});
