import { useNow } from '../hooks/motion';
import { clock } from '../lib/format';
import type { Profile } from '../lib/types';

const DEFAULT_NOTE = { open: 'Open to opportunities', busy: 'Currently booked' } as const;

/** Availability with your local time ("● Open to opportunities · 14:05 IST"). */
export function Availability({
  profile,
  className = '',
}: {
  profile: Profile;
  className?: string;
}) {
  const now = useNow();
  const time = now ? clock(profile.timezone, now) : null;
  if (profile.availability === 'hidden' && !profile.timezone) return null;
  return (
    <p className={`availability ${className}`}>
      {profile.availability !== 'hidden' ? (
        <>
          <span
            className={`dot${profile.availability === 'busy' ? ' dot--busy' : ''}`}
            aria-hidden="true"
          />
          <span>{profile.availabilityNote || DEFAULT_NOTE[profile.availability]}</span>
        </>
      ) : null}
      {profile.timezone ? (
        <span
          className="availability__time mono"
          aria-label={time ? `Local time ${time.time} ${time.zone}` : undefined}
        >
          {time ? `${time.time} ${time.zone}` : ' '}
        </span>
      ) : null}
    </p>
  );
}
