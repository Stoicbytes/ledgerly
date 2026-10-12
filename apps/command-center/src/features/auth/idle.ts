/** Automatic sign-out after inactivity, with a warning two minutes before. */
const IDLE_MINUTES = 30;
export const IDLE_TIMEOUT_MS = IDLE_MINUTES * 60_000;
export const IDLE_WARNING_MS = 2 * 60_000;

export type IdlePhase = 'active' | 'warning' | 'expired';

/**
 * The owner's choice per device. `auto`: never on a device that keeps you signed in
 * (two-step sign-in guards new devices), otherwise 30 minutes.
 */
export type IdleChoice = 'auto' | '15' | '60' | '480' | 'never';
const IDLE_CHOICES = ['auto', '15', '60', '480', 'never'] as const;
export const isIdleChoice = (value: unknown): value is IdleChoice =>
  IDLE_CHOICES.includes(value as IdleChoice);

/** The timeout in milliseconds, or null for no automatic sign-out. */
export function idleTimeoutMs(choice: IdleChoice, keptSignedIn: boolean): number | null {
  if (choice === 'never') return null;
  if (choice === 'auto') return keptSignedIn ? null : IDLE_TIMEOUT_MS;
  return Number(choice) * 60_000;
}

/** Where an idle session stands `now`, given the last activity time. */
export function idlePhase(
  now: number,
  lastActive: number,
  timeout = IDLE_TIMEOUT_MS,
  warning = IDLE_WARNING_MS,
): IdlePhase {
  const idle = now - lastActive;
  if (idle >= timeout) return 'expired';
  if (idle >= timeout - Math.min(warning, timeout / 2)) return 'warning';
  return 'active';
}
