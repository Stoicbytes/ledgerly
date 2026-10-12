import { useState } from 'react';
import { SkillIcon } from '../components/Glyphs';
import { Reveal, SectionHead } from '../components/Motion';
import type { Skill, SkillGroup } from '../lib/types';

const LEVELS = ['', 'Learning', 'Familiar', 'Proficient', 'Advanced', 'Expert'];

/** Shown only when a level was set in the dashboard; never guessed. */
function Level({ value }: { value: number }) {
  return (
    <span className="level" role="img" aria-label={`${LEVELS[value]} (${value} of 5)`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span key={step} className={step <= value ? 'is-on' : undefined} />
      ))}
    </span>
  );
}

function SkillTile({
  skill,
  open,
  onToggle,
  index,
}: {
  skill: Skill;
  open: boolean;
  onToggle: () => void;
  index: number;
}) {
  const row = (
    <>
      <SkillIcon icon={skill.icon} name={skill.name} />
      <span className="skill-tile__name">{skill.name}</span>
      {skill.featured ? <span className="skill-tile__core mono">Core</span> : null}
      {skill.level ? <Level value={skill.level} /> : null}
      {skill.draft ? <span className="badge badge--draft">Draft</span> : null}
    </>
  );
  return (
    <Reveal
      as="li"
      index={index % 8}
      variant="scale"
      className={`skill-tile${skill.featured ? ' is-featured' : ''}${open ? ' is-open' : ''}`}
    >
      {skill.description ? (
        <>
          <button
            type="button"
            className="skill-tile__row"
            aria-expanded={open}
            aria-controls={`skill-${skill.id}`}
            onClick={onToggle}
          >
            {row}
            <span className="skill-tile__toggle" aria-hidden="true" />
          </button>
          <div id={`skill-${skill.id}`} className="skill-tile__detail" hidden={!open}>
            <p>{skill.description}</p>
          </div>
        </>
      ) : (
        <div className="skill-tile__row">{row}</div>
      )}
    </Reveal>
  );
}

export function Skills({ groups, index }: { groups: SkillGroup[]; index: number }) {
  const withSkills = groups.filter((group) => group.skills.length);
  const [active, setActive] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const shown = active === 'all' ? withSkills : withSkills.filter((group) => group.id === active);
  const total = withSkills.reduce((sum, group) => sum + group.skills.length, 0);
  return (
    <section className="page-section" id="stack" aria-labelledby="stack-title">
      <div className="container">
        <SectionHead
          index={index}
          label="Stack"
          id="stack-title"
          title={
            <>
              Tools I <em>reach for</em>
            </>
          }
          lead={`${total} ${total === 1 ? 'skill' : 'skills'} across ${withSkills.length} ${withSkills.length === 1 ? 'area' : 'areas'}.`}
        />
        <div className="skills">
          <div className="skills__groups" role="group" aria-label="Filter skills by area">
            <button
              type="button"
              className="chip"
              aria-pressed={active === 'all'}
              onClick={() => setActive('all')}
            >
              All <span className="chip__count">{total}</span>
            </button>
            {withSkills.map((group) => (
              <button
                key={group.id}
                type="button"
                className="chip"
                aria-pressed={active === group.id}
                onClick={() => setActive(active === group.id ? 'all' : group.id)}
              >
                {group.name} <span className="chip__count">{group.skills.length}</span>
              </button>
            ))}
          </div>
          <div className="skills__panel">
            {shown.map((group) => (
              <div key={group.id} className={`skill-group${group.draft ? ' draft-outline' : ''}`}>
                <div className="skill-group__head">
                  <h3 className="skill-group__name">{group.name}</h3>
                  {group.description ? (
                    <p className="skill-group__desc">{group.description}</p>
                  ) : null}
                </div>
                <ul role="list" className="skill-grid">
                  {group.skills.map((skill, i) => (
                    <SkillTile
                      key={skill.id}
                      skill={skill}
                      index={i}
                      open={open === skill.id}
                      onToggle={() => setOpen(open === skill.id ? null : skill.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
