import { useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Web: when a sheet closes, focus goes back to the control that opened it (keyboard and
 * screen-reader users keep their place). Remembered before the sheet moves focus inside.
 */
export function useReturnFocus(visible: boolean) {
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    if (visible) {
      opener.current = document.activeElement as HTMLElement | null;
      return undefined;
    }
    const target = opener.current;
    opener.current = null;
    if (!target || target === document.body) return undefined;
    // After the closing animation has removed the sheet.
    const timer = setTimeout(() => {
      const active = document.activeElement;
      if (document.contains(target) && (!active || active === document.body)) target.focus();
    }, 350);
    return () => clearTimeout(timer);
  }, [visible]);
}
