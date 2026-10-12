import type { SectionInfo } from '../app/sections';
import type { SiteConfig } from '../lib/config';
import type { PortfolioDocument } from '../lib/types';
import { About } from '../sections/About';
import { Beyond } from '../sections/Beyond';
import { Contact } from '../sections/Contact';
import { Credentials } from '../sections/Credentials';
import { Experience } from '../sections/Experience';
import { Hero } from '../sections/Hero';
import { Skills } from '../sections/Skills';
import { Work } from '../sections/Work';

type Props = {
  document: PortfolioDocument;
  sections: SectionInfo[];
  config: SiteConfig | null;
  today: string;
};

export function HomePage({ document: doc, sections, config, today }: Props) {
  return (
    <>
      <Hero document={doc} sections={sections} />
      {sections.map((section, i) => {
        const index = i + 1;
        switch (section.key) {
          case 'projects':
            return <Work key={section.key} projects={doc.projects} config={config} index={index} />;
          case 'skills':
            return <Skills key={section.key} groups={doc.skillGroups} index={index} />;
          case 'experience':
            return (
              <Experience key={section.key} items={doc.experience} today={today} index={index} />
            );
          case 'about':
            return <About key={section.key} document={doc} config={config} index={index} />;
          case 'education':
            return (
              <Credentials key={section.key} items={doc.education} config={config} index={index} />
            );
          case 'beyond':
            return <Beyond key={section.key} sections={doc.sections} index={index} />;
          case 'contact':
            return (
              <Contact
                key={section.key}
                document={doc}
                config={config}
                index={index}
                preview={doc.preview}
              />
            );
        }
      })}
    </>
  );
}
