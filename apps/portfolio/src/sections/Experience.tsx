import { Markdown } from '../components/Markdown';
import { Reveal, SectionHead } from '../components/Motion';
import { duration, monthsBetween, period } from '../lib/format';
import type { Experience as Job } from '../lib/types';

function List({
  title,
  items,
  className = '',
}: {
  title: string;
  items: string[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={`job__list ${className}`}>
      <h4 className="job__label mono">{title}</h4>
      <ul role="list">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function TimelineItem({ job, today }: { job: Job; today: string }) {
  const org = [
    job.company,
    job.client ? `Client: ${job.client}` : '',
    job.location,
    job.employmentType,
  ].filter(Boolean);
  return (
    <li className={`job${job.draft ? ' draft-outline' : ''}`}>
      <div className="job__when">
        <p className="job__period mono">{period(job.start, job.end)}</p>
        <p className="job__duration mono faint">
          {duration(monthsBetween(job.start, job.end, today))}
        </p>
        {!job.end ? <span className="badge badge--live">Current</span> : null}
        {job.draft ? <span className="badge badge--draft">Draft</span> : null}
      </div>
      <span className="job__node" aria-hidden="true" />
      <Reveal className="job__card">
        <h3 className="job__role">{job.role}</h3>
        <p className="job__org">
          {org.map((item, index) => (
            <span key={index}>{item}</span>
          ))}
        </p>
        <Markdown source={job.summary} className="prose job__summary" />
        <List title="Responsibilities" items={job.responsibilities} />
        <List title="Key contributions" items={job.highlights} className="job__list--highlights" />
        {job.achievements.length ? (
          <ul role="list" className="job__achievements" aria-label="Achievements">
            {job.achievements.map((item, index) => (
              <li key={index}>
                <span className="job__star" aria-hidden="true">
                  ✦
                </span>
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {job.tech.length ? (
          <ul role="list" className="tags" aria-label="Technologies">
            {job.tech.map((tech) => (
              <li key={tech} className="tag">
                {tech}
              </li>
            ))}
          </ul>
        ) : null}
      </Reveal>
    </li>
  );
}

export function Experience({
  items,
  today,
  index,
}: {
  items: Job[];
  today: string;
  index: number;
}) {
  return (
    <section className="page-section" id="experience" aria-labelledby="experience-title">
      <div className="container">
        <SectionHead
          index={index}
          label="Experience"
          id="experience-title"
          title={
            <>
              Where I&apos;ve <em>worked</em>
            </>
          }
        />
        <div className="timeline">
          <span className="timeline__line" aria-hidden="true">
            <span className="timeline__progress" />
          </span>
          <ol role="list" className="timeline__list">
            {items.map((job) => (
              <TimelineItem key={job.id} job={job} today={today} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
