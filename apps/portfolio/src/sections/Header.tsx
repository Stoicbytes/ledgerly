import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '../app/router';
import { monogram, type SectionInfo } from '../app/sections';
import { Arrow, LockGlyph } from '../components/Glyphs';
import type { PortfolioDocument } from '../lib/types';
import { Availability } from './Availability';

/** Which section is on screen, for the moving indicator in the navigation. */
function useActiveSection(ids: string[], enabled: boolean): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(',');
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    key.split(',').forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [key, enabled]);
  return enabled ? active : null;
}

export function Header({
  document: doc,
  sections,
  dashboardUrl,
}: {
  document: PortfolioDocument;
  sections: SectionInfo[];
  /** The owner's link to the private dashboard (it asks for sign-in). */
  dashboardUrl: string | null;
}) {
  const { path } = useRouter();
  const onHome = path === '/';
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection(
    sections.map((section) => section.id),
    onHome,
  );
  const navRef = useRef<HTMLUListElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const link = active
      ? navRef.current?.querySelector<HTMLElement>(`a[href$="#${active}"]`)
      : null;
    setIndicator(link ? { left: link.offsetLeft, width: link.offsetWidth } : null);
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.documentElement.classList.add('menu-open');
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('menu-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const href = (id: string) => (onHome ? `#${id}` : `/#${id}`);
  const { profile } = doc;
  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="container site-header__bar">
        <Link className="brand" href="/" aria-label={`${profile.name}, home`}>
          <span className="brand__mark" aria-hidden="true">
            {monogram(profile.name)}
          </span>
          <span className="brand__name">{profile.name}</span>
        </Link>
        <nav className="site-nav" aria-label="Sections">
          <ul ref={navRef} role="list">
            {sections.map((section) => (
              <li key={section.id}>
                <Link
                  href={href(section.id)}
                  aria-current={active === section.id ? 'location' : undefined}
                >
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
          <span
            className="site-nav__indicator"
            aria-hidden="true"
            style={
              indicator
                ? {
                    transform: `translateX(${indicator.left}px)`,
                    width: indicator.width,
                    opacity: 1,
                  }
                : undefined
            }
          />
        </nav>
        <Availability profile={profile} className="site-header__status" />
        {dashboardUrl ? (
          <a className="site-header__dashboard" href={dashboardUrl} rel="nofollow">
            <LockGlyph /> Dashboard
          </a>
        ) : null}
        <button
          ref={menuButton}
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="menu-button__lines" aria-hidden="true" />
          <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
      </div>
      <div id="mobile-menu" className="mobile-menu" hidden={!open}>
        <nav aria-label="Sections" className="container">
          <ol role="list" className="mobile-menu__list">
            {sections.map((section, index) => (
              <li key={section.id} style={{ '--i': index } as React.CSSProperties}>
                <Link href={href(section.id)} onClick={() => setOpen(false)}>
                  <span className="mono faint">{String(index + 1).padStart(2, '0')}</span>
                  {section.label}
                  <Arrow direction="right" size={22} />
                </Link>
              </li>
            ))}
          </ol>
          <ul role="list" className="mobile-menu__links">
            {doc.links.map((link) => (
              <li key={link.id}>
                <a
                  className="link link--muted"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label} <Arrow direction="out" size={14} />
                </a>
              </li>
            ))}
          </ul>
          <Availability profile={profile} />
          {dashboardUrl ? (
            <a className="mobile-menu__dashboard" href={dashboardUrl} rel="nofollow">
              <LockGlyph /> Dashboard <span className="faint">· sign in</span>
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
