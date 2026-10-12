import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

// Web follows the :focus-visible rule: a click also focuses the control, but
// only keyboard focus should draw a focus ring. Track the last input modality.
let keyboardModality = true;
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    (event) => {
      if (!event.metaKey && !event.altKey && !event.ctrlKey) keyboardModality = true;
    },
    true,
  );
  document.addEventListener('pointerdown', () => (keyboardModality = false), true);
}

/**
 * Hover and focus tracking for Pressables. React Native only reports `pressed`
 * in its style callback, so hover (web pointer) and focus (keyboard, web and
 * hardware keyboards) are tracked through the Pressable event props.
 * `focused` is true only for keyboard focus, so pointer users see no ring.
 */
export function useInteractionState() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const onHoverIn = useCallback(() => setHovered(true), []);
  const onHoverOut = useCallback(() => setHovered(false), []);
  const onFocus = useCallback(() => setFocused(Platform.OS !== 'web' || keyboardModality), []);
  const onBlur = useCallback(() => setFocused(false), []);
  const handlers = useMemo(
    () => ({ onHoverIn, onHoverOut, onFocus, onBlur }),
    [onHoverIn, onHoverOut, onFocus, onBlur],
  );
  return { hovered, focused, handlers };
}
