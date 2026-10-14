import { REFRESH_EVERY_MS, watchLifecycle } from '../lifecycle';

const page = () => {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const win = new EventTarget();
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { document: g.document, add: g.addEventListener, remove: g.removeEventListener };
  g.document = doc;
  g.addEventListener = win.addEventListener.bind(win);
  g.removeEventListener = win.removeEventListener.bind(win);
  const restore = () => {
    g.document = saved.document;
    g.addEventListener = saved.add;
    g.removeEventListener = saved.remove;
  };
  return { doc, win, restore };
};

describe('watchLifecycle on the web', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('asks to refresh when the window gets focus and every 5 minutes while visible', () => {
    const { doc, win, restore } = page();
    const onReturn = jest.fn();
    const stop = watchLifecycle({ onHide: jest.fn(), onReturn, hasUnsavedChanges: () => false });
    win.dispatchEvent(new Event('focus'));
    expect(onReturn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(REFRESH_EVERY_MS);
    expect(onReturn).toHaveBeenCalledTimes(2);
    doc.visibilityState = 'hidden';
    jest.advanceTimersByTime(REFRESH_EVERY_MS);
    expect(onReturn).toHaveBeenCalledTimes(2);
    stop();
    doc.visibilityState = 'visible';
    win.dispatchEvent(new Event('focus'));
    jest.advanceTimersByTime(REFRESH_EVERY_MS);
    expect(onReturn).toHaveBeenCalledTimes(2);
    restore();
  });
});
