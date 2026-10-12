import { Arrow } from '../components/Glyphs';
import { Markdown } from '../components/Markdown';
import { Reveal, SectionHead } from '../components/Motion';
import type { ExtraSection } from '../lib/types';

const KIND: Record<string, string> = {
  interests: 'Interests',
  writing: 'Writing',
  experiments: 'Experiments',
  custom: '',
};

export function Beyond({ sections, index }: { sections: ExtraSection[]; index: number }) {
  return (
    <section className="page-section" id="beyond" aria-labelledby="beyond-title">
      <div className="container">
        <SectionHead
          index={index}
          label="Beyond the code"
          id="beyond-title"
          title={
            <>
              Off the <em>clock</em>
            </>
          }
        />
        <div className="beyond">
          {sections.map((section, i) => (
            <Reveal
              as="article"
              key={section.id}
              index={i}
              className={`beyond__card${section.draft ? ' draft-outline' : ''}`}
            >
              {KIND[section.kind] ? <p className="mono faint">{KIND[section.kind]}</p> : null}
              <h3 className="beyond__title">{section.title}</h3>
              <Markdown source={section.body} />
              {section.items.length ? (
                <ul role="list" className="beyond__items">
                  {section.items.map((item, j) => (
                    <li key={j}>
                      {item.url ? (
                        <a
                          className="link"
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.title} <Arrow direction="out" size={14} />
                        </a>
                      ) : (
                        <span className="beyond__item-title">{item.title}</span>
                      )}
                      {item.detail ? (
                        <span className="beyond__item-detail">{item.detail}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
