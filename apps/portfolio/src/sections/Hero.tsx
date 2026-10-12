import { useMemo } from 'react';
import { splitName, type SectionInfo } from '../app/sections';
import { Arrow } from '../components/Glyphs';
import { Markdown } from '../components/Markdown';
import { CountUp, Reveal, RotatingWords, SplitWords } from '../components/Motion';
import { pickSkills } from '../lib/field';
import type { PortfolioDocument } from '../lib/types';
import { SignalField } from './SignalField';

export function Hero({
  document: doc,
  sections,
}: {
  document: PortfolioDocument;
  sections: SectionInfo[];
}) {
  const { profile } = doc;
  const [first, last] = splitName(profile.name);
  const stats = doc.facts.filter((fact) => fact.kind === 'stat' && fact.value !== null);
  const skills = useMemo(() => pickSkills(doc.skillGroups, 22), [doc.skillGroups]);
  const has = (key: SectionInfo['key']) => sections.some((section) => section.key === key);
  const kicker = [profile.title, profile.location].filter(Boolean).join(' · ');
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__grid" aria-hidden="true" />
      <SignalField skills={skills} seed={profile.name} />
      <div className="container hero__inner">
        {kicker ? (
          <Reveal as="p" className="hero__kicker mono">
            <span className="hero__tick" aria-hidden="true" />
            {kicker}
          </Reveal>
        ) : null}
        <h1 className="hero__name" id="hero-title">
          <span className="hero__line">
            <SplitWords text={first} delayMs={80} />
          </span>
          {last ? ' ' : null}
          {last ? (
            <span className="hero__line hero__line--accent">
              <SplitWords text={last} delayMs={260} />
            </span>
          ) : null}
        </h1>
        <div className="hero__body">
          {profile.headline ? (
            <Reveal as="p" className="hero__headline" index={3}>
              {profile.headline}
            </Reveal>
          ) : null}
          {profile.rotatingWords.length ? (
            <Reveal as="p" className="hero__focus" index={4}>
              <span className="mono faint">Now building</span>
              <RotatingWords words={profile.rotatingWords} />
            </Reveal>
          ) : null}
          {profile.intro ? (
            <Reveal index={5}>
              <Markdown source={profile.intro} className="hero__intro" />
            </Reveal>
          ) : null}
          <Reveal className="hero__actions" index={6}>
            {has('projects') ? (
              <a className="btn btn--primary" href="#work">
                Explore my work <Arrow direction="down" />
              </a>
            ) : null}
            {has('contact') ? (
              <a className="btn btn--ghost" href="#contact">
                Contact me
              </a>
            ) : null}
          </Reveal>
          {doc.links.length ? (
            <Reveal as="ul" role="list" className="hero__links" index={7}>
              {doc.links.map((link) => (
                <li key={link.id}>
                  <a
                    className="link link--muted"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                  >
                    {link.label}
                    <Arrow direction="out" size={14} />
                  </a>
                </li>
              ))}
            </Reveal>
          ) : null}
        </div>
      </div>
      <div className="container hero__readout">
        {stats.length ? (
          <Reveal as="dl" className="readout" index={8}>
            {stats.map((stat) => (
              <div key={stat.id} className="readout__item">
                <dt className="mono">{stat.label}</dt>
                <dd>
                  <CountUp value={stat.value ?? 0} suffix={stat.suffix} />
                </dd>
              </div>
            ))}
          </Reveal>
        ) : (
          <span />
        )}
        {has('projects') ? (
          <a className="scroll-cue mono" href="#work">
            <span className="scroll-cue__track" aria-hidden="true">
              <span />
            </span>
            Scroll
          </a>
        ) : null}
      </div>
    </section>
  );
}
