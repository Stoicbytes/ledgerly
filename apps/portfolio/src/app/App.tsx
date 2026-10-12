import { useEffect, useMemo } from 'react';
import { useMotionReady } from '../hooks/motion';
import { parseRoute } from '../lib/routes';
import { findProject, pageTitle } from '../lib/seo';
import { HomePage } from '../pages/HomePage';
import { ProjectPage } from '../pages/ProjectPage';
import { PreviewBanner, StatusPage } from '../pages/StatusPage';
import { Footer } from '../sections/Footer';
import { Header } from '../sections/Header';
import { RouterProvider, useRouter } from './router';
import { visibleSections } from './sections';
import type { InitialState } from './state';
import { useSiteData, type SiteData } from './useSiteData';

function Site({ initial, data }: { initial: InitialState; data: SiteData }) {
  const { path } = useRouter();
  const { document: doc, mode } = data;
  // In a preview the whole site is browsed from the preview document.
  const route = mode === 'preview' && path === '/preview' ? parseRoute('/') : parseRoute(path);
  const sections = useMemo(() => (doc ? visibleSections(doc) : []), [doc]);
  const project = findProject(doc, route);

  useEffect(() => {
    if (doc) document.title = pageTitle(doc, route) + (mode === 'preview' ? ' (preview)' : '');
  }, [doc, route, mode]);

  if (!doc) {
    if (mode === 'preview') {
      const problem = data.problem;
      return (
        <StatusPage
          code="Preview"
          title={problem ? 'This preview link has expired' : 'Loading the preview…'}
        >
          {problem ? (
            <p>Preview links last 20 minutes. Open Preview again from the dashboard.</p>
          ) : null}
        </StatusPage>
      );
    }
    const dashboard = initial.dashboardUrl;
    if (mode === 'unconfigured')
      return (
        <StatusPage code="Setup" title="This site is not set up yet" dashboardUrl={dashboard} />
      );
    if (mode === 'offline')
      return (
        <StatusPage
          code="Offline"
          title="The portfolio could not be loaded"
          dashboardUrl={dashboard}
        >
          <p>Please try again in a moment.</p>
        </StatusPage>
      );
    return (
      <StatusPage code="Soon" title="Nothing is published here yet" dashboardUrl={dashboard} />
    );
  }

  return (
    <>
      {mode === 'preview' ? <PreviewBanner expiresAt={doc.previewExpiresAt} /> : null}
      <Header document={doc} sections={sections} dashboardUrl={initial.dashboardUrl} />
      <main id="main" tabIndex={-1}>
        {route.name === 'home' ? (
          <HomePage
            document={doc}
            sections={sections}
            config={initial.config}
            today={initial.today}
          />
        ) : project ? (
          <ProjectPage document={doc} project={project} config={initial.config} />
        ) : (
          <StatusPage code="404" title="This page doesn't exist" home />
        )}
      </main>
      <Footer document={doc} sections={sections} today={initial.today} />
    </>
  );
}

export function App({ initial }: { initial: InitialState }) {
  useMotionReady();
  const data = useSiteData(initial);
  return (
    <RouterProvider initialPath={initial.path}>
      <div id="top">
        <Site initial={initial} data={data} />
      </div>
    </RouterProvider>
  );
}
