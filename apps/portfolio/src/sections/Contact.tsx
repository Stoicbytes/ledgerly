import { useState } from 'react';
import { Arrow } from '../components/Glyphs';
import { Reveal, SplitWords } from '../components/Motion';
import type { SiteConfig } from '../lib/config';
import type { PortfolioDocument } from '../lib/types';
import { Availability } from './Availability';
import { ContactForm } from './ContactForm';

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable: the address is still a mailto link.
    }
  };
  return (
    <button type="button" className="chip" onClick={copy} aria-live="polite">
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function Contact({
  document: doc,
  config,
  index,
  preview,
}: {
  document: PortfolioDocument;
  config: SiteConfig | null;
  index: number;
  preview: boolean;
}) {
  const { profile } = doc;
  return (
    <section className="page-section contact" id="contact" aria-labelledby="contact-title">
      <div className="container contact__grid">
        <div className="contact__intro">
          <Reveal as="p" className="section-head__index mono">
            {String(index).padStart(2, '0')} — Contact
          </Reveal>
          <h2 className="contact__title" id="contact-title">
            <SplitWords text="Let's build" /> <em className="serif">something good.</em>
          </h2>
          <Reveal as="p" className="contact__lead" index={1}>
            Have a role, a project or a question? Send a message here or use the links below.
          </Reveal>
          {profile.email ? (
            <Reveal className="contact__email" index={2}>
              <a className="link" href={`mailto:${profile.email}`}>
                {profile.email}
              </a>
              <CopyEmail email={profile.email} />
            </Reveal>
          ) : null}
          <Reveal index={3}>
            <Availability profile={profile} />
          </Reveal>
          {doc.links.length ? (
            <Reveal as="ul" role="list" className="contact__links" index={4}>
              {doc.links.map((link) => (
                <li key={link.id}>
                  <a
                    className="link link--muted"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                  >
                    {link.label} <Arrow direction="out" size={14} />
                  </a>
                </li>
              ))}
            </Reveal>
          ) : null}
        </div>
        <Reveal index={2} className="contact__form">
          <ContactForm
            config={config}
            disabledReason={
              preview
                ? 'This is a preview: messages can only be sent from the published site.'
                : undefined
            }
          />
        </Reveal>
      </div>
    </section>
  );
}
