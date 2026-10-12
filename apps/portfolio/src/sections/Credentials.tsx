import { Arrow } from '../components/Glyphs';
import { Img } from '../components/Img';
import { Reveal, SectionHead } from '../components/Motion';
import type { SiteConfig } from '../lib/config';
import { fullDate, monthYear, year } from '../lib/format';
import type { Credential } from '../lib/types';

const GROUPS: { kind: Credential['kind']; label: string }[] = [
  { kind: 'degree', label: 'Education' },
  { kind: 'certification', label: 'Certifications' },
  { kind: 'course', label: 'Courses' },
  { kind: 'award', label: 'Awards' },
];

const initials = (text: string) =>
  text
    .split(/[\s:-]+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

function when(item: Credential): string {
  if (item.kind === 'degree' && item.start)
    return `${year(item.start)} — ${item.end ? year(item.end) : 'Present'}`;
  if (item.issued) return monthYear(item.issued);
  return item.end ? monthYear(item.end) : '';
}

function Row({
  item,
  config,
  index,
}: {
  item: Credential;
  config: SiteConfig | null;
  index: number;
}) {
  const meta = [item.issuer, when(item), item.grade].filter(Boolean);
  return (
    <Reveal as="li" index={index} className={`cred${item.draft ? ' draft-outline' : ''}`}>
      {item.image ? (
        <Img media={item.image} config={config} sizes="56px" className="cred__image" />
      ) : (
        <span className="cred__mark mono" aria-hidden="true">
          {initials(item.issuer || item.title)}
        </span>
      )}
      <div className="cred__body">
        <h4 className="cred__title">{item.title}</h4>
        <p className="cred__meta">
          {meta.map((part, i) => (
            <span key={i}>{part}</span>
          ))}
        </p>
        {item.description ? <p className="cred__desc">{item.description}</p> : null}
        {item.expires ? (
          <p className="cred__expiry mono faint">Valid until {fullDate(item.expires)}</p>
        ) : null}
      </div>
      {item.url ? (
        <a
          className="link link--muted cred__verify"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Verify<span className="visually-hidden"> {item.title}</span>{' '}
          <Arrow direction="out" size={14} />
        </a>
      ) : null}
    </Reveal>
  );
}

export function Credentials({
  items,
  config,
  index,
}: {
  items: Credential[];
  config: SiteConfig | null;
  index: number;
}) {
  return (
    <section className="page-section" id="credentials" aria-labelledby="credentials-title">
      <div className="container">
        <SectionHead
          index={index}
          label="Credentials"
          id="credentials-title"
          title={
            <>
              Education &amp; <em>certifications</em>
            </>
          }
        />
        <div className="credentials">
          {GROUPS.map((group) => {
            const list = items.filter((item) => item.kind === group.kind);
            if (!list.length) return null;
            return (
              <div key={group.kind} className="cred-group">
                <h3 className="cred-group__title mono">
                  {group.label} <span className="faint">{list.length}</span>
                </h3>
                <ul role="list" className="cred-group__list">
                  {list.map((item, i) => (
                    <Row key={item.id} item={item} config={config} index={i} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
