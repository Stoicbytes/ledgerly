import type { ReactNode } from 'react';
import { Link } from '../app/router';
import { Arrow, LockGlyph } from '../components/Glyphs';

/** Full-page states: nothing published yet, not configured, offline, not found, preview problems. */
export function StatusPage({
  code,
  title,
  children,
  home,
  dashboardUrl,
}: {
  code: string;
  title: string;
  children?: ReactNode;
  home?: boolean;
  /** Shown while there is no portfolio to see, so the owner can get to the dashboard. */
  dashboardUrl?: string | null;
}) {
  return (
    <section className="status-page" aria-labelledby="status-title">
      <div className="status-page__grid" aria-hidden="true" />
      <div className="container status-page__inner">
        <p className="mono faint">{code}</p>
        <h1 className="status-page__title" id="status-title">
          {title}
        </h1>
        {children ? <div className="status-page__body">{children}</div> : null}
        {home ? (
          <Link className="btn btn--ghost" href="/">
            <Arrow direction="left" /> Back to the start
          </Link>
        ) : null}
        {dashboardUrl ? (
          <a className="btn btn--ghost" href={dashboardUrl} rel="nofollow">
            <LockGlyph /> Dashboard
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function PreviewBanner({ expiresAt }: { expiresAt: string | null }) {
  const time = expiresAt
    ? new Date(expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <div className="preview-banner" role="note">
      <span className="badge badge--draft">Preview</span>
      <span>
        Not published. Visitors can&apos;t see this page; drafts are outlined.
        {time ? ` Link valid until ${time}.` : ''}
      </span>
    </div>
  );
}
