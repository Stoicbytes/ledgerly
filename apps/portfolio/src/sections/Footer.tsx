import { Link, useRouter } from '../app/router';
import type { SectionInfo } from '../app/sections';
import { Arrow } from '../components/Glyphs';
import { fullDate } from '../lib/format';
import type { PortfolioDocument } from '../lib/types';
import { Availability } from './Availability';

export function Footer({
  document: doc,
  sections,
  today,
}: {
  document: PortfolioDocument;
  sections: SectionInfo[];
  today: string;
}) {
  const { path } = useRouter();
  const href = (id: string) => (path === '/' ? `#${id}` : `/#${id}`);
  return (
    <footer className="site-footer">
      <div className="container">
        <p className="site-footer__wordmark" aria-hidden="true">
          {doc.profile.name}
        </p>
        <div className="site-footer__row">
          <nav aria-label="Footer">
            <ul role="list" className="site-footer__nav">
              {sections.map((section) => (
                <li key={section.id}>
                  <Link className="link link--muted" href={href(section.id)}>
                    {section.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {doc.links.length ? (
            <ul role="list" className="site-footer__nav">
              {doc.links.map((link) => (
                <li key={link.id}>
                  <a
                    className="link link--muted"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                  >
                    {link.label} <Arrow direction="out" size={12} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <Availability profile={doc.profile} />
        </div>
        <p className="site-footer__legal mono faint">
          <span>
            © {today.slice(0, 4)} {doc.profile.name}
          </span>
          {doc.publishedAt && !doc.preview ? (
            <span>Updated {fullDate(doc.publishedAt)}</span>
          ) : null}
          <a className="link link--muted" href="#top">
            Back to top <Arrow direction="right" size={12} />
          </a>
        </p>
      </div>
    </footer>
  );
}
