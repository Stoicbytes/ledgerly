import { useEffect, useRef, useState } from 'react';

/**
 * A text field's own value, passed on (`commit`) only after typing pauses for `delay` ms,
 * so a search over thousands of entries runs once per pause, not once per key. A change
 * to `value` from elsewhere (e.g. "Clear") replaces what is in the field.
 */
export function useDebouncedInput(value: string, commit: (text: string) => void, delay = 150) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);
  const latestCommit = useRef(commit);
  useEffect(() => {
    latestCommit.current = commit;
  });
  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    setDraft(value);
  }, [value]);
  useEffect(() => {
    if (draft === committed.current) return undefined;
    const timer = setTimeout(() => {
      committed.current = draft;
      latestCommit.current(draft);
    }, delay);
    return () => clearTimeout(timer);
  }, [draft, delay]);
  return [draft, setDraft] as const;
}
