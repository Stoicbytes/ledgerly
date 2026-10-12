import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  if (typeof document === 'undefined') return;
  cleanup();
  document.documentElement.removeAttribute('data-motion');
});
