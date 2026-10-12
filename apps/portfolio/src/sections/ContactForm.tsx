import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Arrow } from '../components/Glyphs';
import { sendMessage, type ContactResult } from '../lib/api';
import type { SiteConfig } from '../lib/config';

/**
 * The contact form. The same rules are checked again on the server, which also limits
 * how often one visitor can send and quietly drops what bots fill in.
 */
type Fields = { name: string; email: string; message: string };
type Status = 'idle' | 'sending' | ContactResult | 'network';

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const MESSAGE_MAX = 4000;

function validate(fields: Fields): Partial<Record<keyof Fields, string>> {
  const errors: Partial<Record<keyof Fields, string>> = {};
  if (!fields.name.trim()) errors.name = 'Please add your name.';
  else if (fields.name.trim().length > 100)
    errors.name = 'Please keep your name under 100 characters.';
  if (!EMAIL.test(fields.email.trim()) || fields.email.trim().length > 254)
    errors.email = 'Please enter an email address I can reply to.';
  if (fields.message.trim().length < 10)
    errors.message = 'A few more words, please (at least 10 characters).';
  else if (fields.message.length > MESSAGE_MAX)
    errors.message = `Please keep it under ${MESSAGE_MAX} characters.`;
  return errors;
}

const RESULT_TEXT: Partial<Record<Status, string>> = {
  limited: 'Too many messages from your connection just now. Please try again in a few minutes.',
  invalid: 'The message could not be sent as written. Please check the fields and try again.',
  closed: 'The contact form is closed right now.',
  network: 'The message could not be sent (connection problem). Please try again.',
};

export function ContactForm({
  config,
  disabledReason,
}: {
  config: SiteConfig | null;
  disabledReason?: string;
}) {
  const [fields, setFields] = useState<Fields>({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [status, setStatus] = useState<Status>('idle');
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);
  const trap = useRef<HTMLInputElement>(null);
  const disabled = Boolean(disabledReason) || !config;

  const set = (key: keyof Fields) => (event: { target: { value: string } }) => {
    setFields((current) => ({ ...current, [key]: event.target.value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || status === 'sending') return;
    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0];
      document.getElementById(`contact-${first}`)?.focus();
      return;
    }
    setStatus('sending');
    try {
      const result = await sendMessage(config!, {
        name: fields.name.trim(),
        email: fields.email.trim(),
        message: fields.message.trim(),
        trap: trap.current?.value ?? '',
        elapsedMs: Date.now() - started.current,
      });
      setStatus(result);
      if (result === 'sent') setFields({ name: '', email: '', message: '' });
    } catch {
      setStatus('network');
    }
  }

  if (status === 'sent') {
    return (
      <div className="contact-form contact-form--sent" role="status">
        <p className="contact-form__sent-title">Thank you, message sent.</p>
        <p className="muted">Any reply will come to the email address you gave.</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus('idle')}>
          Send another
        </button>
      </div>
    );
  }

  const field = (key: keyof Fields, label: string, input: React.ReactNode) => (
    <div className={`field${errors[key] ? ' has-error' : ''}`}>
      <label htmlFor={`contact-${key}`}>{label}</label>
      {input}
      {errors[key] ? (
        <p className="field__error" id={`contact-${key}-error`}>
          {errors[key]}
        </p>
      ) : null}
    </div>
  );
  const describe = (key: keyof Fields) => (errors[key] ? `contact-${key}-error` : undefined);

  return (
    <form
      className="contact-form"
      onSubmit={submit}
      noValidate
      aria-describedby={disabledReason ? 'contact-disabled' : undefined}
    >
      {disabledReason ? (
        <p className="contact-form__note" id="contact-disabled">
          {disabledReason}
        </p>
      ) : null}
      <div className="contact-form__row">
        {field(
          'name',
          'Name',
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            value={fields.name}
            onChange={set('name')}
            maxLength={100}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describe('name')}
            disabled={disabled}
          />,
        )}
        {field(
          'email',
          'Email',
          <input
            id="contact-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={fields.email}
            onChange={set('email')}
            maxLength={254}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describe('email')}
            disabled={disabled}
          />,
        )}
      </div>
      {field(
        'message',
        'Message',
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          value={fields.message}
          onChange={set('message')}
          maxLength={MESSAGE_MAX}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describe('message')}
          disabled={disabled}
        />,
      )}
      <div className="contact-form__trap" aria-hidden="true">
        <label htmlFor="contact-website">Leave this empty</label>
        <input ref={trap} id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="contact-form__foot">
        <span className="mono faint" aria-live="polite">
          {fields.message.length > MESSAGE_MAX - 400
            ? `${MESSAGE_MAX - fields.message.length} characters left`
            : ''}
        </span>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={disabled || status === 'sending'}
        >
          {status === 'sending' ? 'Sending…' : 'Send message'} <Arrow />
        </button>
      </div>
      {RESULT_TEXT[status] ? (
        <p className="contact-form__error" role="alert">
          {RESULT_TEXT[status]}
        </p>
      ) : null}
    </form>
  );
}
