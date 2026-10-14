import { Platform } from 'react-native';
import { hasUnsavedChanges } from '@/features/sync/cloudSync';
import { isStaleBuildError, reloadForUpdate } from '../staleBuild';

jest.mock('@/features/sync/cloudSync', () => ({ hasUnsavedChanges: jest.fn() }));

const stale = Object.assign(new Error('Loading module /x.js failed.'), {
  name: 'AsyncRequireError',
});

describe('reloading after a new deploy', () => {
  const reload = jest.fn();
  const saved = new Map<string, string>();
  const original = Platform.OS;
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    reload.mockReset();
    saved.clear();
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    (globalThis as { window?: unknown }).window = {
      location: { reload },
      sessionStorage: {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => saved.set(key, value),
      },
    };
    jest.mocked(hasUnsavedChanges).mockReturnValue(false);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it('knows a missing screen file from other errors', () => {
    expect(isStaleBuildError(stale)).toBe(true);
    expect(isStaleBuildError(new Error('Requiring unknown module "123"'))).toBe(true);
    expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('reloads once, not again within a minute', () => {
    expect(reloadForUpdate(stale, 1_000_000)).toBe(true);
    expect(reloadForUpdate(stale, 1_030_000)).toBe(false);
    expect(reloadForUpdate(stale, 1_070_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload while any change is unsaved, or for other errors', () => {
    // Includes an edit still in its short wait before sending (status says Saved).
    jest.mocked(hasUnsavedChanges).mockReturnValue(true);
    expect(reloadForUpdate(stale)).toBe(false);
    jest.mocked(hasUnsavedChanges).mockReturnValue(false);
    expect(reloadForUpdate(new Error('boom'))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('never reloads on phones', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(reloadForUpdate(stale)).toBe(false);
  });
});
