/**
 * On the web each screen is its own file, fetched the first time it opens. Once the
 * dashboard has shown and the browser is idle, fetch the rest so later switches are
 * instant. Failures are ignored: opening the screen fetches it again.
 */
const screens = [
  () => import('@/app/dashboard/expenses/index'),
  () => import('@/app/dashboard/mutual-funds'),
  () => import('@/app/dashboard/stocks'),
  () => import('@/app/dashboard/notes'),
  () => import('@/app/dashboard/salary'),
  () => import('@/app/dashboard/reports'),
  () => import('@/app/dashboard/settings'),
];

let started = false;

export function prefetchScreens(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const idle: (callback: () => void) => void =
    'requestIdleCallback' in window
      ? (callback) => window.requestIdleCallback(callback, { timeout: 5000 })
      : (callback) => window.setTimeout(callback, 2000);
  // One at a time, so the screen in use keeps the network and the main thread.
  const next = (index: number) => {
    if (index >= screens.length) return;
    idle(() => {
      screens[index]()
        .catch(() => undefined)
        .finally(() => next(index + 1));
    });
  };
  next(0);
}
