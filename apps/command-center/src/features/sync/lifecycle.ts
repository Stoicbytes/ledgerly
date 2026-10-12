import { AppState } from 'react-native';

type Handlers = {
  /** The page or app went to the background. */
  onHide: () => void;
  /** The page or app is in front again. */
  onReturn: () => void;
  /** Whether leaving the page now would lose something. */
  hasUnsavedChanges: () => boolean;
};

/**
 * Watches the page (web) or the app (phones) going to the background and coming back.
 * On the web, leaving or reloading the page while a change is unsaved also asks first.
 * Returns the function that stops watching.
 */
export function watchLifecycle(handlers: Handlers): () => void {
  // Phones (React Native) have a window object but no page events.
  if (typeof document === 'undefined' || typeof window?.addEventListener !== 'function') {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') handlers.onHide();
      else if (state === 'active' && previous !== 'active') handlers.onReturn();
      previous = state;
    });
    return () => subscription.remove();
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') handlers.onHide();
    else if (document.visibilityState === 'visible') handlers.onReturn();
  };
  const onLeave = (event: BeforeUnloadEvent) => {
    if (!handlers.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('beforeunload', onLeave);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('beforeunload', onLeave);
  };
}
