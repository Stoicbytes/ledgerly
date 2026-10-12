import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/instrument-serif/400-italic.css';
import './styles/index.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './app/App';
import { STATE_ELEMENT_ID, type InitialState } from './app/state';
import { normalizeDocument } from './lib/normalize';

/** Starts from the state the server rendered (so the page hydrates without a refetch). */
function readState(): InitialState | null {
  const element = document.getElementById(STATE_ELEMENT_ID);
  if (!element?.textContent) return null;
  try {
    const state = JSON.parse(element.textContent) as InitialState;
    return { ...state, document: normalizeDocument(state.document) };
  } catch {
    return null;
  }
}

const root = document.getElementById('root');
const state = readState();
if (root && state) {
  if (root.firstElementChild) hydrateRoot(root, <App initial={state} />);
  else createRoot(root).render(<App initial={state} />);
}
