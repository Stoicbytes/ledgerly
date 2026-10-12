import { useSession } from './sessionStore';

/** "stoic.bytes@…" → "Stoic Bytes": a readable name from an email until one is set. */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const words = local.split(/[._+-]+/).filter(Boolean);
  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Who the app greets: the signed-in user's own name (Settings → Profile), else a name
 * made from their email. The preview has no user, so it says so.
 */
export function useDisplayName(): string {
  const { status, email, name } = useSession();
  if (status === 'preview') return 'Preview';
  return name || (email ? nameFromEmail(email) : '') || 'there';
}
