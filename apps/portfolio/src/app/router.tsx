import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { motionAllowed } from '../hooks/motion';

/**
 * A tiny router for three kinds of page. Links within the site change the page without
 * a reload; where the browser supports View Transitions (and motion is allowed) the
 * change animates, and a project's cover image glides into the project page.
 */
type RouterValue = { path: string; navigate: (href: string) => void };

const RouterContext = createContext<RouterValue>({ path: '/', navigate: () => {} });

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

function scrollToHash(hash: string) {
  const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  if (target) target.scrollIntoView({ block: 'start' });
  else window.scrollTo({ top: 0 });
}

export function RouterProvider({
  initialPath,
  children,
}: {
  initialPath: string;
  children: ReactNode;
}) {
  const [path, setPath] = useState(initialPath);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((href: string) => {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) {
      window.location.assign(url.href);
      return;
    }
    if (url.pathname === window.location.pathname) {
      window.history.pushState(null, '', url.pathname + url.hash);
      scrollToHash(url.hash);
      return;
    }
    const update = () => {
      window.history.pushState(null, '', url.pathname + url.hash);
      flushSync(() => setPath(url.pathname));
      scrollToHash(url.hash);
    };
    const doc = document as ViewTransitionDocument;
    if (doc.startViewTransition && motionAllowed()) doc.startViewTransition(update);
    else update();
  }, []);

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export const useRouter = () => useContext(RouterContext);

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** An <a> that stays inside the app for this site's own pages. */
export function Link({ href, onClick, ...props }: LinkProps) {
  const { navigate } = useRouter();
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target ||
      !href.startsWith('/')
    )
      return;
    event.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...props} />;
}
