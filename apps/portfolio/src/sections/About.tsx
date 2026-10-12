import { Arrow } from '../components/Glyphs';
import { Img } from '../components/Img';
import { Markdown } from '../components/Markdown';
import { Reveal, SectionHead } from '../components/Motion';
import { mediaUrl, type SiteConfig } from '../lib/config';
import { fileSize } from '../lib/format';
import type { PortfolioDocument } from '../lib/types';

export function About({
  document: doc,
  config,
  index,
}: {
  document: PortfolioDocument;
  config: SiteConfig | null;
  index: number;
}) {
  const { profile } = doc;
  const highlights = doc.facts.filter((fact) => fact.kind === 'highlight');
  const milestones = doc.facts.filter((fact) => fact.kind === 'milestone');
  const resumeUrl = profile.resume
    ? `${mediaUrl(config, profile.resume.path)}?download=${encodeURIComponent(profile.resume.name)}`
    : '';
  return (
    <section className="page-section" id="about" aria-labelledby="about-title">
      <div className="container">
        <SectionHead
          index={index}
          label="About"
          id="about-title"
          title={
            <>
              A bit <em>about me</em>
            </>
          }
        />
        <div className={`about${profile.avatar ? '' : ' about--text-only'}`}>
          {profile.avatar ? (
            <Reveal className="about__portrait" variant="scale">
              <Img media={profile.avatar} config={config} sizes="(min-width: 900px) 420px, 88vw" />
              <span className="about__frame" aria-hidden="true" />
            </Reveal>
          ) : null}
          <div className="about__text">
            <Reveal>
              <Markdown source={profile.about} className="prose prose--lead" />
            </Reveal>
            {profile.resume ? (
              <Reveal className="about__actions" index={1}>
                <a
                  className="btn btn--ghost"
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download résumé
                  <span className="mono faint">
                    PDF{profile.resume.size ? ` · ${fileSize(profile.resume.size)}` : ''}
                  </span>
                  <Arrow direction="down" />
                </a>
              </Reveal>
            ) : null}
          </div>
        </div>
        {highlights.length ? (
          <ul role="list" className="highlights">
            {highlights.map((item, i) => (
              <Reveal
                as="li"
                key={item.id}
                index={i}
                className={`highlight${item.draft ? ' draft-outline' : ''}`}
              >
                <span className="highlight__index mono">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="highlight__title">{item.label}</h3>
                {item.detail ? <p className="highlight__detail">{item.detail}</p> : null}
              </Reveal>
            ))}
          </ul>
        ) : null}
        {milestones.length ? (
          <div className="milestones">
            <h3 className="milestones__title mono">Milestones</h3>
            <ol role="list" className="milestones__list">
              {milestones.map((item, i) => (
                <Reveal
                  as="li"
                  key={item.id}
                  index={i}
                  className={`milestone${item.draft ? ' draft-outline' : ''}`}
                >
                  <span className="milestone__when mono">{item.when}</span>
                  <span className="milestone__dot" aria-hidden="true" />
                  <strong className="milestone__label">{item.label}</strong>
                  {item.detail ? <span className="milestone__detail">{item.detail}</span> : null}
                </Reveal>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
