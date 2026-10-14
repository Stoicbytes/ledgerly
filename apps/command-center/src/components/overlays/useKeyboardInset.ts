import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Web: how much of the window the on-screen keyboard covers. Browsers that honour
 * `interactive-widget=resizes-content` (public/index.html) shrink the window instead and
 * this stays 0; Safari on iPhone only shrinks the visual viewport, so a bottom sheet adds
 * this as padding to keep its footer (Save) above the keyboard.
 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport =
      Platform.OS === 'web' && typeof window !== 'undefined' && window.visualViewport;
    if (!active || !viewport) return undefined;
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      setInset(0);
    };
  }, [active]);
  return inset;
}
